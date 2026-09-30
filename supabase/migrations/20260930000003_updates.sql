-- 2026-09-30: edit/delete own comments, notifications point at what happened (ref_id),
-- and a changed name also shows on earlier reactions.

alter table public.notifications add column if not exists ref_id text;
alter table public.comments add column if not exists edited_at timestamptz;
create index if not exists notifications_ref_id_idx on public.notifications (ref_id);

-- ---------------------------------------------------------------------------
-- Notifications remember the reaction / comment / moment / signal they are about.

create or replace function public.notify_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owners text[];
begin
  if tg_op = 'INSERT' then
    select m.owner_orgs into owners from public.moments m where m.id = new.moment_id;
    insert into public.notifications (to_org, moment_id, kind, from_org, detail, ref_id)
    select distinct o, new.moment_id, 'reaction', new.org,
      case new.kind when 'join' then 'Ik haak aan' else 'Ik kan mee verspreiden' end, new.id
    from unnest(owners) as o
    where o is distinct from new.org;
    return new;
  else
    -- Withdrawing a reaction also withdraws the notification, if it wasn't read yet.
    delete from public.notifications n
    where n.kind = 'reaction' and not n.read and n.moment_id = old.moment_id
      and (n.ref_id = old.id or (n.ref_id is null and n.from_org = old.org
        and n.detail = case old.kind when 'join' then 'Ik haak aan' else 'Ik kan mee verspreiden' end));
    return old;
  end if;
end $$;

create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (to_org, moment_id, kind, from_org, detail, ref_id)
  select distinct o, new.moment_id, 'comment', new.org, new.text, new.id
  from (
    select unnest(m.owner_orgs) as o from public.moments m where m.id = new.moment_id
    union
    select c.org from public.comments c where c.moment_id = new.moment_id and c.id <> new.id
  ) as recipients
  where o is distinct from new.org and o <> '';
  return new;
end $$;

create or replace function public.notify_moment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coordinator() then
    insert into public.notifications (to_coordinators, moment_id, kind, from_org, ref_id)
    values (true, new.id, 'new_moment', coalesce(nullif(new.created_by_org, ''), new.organiser), new.id);
  end if;
  return new;
end $$;

create or replace function public.notify_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (to_coordinators, moment_id, kind, from_org, detail, ref_id)
  values (true, new.moment_id, 'signal', coalesce(new.from_org, 'Anoniem'), new.kind, new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Comments: the author may edit; the author or a coordinator may delete.

create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.org := public.my_org();
    new.created_by := auth.uid();
    new.created_at := now();
    new.edited_at := null;
  else
    new.moment_id := old.moment_id;
    new.org := old.org;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.edited_at := case when new.text is distinct from old.text then now() else old.edited_at end;
  end if;
  return new;
end $$;

drop trigger if exists guard_comment on public.comments;
create trigger guard_comment before insert or update on public.comments
  for each row execute function public.guard_comment();

drop policy if exists "remove comments" on public.comments;
create policy "authors edit comments" on public.comments for update to authenticated
  using (created_by = auth.uid() and public.is_active())
  with check (created_by = auth.uid());
create policy "authors or coordinators remove comments" on public.comments for delete to authenticated
  using (created_by = auth.uid() or public.is_coordinator());

-- Keep comment notifications in step: an edit updates the text, a delete removes unread ones.
create or replace function public.sync_comment_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n where n.kind = 'comment' and not n.read and n.ref_id = old.id;
    return old;
  end if;
  update public.notifications n set detail = new.text
  where n.kind = 'comment' and n.ref_id = new.id and n.detail is distinct from new.text;
  return new;
end $$;

create trigger sync_comment_notifications after delete or update of text on public.comments
  for each row execute function public.sync_comment_notifications();

-- ---------------------------------------------------------------------------
-- Names: reactions keep a copy of the name; a name change updates those copies.

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
    new.kind := old.kind;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- The name only changes through sync_reaction_names (after a profile name change).
    if coalesce(current_setting('app.sync_names', true), '') <> 'on' then
      new.name := old.name;
    end if;
    -- Only the reacting organisation may change its own note.
    if public.my_org() is distinct from old.org and not public.is_coordinator() then
      new.note := old.note;
    end if;
  end if;
  return new;
end $$;

create or replace function public.sync_reaction_names() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name and coalesce(trim(new.name), '') <> '' then
    perform set_config('app.sync_names', 'on', true);
    update public.reactions r set name = new.name where r.created_by = new.user_id;
    perform set_config('app.sync_names', 'off', true);
  end if;
  return new;
end $$;

create trigger sync_reaction_names after update of name on public.profiles
  for each row execute function public.sync_reaction_names();
