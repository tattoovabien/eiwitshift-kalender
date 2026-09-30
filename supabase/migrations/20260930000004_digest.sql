-- Monthly digest: the coordinators' choice to send it automatically, a log of what went out,
-- and a pg_cron job that asks the digest function whether it is time.

create extension if not exists pg_cron with schema pg_catalog;

-- One row. Off by default: nothing leaves until a coordinator switches it on.
create table public.digest_settings (
  id boolean primary key default true check (id),
  auto_send boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.digest_settings (id) values (true);

-- Every digest that went out (written by the digest function only).
create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('auto', 'manual')),
  -- The month ('yyyy-mm') an automatic digest was for: at most one per month.
  period text,
  sent_by uuid,
  sent_by_name text,
  subject text,
  -- Null while it is being sent.
  recipients int,
  created_at timestamptz not null default now()
);
create unique index digest_runs_one_auto_per_month on public.digest_runs (period) where kind = 'auto';
create index on public.digest_runs (created_at desc);

create or replace function public.guard_digest_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.id := true;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

create trigger guard_digest_settings before update on public.digest_settings
  for each row execute function public.guard_digest_settings();

alter table public.digest_settings enable row level security;
alter table public.digest_runs enable row level security;

create policy "coordinators read digest settings" on public.digest_settings
  for select to authenticated using (public.is_coordinator());
create policy "coordinators change digest settings" on public.digest_settings
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "coordinators read digest runs" on public.digest_runs
  for select to authenticated using (public.is_coordinator());

-- Runs every hour on days 1 to 7. Only when the setting is on and this month's automatic digest
-- did not leave yet, it calls the digest function, which decides (src/lib/digestSchedule.ts) whether it is time.
create or replace function private.run_auto_digest() returns void
language plpgsql security definer set search_path = '' as $$
declare
  fn_url text := (select s.value from private.settings s where s.key = 'functions_url');
begin
  if fn_url is null or not coalesce((select d.auto_send from public.digest_settings d), false) then
    return;
  end if;
  if exists (
    select 1 from public.digest_runs r
    where r.kind = 'auto' and r.period = to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM')
  ) then
    return;
  end if;
  perform net.http_post(
    url := fn_url || '/digest',
    body := '{"auto": true}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

select cron.schedule('eiwitshift-digest', '5 * 1-7 * *', 'select private.run_auto_digest()');
