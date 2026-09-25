-- Eiwitshift-kalender: schema, access rules (RLS), notifications and helpers.
-- Every table has Row Level Security. Visitors who are not logged in can only read
-- the public_moments view (titles and dates).

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Tables

create table public.organisations (
  name text primary key check (length(trim(name)) > 0),
  is_green_deal_partner boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  org text references public.organisations (name) on update cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  is_coordinator boolean not null default false,
  requested_org text,
  feed_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

-- Who gets access automatically: an exact address ('naam@org.be') or a whole domain ('@org.be').
create table public.access_rules (
  pattern text primary key check (pattern = lower(pattern) and pattern like '%@%'),
  org text not null references public.organisations (name) on update cascade,
  is_coordinator boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.moments (
  id text primary key default gen_random_uuid()::text,
  title text not null check (length(trim(title)) > 0),
  start_date date,
  end_date date,
  ongoing boolean not null default false,
  date_unsure boolean not null default false,
  unsure_note text,
  type text not null,
  target_group text not null,
  focus text not null,
  free boolean not null default true,
  region text not null default 'Vlaanderen',
  organiser text not null,
  co_organisers text,
  owner_orgs text[] not null default '{}',
  is_green_deal_partner boolean not null default true,
  link text,
  description text,
  halfhalf_link boolean not null default false,
  need text,
  featured boolean not null default false,
  custom_fields jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_by_org text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.reactions (
  id text primary key default gen_random_uuid()::text,
  moment_id text not null references public.moments (id) on delete cascade,
  org text not null default '',
  name text not null default '',
  kind text not null check (kind in ('join', 'spread')),
  note text,
  in_contact boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (moment_id, org, kind)
);

create table public.comments (
  id text primary key default gen_random_uuid()::text,
  moment_id text not null references public.moments (id) on delete cascade,
  org text not null default '',
  text text not null check (length(trim(text)) > 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.signals (
  id text primary key default gen_random_uuid()::text,
  moment_id text not null references public.moments (id) on delete cascade,
  kind text not null,
  note text,
  anonymous boolean not null default false,
  from_org text, -- stays NULL for anonymous signals: nobody can see who sent them
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  to_org text,
  to_coordinators boolean not null default false,
  moment_id text references public.moments (id) on delete cascade,
  kind text not null,
  from_org text not null,
  detail text,
  read boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.field_defs (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('text', 'dropdown', 'yesno')),
  options text[] not null default '{}',
  show_in_form boolean not null default true,
  created_at timestamptz not null default now()
);

-- Settings the database itself needs (e.g. where the e-mail function lives). Not readable by users.
create schema if not exists private;
create table private.settings (
  key text primary key,
  value text not null
);

create index on public.reactions (moment_id);
create index on public.comments (moment_id);
create index on public.signals (moment_id);
create index on public.notifications (to_org);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so they can read profiles regardless of RLS)

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.user_id = auth.uid()), false)
$$;

create or replace function public.is_coordinator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.status = 'active' and p.is_coordinator from public.profiles p where p.user_id = auth.uid()), false)
$$;

create or replace function public.my_org() returns text
language sql stable security definer set search_path = '' as $$
  select p.org from public.profiles p where p.user_id = auth.uid() and p.status = 'active'
$$;

create or replace function public.owns_moment(m_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.my_org() = any (m.owner_orgs) from public.moments m where m.id = m_id), false)
$$;

-- ---------------------------------------------------------------------------
-- Guard triggers: fill in who did what, and stop people from giving themselves extra rights.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rule public.access_rules;
  addr text := lower(new.email);
  first_user boolean := not exists (select 1 from public.profiles);
begin
  select * into rule from public.access_rules where pattern = addr;
  if not found then
    select * into rule from public.access_rules where pattern = '@' || split_part(addr, '@', 2);
  end if;

  if first_user then
    -- The very first person to log in (the one who set this up) becomes coordinator.
    insert into public.profiles (user_id, email, status, is_coordinator) values (new.id, addr, 'active', true);
  elsif rule.pattern is not null then
    insert into public.profiles (user_id, email, org, status, is_coordinator)
    values (new.id, addr, rule.org, 'active', rule.is_coordinator);
  else
    insert into public.profiles (user_id, email) values (new.id, addr);
    insert into public.notifications (to_coordinators, kind, from_org, detail)
    values (true, 'access_request', 'Nieuwe gebruiker', addr);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.email := old.email;
  new.feed_token := old.feed_token;
  new.created_at := old.created_at;
  if not public.is_coordinator() then
    new.status := old.status;
    new.is_coordinator := old.is_coordinator;
    new.org := old.org;
  end if;
  return new;
