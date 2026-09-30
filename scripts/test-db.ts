// Runs the Supabase migrations in an in-memory Postgres (PGlite) with small stubs for the
// Supabase bits (auth.users, auth.uid(), pg_net, API roles) and checks the access rules as
// different users. Run: npx tsx scripts/test-db.ts
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failures = 0;
let passes = 0;

function check(name: string, ok: boolean, info?: unknown) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`✘ ${name}`, info ?? '');
  }
}

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text not null);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema net;
  create table net.calls (id serial primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as
    $$ insert into net.calls (url, body) values (url, body) returning id::bigint $$;
  create schema cron;
  create table cron.job (jobid serial primary key, jobname text unique, schedule text, command text);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as
    $$ insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
       on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
       returning jobid::bigint $$;
`;

const GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;
`;

async function exec(sql: string) {
  await db.exec(sql);
}

/** Run a query as a given user (null = not logged in). Returns rows, or the error message. */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try {
    const res = await db.query<T>(sql, params);
    return { rows: res.rows, affected: res.affectedRows ?? 0, error: null as string | null };
  } catch (e) {
    return { rows: [] as T[], affected: 0, error: (e as Error).message };
  } finally {
    await exec('reset role;');
  }
}

async function newUser(email: string): Promise<string> {
  await exec('reset role;');
  const r = await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email]);
  return r.rows[0].id;
}

async function admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await exec('reset role;');
  return (await db.query<T>(sql, params)).rows;
}

