-- Stubby's scout, part 2: a daily sweep of a watch list, and members asking Stubby themselves.
--
-- Run AFTER 20261101155717_stubby_scout.sql. Applied only with the founder's written approval
-- naming this file (CLAUDE.md).
--
-- Decisions (founder, Nov 1, 2026):
--   - A scout pick that passes every check and has nothing to double check goes live by itself.
--     One with a note (no price listed, end unclear) waits for an admin. Admins can unpublish.
--   - A member can ask Stubby for something different. What he finds shows to that member at
--     once; the clean finds also go live for everyone, so every ask grows the list.
--   - A daily sweep, 3 asks a day per member.
--
-- What is here:
--   1. scout_watches: the watch list ("NYU events", "pottery classes"). Admins only.
--   2. city_picks.requested_by: the member whose ask found a pick. They can read it even while
--      it waits for review. Picks are still only written by the stubby-scout function (with the
--      service role) or by admins.
--   3. scout_runs.kind ('admin', 'sweep', 'member') and watch_id; started_by may be null for a
--      sweep. Members read their own runs (for "asks left today").
--   4. The sweep's token, made here and kept in Vault. The function asks
--      public.scout_sweep_token_ok() (service role only) whether a call carries it.
--   5. pg_net and a pg_cron job every 15 minutes from 5 to 9 AM New York time (09:00 to 13:45
--      UTC; an hour later in summer, still morning). Each call sweeps the one watch that has
--      waited longest and not run in 20 hours. The job does nothing until the Vault secret
--      'stubby_scout_url' (the function's address) is set, so staging stays quiet.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261101170000_stubby_scout_sweep.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. scout_watches
-- ─────────────────────────────────────────────────────────────────────────
create table public.scout_watches (
  id bigint generated always as identity primary key,
  city text not null default 'new-york' check (char_length(city) between 1 and 40),
  -- What the scout looks for, in the admin's words: "NYU events open to students".
  query text not null check (char_length(query) between 3 and 200),
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index scout_watches_query_idx on public.scout_watches (city, lower(query));

alter table public.scout_watches enable row level security;

revoke all on public.scout_watches from public, anon, authenticated;
grant select, insert, update, delete on public.scout_watches to authenticated;

create policy "admins read the watch list"
  on public.scout_watches for select to authenticated
  using (private.is_admin((select auth.uid())));

create policy "admins add to the watch list"
  on public.scout_watches for insert to authenticated
  with check (private.is_admin((select auth.uid())));

create policy "admins edit the watch list"
  on public.scout_watches for update to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "admins remove from the watch list"
  on public.scout_watches for delete to authenticated
  using (private.is_admin((select auth.uid())));

-- A starting list. Admins change it on the City picks page.
insert into public.scout_watches (query, created_by) values
  ('NYU events open to students and the public', null),
  ('NYC Parks free events, classes and group walks', null),
  ('New York Public Library free workshops and talks', null),
  ('Beginner pottery and ceramics classes', null),
  ('Run clubs and group runs', null),
  ('Free museum hours and gallery openings', null);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. city_picks.requested_by
-- ─────────────────────────────────────────────────────────────────────────
alter table public.city_picks
  add column requested_by uuid references auth.users (id) on delete set null;

create index city_picks_requested_by_idx on public.city_picks (requested_by, starts_at) where requested_by is not null;

drop policy "signed-in people read published picks, admins read all" on public.city_picks;

create policy "signed-in people read published picks, their own finds, admins read all"
  on public.city_picks for select to authenticated
  using (
    city_picks.published
    or city_picks.requested_by = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. scout_runs: kind and watch
-- ─────────────────────────────────────────────────────────────────────────
alter table public.scout_runs
  add column kind text not null default 'admin' check (kind in ('admin', 'sweep', 'member')),
  add column watch_id bigint references public.scout_watches (id) on delete set null;

create index scout_runs_member_idx on public.scout_runs (started_by, started_at desc) where kind = 'member';

drop policy "admins read scout runs" on public.scout_runs;

create policy "admins read scout runs, members read their own"
  on public.scout_runs for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or scout_runs.started_by = (select auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. The sweep's token
-- ─────────────────────────────────────────────────────────────────────────
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'stubby_scout_sweep_token', 'Sent by the scout sweep cron job; checked by public.scout_sweep_token_ok()')
where not exists (select 1 from vault.secrets s where s.name = 'stubby_scout_sweep_token');

create function public.scout_sweep_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ds.decrypted_secret = p_token
     from vault.decrypted_secrets ds
     where ds.name = 'stubby_scout_sweep_token'
       and char_length(coalesce(p_token, '')) = 64),
    false);
$$;

revoke all on function public.scout_sweep_token_ok(text) from public, anon, authenticated;
grant execute on function public.scout_sweep_token_ok(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. The schedule
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

create function private.scout_sweep_call()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  v_url := (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'stubby_scout_url');
  v_token := (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'stubby_scout_sweep_token');
  -- Not set up here (staging, or before the function is deployed): do nothing.
  if v_url is null or v_token is null then
    return;
  end if;
  -- Nothing waiting: don't wake the function.
  if not exists (
    select 1 from public.scout_watches w
    where w.active and (w.last_run_at is null or w.last_run_at < now() - interval '20 hours')
  ) then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-scout-sweep', v_token),
    body := '{"mode":"sweep"}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.scout_sweep_call() from public, anon, authenticated;

select cron.schedule(
  'stubby-scout-sweep',
  '*/15 9-13 * * *',
  $$select private.scout_sweep_call();$$
);

-- Check it
-- select jobname, schedule, active from cron.job where jobname = 'stubby-scout-sweep';
-- -- expect 1 row, active = true, schedule = '*/15 9-13 * * *'
-- Then run supabase/verification/stubby_scout_sweep_check.sql.