end $$;

create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

create or replace function public.guard_moment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_org := coalesce(public.my_org(), '');
    new.created_at := now();
    if not public.is_coordinator() then
      new.featured := false;
    end if;
  else
    new.created_by := old.created_by;
    new.created_by_org := old.created_by_org;
    new.created_at := old.created_at;
    new.updated_at := now();
    if not public.is_coordinator() then
      new.featured := old.featured;
    end if;
  end if;
  return new;
end $$;

create trigger guard_moment before insert or update on public.moments
  for each row execute function public.guard_moment();

create or replace function public.guard_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.org := public.my_org();
    new.name := coalesce(nullif((select p.name from public.profiles p where p.user_id = auth.uid()), ''), new.org);
    new.created_by := auth.uid();
    new.created_at := now();
    new.in_contact := false;
  else
    new.moment_id := old.moment_id;
    new.org := old.org;
    new.name := old.name;
    new.kind := old.kind;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- Only the reacting organisation may change its own note.
    if public.my_org() is distinct from old.org and not public.is_coordinator() then
      new.note := old.note;
    end if;
  end if;
  return new;
end $$;

create trigger guard_reaction before insert or update on public.reactions
  for each row execute function public.guard_reaction();

create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.org := public.my_org();
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end $$;

create trigger guard_comment before insert on public.comments
  for each row execute function public.guard_comment();

create or replace function public.guard_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.from_org := case when new.anonymous then null else public.my_org() end;
  new.resolved := false;
  new.created_at := now();
  return new;
end $$;

create trigger guard_signal before insert on public.signals
  for each row execute function public.guard_signal();