async function main() {
  await exec(STUBS);
  for (const f of readdirSync('supabase/migrations').sort()) {
    let sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    sql = sql.replace(/create extension if not exists pg_net;/i, '').replace(/create extension if not exists pg_cron[^;]*;/i, '');
    await exec(sql);
  }
  await exec(GRANTS);
  await admin(`insert into private.settings values ('functions_url', 'https://test.supabase.co/functions/v1')`);

  // --- seed
  const moments = await admin<{ n: number }>('select count(*)::int as n from public.moments');
  check('seed: 25 moments', moments[0].n === 25, moments);
  const seedNotifs = await admin<{ n: number }>('select count(*)::int as n from public.notifications');
  check('seed: no notifications', seedNotifs[0].n === 0, seedNotifs);
  const budget = await admin<{ created_by_org: string; owner_orgs: string[] }>(
    `select created_by_org, owner_orgs from public.moments where id = 'm-on-a-budget'`,
  );
  check('seed keeps created_by_org + owner_orgs', budget[0].created_by_org === 'Lidl' && budget[0].owner_orgs.join() === 'Lidl,ProVeg', budget);

  // --- first user becomes coordinator
  const lucas = await newUser('Lucas@Example.org');
  let p = await admin<{ status: string; is_coordinator: boolean; email: string }>('select * from public.profiles where user_id = $1', [lucas]);
  check('first user is active coordinator', p[0].status === 'active' && p[0].is_coordinator && p[0].email === 'lucas@example.org', p);
  let r = await as(lucas, `update public.profiles set name = 'Lucas', org = 'Plant-Based Universities' where user_id = '${lucas}'`);
  check('coordinator sets own org', !r.error && r.affected === 1, r);

  // --- access rules
  r = await as(lucas, `insert into public.access_rules (pattern, org, is_coordinator) values
    ('enya@vlaanderen.example', 'Departement Omgeving', true), ('@proveg.example', 'ProVeg', false)`);
  check('coordinator adds access rules', !r.error, r);

  const enya = await newUser('enya@vlaanderen.example');
  const proveg = await newUser('iemand@proveg.example');
  const lidl = await newUser('iemand@lidl.example');
  p = await admin('select email, status, org, is_coordinator from public.profiles order by email');
  const byEmail = Object.fromEntries(p.map((x) => [x.email, x]));
  check('exact rule → coordinator Omgeving', byEmail['enya@vlaanderen.example'].status === 'active' && byEmail['enya@vlaanderen.example'].is_coordinator === true, byEmail);
  check('domain rule → active ProVeg partner', byEmail['iemand@proveg.example'].org === 'ProVeg' && !byEmail['iemand@proveg.example'].is_coordinator, byEmail);
  check('unknown address → pending', byEmail['iemand@lidl.example'].status === 'pending', byEmail);
  const req = await admin(`select * from public.notifications where kind = 'access_request'`);
  check('access request notifies coordinators', req.length === 1 && req[0].to_coordinators === true && req[0].detail === 'iemand@lidl.example', req);

  // --- anonymous visitors
  r = await as(null, 'select * from public.moments');
  check('anon cannot read moments table', r.rows.length === 0, r);
  r = await as(null, 'select * from public.public_moments');
  check('anon reads public view (titles + dates)', r.rows.length === 25 && !('organiser' in (r.rows[0] as object)), r.rows[0]);
  r = await as(null, `insert into public.moments (title, type, target_group, focus, organiser, owner_orgs) values ('x','Event','Breed','halfhalf','X', '{X}')`);
  check('anon cannot add moments', !!r.error, r);
  r = await as(null, 'select * from public.profiles');
  check('anon cannot read profiles', r.rows.length === 0, r);

  // --- pending user
  r = await as(lidl, 'select * from public.moments');
  check('pending user sees no moments', r.rows.length === 0, r);
  r = await as(lidl, `update public.profiles set status = 'active', is_coordinator = true, org = 'Lidl', name = 'Iemand', requested_org = 'Lidl' where user_id = '${lidl}'`);
  p = await admin('select status, is_coordinator, org, name, requested_org from public.profiles where user_id = $1', [lidl]);
  check('pending user cannot promote self, can set name/requested org', p[0].status === 'pending' && !p[0].is_coordinator && p[0].org === null && p[0].name === 'Iemand' && p[0].requested_org === 'Lidl', p);
  r = await as(proveg, `update public.profiles set status = 'active', org = 'Lidl' where user_id = '${lidl}'`);
  check('partner cannot approve others', r.affected === 0, r);
  r = await as(enya, `update public.profiles set status = 'active', org = 'Lidl' where user_id = '${lidl}'`);
  check('coordinator approves', !r.error && r.affected === 1, r);

  // --- moments
  r = await as(proveg, `insert into public.moments (id, title, start_date, type, target_group, focus, organiser, owner_orgs, featured)
    values ('m-test', 'Kookworkshop', '2027-03-04', 'Workshop', 'Hoger onderwijs', '100% plantaardig', 'ProVeg', '{ProVeg}', true)`);
  check('partner adds own moment', !r.error, r);
  const mt = await admin('select featured, created_by_org, created_by from public.moments where id = $1', ['m-test']);
  check('partner cannot feature; created_by filled', mt[0].featured === false && mt[0].created_by_org === 'ProVeg' && mt[0].created_by === proveg, mt);
  const nm = await admin(`select * from public.notifications where kind = 'new_moment'`);
  check('new moment notifies coordinators', nm.length === 1 && nm[0].from_org === 'ProVeg', nm);
  const calls = await admin<{ url: string }>('select url from net.calls');
  check('notifications are queued for e-mail', calls.length === 2 && calls.every((c) => c.url === 'https://test.supabase.co/functions/v1/notify'), calls);

  r = await as(proveg, `insert into public.moments (title, type, target_group, focus, organiser, owner_orgs) values ('x','Event','Breed','halfhalf','VLAM','{VLAM}')`);
  check('partner cannot add moment for another org', !!r.error, r);
  r = await as(lidl, `update public.moments set title = 'Gehackt' where id = 'm-test'`);
  check('partner cannot edit another org’s moment', r.affected === 0, r);
  r = await as(lidl, `delete from public.moments where id = 'm-test'`);
  check('partner cannot delete another org’s moment', r.affected === 0, r);
  r = await as(proveg, `update public.moments set title = 'Kookworkshop op kot', featured = true where id = 'm-on-a-budget'`);
  check('co-organiser can edit', r.affected === 1, r);
  const ob = await admin(`select featured, updated_at, created_by_org from public.moments where id = 'm-on-a-budget'`);
  check('…but cannot feature it, and history is kept', ob[0].featured === false && ob[0].updated_at !== null && ob[0].created_by_org === 'Lidl', ob);
  r = await as(proveg, `update public.moments set owner_orgs = '{VLAM}' where id = 'm-test'`);
  check('partner cannot hand a moment away entirely', !!r.error, r);
  r = await as(enya, `update public.moments set featured = true where id = 'm-test'`);
  check('coordinator can feature', r.affected === 1, r);

  // --- reactions
  r = await as(lidl, `insert into public.reactions (id, moment_id, kind, org) values ('r-1', 'm-test', 'join', 'ProVeg')`);
  const rx = await admin(`select org, name from public.reactions where id = 'r-1'`);
  check('reaction is always in your own org', !r.error && rx[0].org === 'Lidl', { r, rx });
  let n = await as(proveg, `select * from public.notifications where kind = 'reaction'`);
  check('organiser sees reaction notification', n.rows.length === 1 && (n.rows[0] as { from_org: string }).from_org === 'Lidl', n);
  n = await as(lidl, `select * from public.notifications where kind = 'reaction'`);
  check('reacting partner does not see it', n.rows.length === 0, n);
  r = await as(lidl, `insert into public.reactions (moment_id, kind) values ('m-test', 'join')`);
  check('no double reaction', !!r.error, r);
  r = await as(lidl, `delete from public.reactions where id = 'r-1'`);
  n = await as(proveg, `select * from public.notifications where kind = 'reaction'`);
  check('withdrawing removes unread notification', r.affected === 1 && n.rows.length === 0, n);
  await as(lidl, `insert into public.reactions (id, moment_id, kind) values ('r-2', 'm-test', 'join')`);
  r = await as(proveg, `update public.reactions set in_contact = true, note = 'hacked' where id = 'r-2'`);
  const r2 = await admin(`select in_contact, note from public.reactions where id = 'r-2'`);
  check('organiser toggles contact but cannot change note', r.affected === 1 && r2[0].in_contact === true && r2[0].note === null, r2);
  r = await as(lidl, `update public.reactions set note = 'Promo in de winkels' where id = 'r-2'`);
  check('reacting partner edits own note', r.affected === 1, r);
  r = await as(lucas, `update public.reactions set note = 'x' where id = 'r-2'`);
  check('coordinator may edit notes', r.affected === 1, r);
  r = await as(proveg, `delete from public.reactions where id = 'r-2'`);
  check('organiser cannot delete someone else’s reaction', r.affected === 0, r);

  // --- comments
  await as(lucas, `insert into public.comments (moment_id, text) values ('m-test', 'Mogen we flyers leggen?')`);
  n = await as(proveg, `select * from public.notifications where kind = 'comment'`);
  check('comment notifies organiser', n.rows.length === 1 && (n.rows[0] as { from_org: string }).from_org === 'Plant-Based Universities', n);
  await as(proveg, `insert into public.comments (moment_id, text, org) values ('m-test', 'Zeker!', 'Lidl')`);
  const cm = await admin(`select org from public.comments where text = 'Zeker!'`);
  check('comment org is forced to own org', cm[0].org === 'ProVeg', cm);
  n = await as(lucas, `select * from public.notifications where kind = 'comment' and to_org = 'Plant-Based Universities'`);
  check('earlier commenters get notified of replies', n.rows.length === 1, n);

  // --- signals
  await as(lidl, `insert into public.signals (moment_id, kind, note, anonymous, from_org) values ('m-test', 'Slechte timing', 'Examenperiode', true, 'Lidl')`);
  const sg = await admin('select from_org from public.signals');
  check('anonymous signal stores no organisation', sg.length === 1 && sg[0].from_org === null, sg);
  r = await as(lidl, 'select * from public.signals');
  check('partners cannot read signals', r.rows.length === 0, r);
  r = await as(proveg, 'select * from public.signals');
  check('organiser cannot read signals', r.rows.length === 0, r);
  r = await as(enya, 'select * from public.signals');
  check('coordinator reads signals', r.rows.length === 1, r);
  n = await as(enya, `select * from public.notifications where kind = 'signal'`);
  check('signal notifies coordinators as Anoniem', n.rows.length === 1 && (n.rows[0] as { from_org: string }).from_org === 'Anoniem', n);
  n = await as(proveg, `select * from public.notifications where kind = 'signal'`);
  check('partner does not see signal notification', n.rows.length === 0, n);
  await as(proveg, `insert into public.signals (moment_id, kind, anonymous) values ('m-test', 'Andere bezorgdheid', false)`);
  const sg2 = await admin(`select from_org from public.signals where kind = 'Andere bezorgdheid'`);
  check('named signal stores own org', sg2[0].from_org === 'ProVeg', sg2);

  // --- notifications: read state
  r = await as(proveg, `update public.notifications set read = true`);
  const unreadForOthers = await admin<{ n: number }>(`select count(*)::int as n from public.notifications where read and to_org is distinct from 'ProVeg'`);
  check('mark-all-read only touches your own notifications', r.affected > 0 && unreadForOthers[0].n === 0, { r, unreadForOthers });

  // --- fields
  r = await as(proveg, `insert into public.field_defs (name, type) values ('x', 'text')`);
  check('partner cannot add fields', !!r.error, r);
  r = await as(proveg, `select public.remove_field('f-taal')`);
  check('partner cannot remove fields', !!r.error, r);
  r = await as(enya, `select public.remove_field('f-taal')`);
  const cf = await admin<{ n: number }>(`select count(*)::int as n from public.moments where custom_fields ? 'f-taal'`);
  check('coordinator removes field and its values', !r.error && cf[0].n === 0, { r, cf });

  // --- profiles
  r = await as(proveg, 'select * from public.profiles');
  check('partner only sees own profile', r.rows.length === 1, r.rows.length);
  r = await as(enya, 'select * from public.profiles');
  check('coordinator sees all profiles', r.rows.length === 4, r.rows.length);
  r = await as(proveg, `update public.profiles set feed_token = gen_random_uuid() where user_id = '${proveg}'`);
  const tokenSame = await admin<{ n: number }>(`select count(distinct feed_token)::int as n from public.profiles`);
  check('feed token cannot be changed by the user', tokenSame[0].n === 4, tokenSame);
  r = await as(proveg, 'select * from public.access_rules');
  check('partners cannot read access rules', r.rows.length === 0, r);

  // --- ref_id on every kind of notification
  const refs = await admin<{ kind: string; missing: number }>(
    `select kind, count(*) filter (where ref_id is null)::int as missing from public.notifications
     where kind in ('reaction','comment','new_moment','signal') group by kind order by kind`,
  );
  check('every notification points at what happened (ref_id)', refs.length === 4 && refs.every((r) => r.missing === 0), refs);
  const sigRef = await admin<{ ok: boolean }>(
    `select exists (select 1 from public.notifications n join public.signals s on s.id = n.ref_id where n.kind = 'signal') as ok`,
  );
  check('signal notification ref_id finds the signal (for its note)', sigRef[0].ok, sigRef);

  // --- editing and deleting comments
  await as(lucas, `insert into public.comments (id, moment_id, text) values ('c-own', 'm-test', 'Eerste versie')`);
  r = await as(proveg, `update public.comments set text = 'Gekaapt' where id = 'c-own'`);
  check('someone else cannot edit my comment', r.affected === 0, r);
  r = await as(lucas, `update public.comments set text = 'Tweede versie', org = 'ProVeg', moment_id = 'm-smos' where id = 'c-own'`);
  const ce = await admin(`select text, org, moment_id, edited_at from public.comments where id = 'c-own'`);
  check('author edits text; org/moment stay; edited_at set', r.affected === 1 && ce[0].text === 'Tweede versie' && ce[0].org === 'Plant-Based Universities' && ce[0].moment_id === 'm-test' && ce[0].edited_at !== null, ce);
  n = await as(proveg, `select detail from public.notifications where ref_id = 'c-own'`);
  check('edit updates the notification text', n.rows.length === 1 && (n.rows[0] as { detail: string }).detail === 'Tweede versie', n);
  r = await as(proveg, `delete from public.comments where id = 'c-own'`);
  check('organiser cannot delete someone else’s comment', r.affected === 0, r);
  r = await as(enya, `delete from public.comments where id = 'c-own'`);
  n = await as(proveg, `select * from public.notifications where ref_id = 'c-own'`);
  check('coordinator deletes a comment; unread notification goes too', r.affected === 1 && n.rows.length === 0, { r, n });
  await as(proveg, `insert into public.comments (id, moment_id, text) values ('c-pv', 'm-test', 'Van ProVeg')`);
  r = await as(proveg, `delete from public.comments where id = 'c-pv'`);
  check('author deletes own comment', r.affected === 1, r);

  // --- a name change reaches earlier reactions, but a reaction's name cannot be edited directly
  r = await as(lidl, `update public.reactions set name = 'Hacker' where id = 'r-2'`);
  let rn = await admin<{ name: string }>(`select name from public.reactions where id = 'r-2'`);
  check('reaction name cannot be changed directly', rn[0].name !== 'Hacker', rn);
  r = await as(lidl, `update public.profiles set name = 'Nieuwe Naam' where user_id = '${lidl}'`);
  rn = await admin<{ name: string }>(`select name from public.reactions where created_by = '${lidl}'`);
  check('name change updates my reactions', r.affected === 1 && rn.length > 0 && rn.every((x) => x.name === 'Nieuwe Naam'), rn);

  // --- monthly digest: the setting, the log and the hourly job
  const job = await admin<{ schedule: string; command: string }>(`select schedule, command from cron.job where jobname = 'eiwitshift-digest'`);
  check('cron job for the automatic digest', job.length === 1 && job[0].command.includes('private.run_auto_digest'), job);
  let ds = await as(enya, 'select auto_send from public.digest_settings');
  check('digest setting exists and is off', ds.rows.length === 1 && ds.rows[0].auto_send === false, ds);
  ds = await as(proveg, 'select * from public.digest_settings');
  check('partner cannot read the digest setting', ds.rows.length === 0 && !ds.error, ds);
  r = await as(proveg, 'update public.digest_settings set auto_send = true');
  check('partner cannot switch the automatic digest on', r.affected === 0, r);
  const digestCalls = async () =>
    (await admin<{ n: number }>(`select count(*)::int as n from net.calls where url = 'https://test.supabase.co/functions/v1/digest'`))[0].n;
  await admin('select private.run_auto_digest()');
  check('job does not call the digest function while switched off', (await digestCalls()) === 0);
  r = await as(enya, 'update public.digest_settings set auto_send = true');
  const setting = await admin<{ auto_send: boolean; updated_by: string }>('select auto_send, updated_by from public.digest_settings');
  check('coordinator switches the automatic digest on', r.affected === 1 && setting[0].auto_send && setting[0].updated_by === enya, setting);
  await admin('select private.run_auto_digest()');
  const body = await admin<{ body: { auto?: boolean } }>(`select body from net.calls where url like '%/digest' order by id desc limit 1`);
  check('job calls the digest function when switched on', (await digestCalls()) === 1 && body[0]?.body.auto === true, body);
  await admin(`insert into public.digest_runs (kind, period, recipients) values ('auto', to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM'), 3)`);
  await admin('select private.run_auto_digest()');
  check('no call once this month’s automatic digest went out', (await digestCalls()) === 1);
  let twice: string | null = null;
  try {
    await admin(`insert into public.digest_runs (kind, period) values ('auto', to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM'))`);
  } catch (e) {
    twice = (e as Error).message;
  }
  check('at most one automatic digest per month', !!twice && /unique|duplicate/i.test(twice), twice);
  r = await as(proveg, 'select * from public.digest_runs');
  check('partner cannot read the digest log', r.rows.length === 0 && !r.error, r);
  r = await as(enya, 'select * from public.digest_runs');
  check('coordinator reads the digest log', r.rows.length === 1, r);
  r = await as(enya, `insert into public.digest_runs (kind, recipients) values ('manual', 99)`);
  check('digest log cannot be written through the API', !!r.error, r);

  // --- blocked user
  await as(enya, `update public.profiles set status = 'blocked' where user_id = '${lidl}'`);
  r = await as(lidl, 'select * from public.moments');
  check('blocked user loses access', r.rows.length === 0, r);

  console.log(`\n${failures ? '✘' : '✔'} ${passes} geslaagd, ${failures} mislukt`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