-- ---------------------------------------------------------------------------
-- Notifications (same rules as the prototype's reducer)

create or replace function public.notify_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owners text[];
begin
  if tg_op = 'INSERT' then
    select m.owner_orgs into owners from public.moments m where m.id = new.moment_id;
    insert into public.notifications (to_org, moment_id, kind, from_org, detail)
    select distinct o, new.moment_id, 'reaction', new.org,
      case new.kind when 'join' then 'Ik haak aan' else 'Ik kan mee verspreiden' end
    from unnest(owners) as o
    where o is distinct from new.org;
    return new;
  else
    -- Withdrawing a reaction also withdraws the notification, if it wasn't read yet.
    delete from public.notifications n
    where n.kind = 'reaction' and not n.read and n.moment_id = old.moment_id and n.from_org = old.org
      and n.detail = case old.kind when 'join' then 'Ik haak aan' else 'Ik kan mee verspreiden' end;
    return old;
  end if;
end $$;

create trigger notify_reaction after insert or delete on public.reactions
  for each row execute function public.notify_reaction();

create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (to_org, moment_id, kind, from_org, detail)
  select distinct o, new.moment_id, 'comment', new.org, new.text
  from (
    select unnest(m.owner_orgs) as o from public.moments m where m.id = new.moment_id
    union
    select c.org from public.comments c where c.moment_id = new.moment_id and c.id <> new.id
  ) as recipients
  where o is distinct from new.org and o <> '';
  return new;
end $$;

create trigger notify_comment after insert on public.comments
  for each row execute function public.notify_comment();

create or replace function public.notify_moment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coordinator() then
    insert into public.notifications (to_coordinators, moment_id, kind, from_org)
    values (true, new.id, 'new_moment', coalesce(nullif(new.created_by_org, ''), new.organiser));
  end if;
  return new;
end $$;

create trigger notify_moment after insert on public.moments
  for each row execute function public.notify_moment();

create or replace function public.notify_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (to_coordinators, moment_id, kind, from_org, detail)
  values (true, new.moment_id, 'signal', coalesce(new.from_org, 'Anoniem'), new.kind);
  return new;
end $$;

create trigger notify_signal after insert on public.signals
  for each row execute function public.notify_signal();

-- Every new notification is also e-mailed, by the "notify" edge function.
create or replace function public.email_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fn_url text := (select s.value from private.settings s where s.key = 'functions_url');
begin
  if fn_url is not null then
    begin
      perform net.http_post(
        url := fn_url || '/notify',
        body := jsonb_build_object('id', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    exception when others then
      raise warning 'e-mail for notification % not queued: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

create trigger email_notification after insert on public.notifications
  for each row execute function public.email_notification();

-- Remove an extra field and its values everywhere (coordinators only).
create or replace function public.remove_field(field_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coordinator() then
    raise exception 'Enkel coördinatoren kunnen velden verwijderen';
  end if;
  delete from public.field_defs where id = field_id;
  update public.moments set custom_fields = custom_fields - field_id where custom_fields ? field_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.access_rules enable row level security;
alter table public.moments enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.signals enable row level security;
alter table public.notifications enable row level security;
alter table public.field_defs enable row level security;

-- organisations: every logged-in user may read the list (needed to ask for access)
create policy "read organisations" on public.organisations for select to authenticated using (true);
create policy "coordinators manage organisations" on public.organisations for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- profiles: your own row, or everything if you are a coordinator
create policy "read own profile" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_coordinator());
create policy "update own profile" on public.profiles for update to authenticated
  using (user_id = auth.uid() or public.is_coordinator())
  with check (user_id = auth.uid() or public.is_coordinator());
create policy "coordinators delete profiles" on public.profiles for delete to authenticated
  using (public.is_coordinator());

create policy "coordinators manage access rules" on public.access_rules for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

create policy "partners read moments" on public.moments for select to authenticated using (public.is_active());
create policy "partners add moments" on public.moments for insert to authenticated
  with check (public.is_active() and (public.is_coordinator() or public.my_org() = any (owner_orgs)));
create policy "owners edit moments" on public.moments for update to authenticated
  using (public.is_coordinator() or public.my_org() = any (owner_orgs))
  with check (public.is_coordinator() or public.my_org() = any (owner_orgs));
create policy "owners delete moments" on public.moments for delete to authenticated
  using (public.is_coordinator() or public.my_org() = any (owner_orgs));

create policy "partners read reactions" on public.reactions for select to authenticated using (public.is_active());
create policy "partners react" on public.reactions for insert to authenticated
  with check (public.is_active() and exists (select 1 from public.moments m where m.id = moment_id));
create policy "update reactions" on public.reactions for update to authenticated
  using (org = public.my_org() or public.is_coordinator() or public.owns_moment(moment_id))
  with check (org = public.my_org() or public.is_coordinator() or public.owns_moment(moment_id));
create policy "withdraw reactions" on public.reactions for delete to authenticated
  using (org = public.my_org() or public.is_coordinator());

create policy "partners read comments" on public.comments for select to authenticated using (public.is_active());
create policy "partners comment" on public.comments for insert to authenticated with check (public.is_active());
create policy "remove comments" on public.comments for delete to authenticated
  using (org = public.my_org() or public.is_coordinator());

create policy "partners send signals" on public.signals for insert to authenticated with check (public.is_active());
create policy "coordinators read signals" on public.signals for select to authenticated using (public.is_coordinator());
create policy "coordinators update signals" on public.signals for update to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

create policy "read own notifications" on public.notifications for select to authenticated
  using (public.is_active() and (to_org = public.my_org() or (to_coordinators and public.is_coordinator())));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (public.is_active() and (to_org = public.my_org() or (to_coordinators and public.is_coordinator())))
  with check (public.is_active() and (to_org = public.my_org() or (to_coordinators and public.is_coordinator())));

create policy "partners read fields" on public.field_defs for select to authenticated using (public.is_active());
create policy "coordinators manage fields" on public.field_defs for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- Public view: titles and dates only, for visitors who are not logged in.
create view public.public_moments as
  select id, title, start_date, end_date, ongoing, date_unsure, unsure_note from public.moments;
grant select on public.public_moments to anon, authenticated;

-- Realtime: push changes to open browsers (Supabase applies the same RLS rules).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.moments, public.reactions, public.comments, public.signals,
      public.notifications, public.field_defs, public.profiles;
  end if;
end $$;
