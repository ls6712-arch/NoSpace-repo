-- Stubby, part 2: he restocks New York every morning, and anyone can ask him for something different.
--
-- Run AFTER 20261101155717_stubby_scout.sql. Applied only with the founder's written approval
-- naming this file (CLAUDE.md). Decisions (founder, Nov 1, 2026): restock daily for the next
-- 7 days; finds from trusted sources publish themselves, everything else waits as a draft;
-- what Stubby finds for one person is theirs first and then shared after a check; 3 asks a
-- person a day.
--
--   1. scout_sources: where the daily restock looks. Admins only. A source can name a site to
--      search (search_domain) and a host whose pages publish without review (trusted_host).
--   2. scout_runs: kind (admin, scheduled), and for a scheduled run its source and New York day.
--      A unique index means each source is searched at most once a day, however often the
--      schedule (or anyone else) calls the function.
--   3. personal_picks: what Stubby found for one person when they asked. Only they can read or
--      remove them. Deleted two days after they happen. Nothing here says what they asked.
--   4. stubby_asks: one row per ask, for the 3 a day limit. No text of the ask is stored.
--   5. claim_scout_source() and claim_stubby_ask(): the only way the function takes a turn.
--      Both lock, check and record in one step, so two calls at once can't both slip past a
--      limit. Only the server (service_role) can run them.
--   6. pg_net, and three cron jobs: the morning restock calls, and a nightly clean up.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261101180000_stubby_daily_and_ask.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. scout_sources
-- ─────────────────────────────────────────────────────────────────────────
create table public.scout_sources (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  -- What to look for, in plain words ("free events at New York Public Library branches").
  focus text not null check (char_length(focus) between 1 and 200),
  -- Search only this site (and its subdomains). Null: the whole web.
  search_domain text check (search_domain is null or search_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  -- Pages on this host (or its subdomains) publish without review. Null: everything is a draft.
  trusted_host text check (trusted_host is null or trusted_host ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.scout_sources enable row level security;
revoke all on public.scout_sources from public, anon, authenticated;
grant select, insert, update, delete on public.scout_sources to authenticated;

create policy "admins read sources" on public.scout_sources for select to authenticated
  using (private.is_admin((select auth.uid())));
create policy "admins add sources" on public.scout_sources for insert to authenticated
  with check (private.is_admin((select auth.uid())));
create policy "admins edit sources" on public.scout_sources for update to authenticated
  using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));
create policy "admins remove sources" on public.scout_sources for delete to authenticated
  using (private.is_admin((select auth.uid())));

insert into public.scout_sources (name, focus, search_domain, trusted_host) values
  ('NYU events', 'NYU events in New York City that students or the public can go to: talks, workshops, performances, clubs, sports', 'nyu.edu', 'events.nyu.edu'),
  ('NYC Parks', 'NYC Parks events: free classes, walks, tours, sports, fitness and outdoor activities', 'nycgovparks.org', 'nycgovparks.org'),
  ('New York Public Library', 'free events at New York Public Library branches: classes, workshops, book clubs, talks', 'nypl.org', 'nypl.org'),
  ('Brooklyn Public Library', 'free events at Brooklyn Public Library branches: classes, workshops, book clubs, talks', 'bklynlibrary.org', 'bklynlibrary.org'),
  ('Around the city', 'a varied mix of classes, workshops, club meetups, runs, walks, open studios and markets across New York City, some free and some evening', null, null);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. scout_runs: kind, source, day
-- ─────────────────────────────────────────────────────────────────────────
alter table public.scout_runs
  add column kind text not null default 'admin' check (kind in ('admin', 'scheduled')),
  add column source_id bigint references public.scout_sources (id) on delete set null,
  add column run_day date,
  add constraint scout_runs_scheduled_has_day check (kind <> 'scheduled' or run_day is not null);

create unique index scout_runs_source_once_a_day_idx
  on public.scout_runs (source_id, run_day)
  where kind = 'scheduled';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. personal_picks
-- ─────────────────────────────────────────────────────────────────────────
create table public.personal_picks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  place text check (place is null or char_length(place) <= 80),
  starts_at timestamptz not null,
  ends_at timestamptz,
  price text check (price is null or char_length(price) between 1 and 40),
  url text not null check (char_length(url) <= 500 and url ~* '^https://[^[:space:]]+$'),
  corner_id bigint references public.corners (id) on delete set null,
  note text check (note is null or char_length(note) between 1 and 200),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create unique index personal_picks_once_idx on public.personal_picks (user_id, lower(title), starts_at);
create index personal_picks_user_starts_idx on public.personal_picks (user_id, starts_at);

alter table public.personal_picks enable row level security;
revoke all on public.personal_picks from public, anon, authenticated;
grant select, delete on public.personal_picks to authenticated;

create policy "you read your picks" on public.personal_picks for select to authenticated
  using (personal_picks.user_id = (select auth.uid()));
create policy "you remove your picks" on public.personal_picks for delete to authenticated
  using (personal_picks.user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. stubby_asks
-- ─────────────────────────────────────────────────────────────────────────
create table public.stubby_asks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  asked_at timestamptz not null default now(),
  found integer not null default 0 check (found between 0 and 200),
  added integer not null default 0 check (added between 0 and 200),
  failed boolean not null default false
);

create index stubby_asks_user_asked_idx on public.stubby_asks (user_id, asked_at desc);
create index stubby_asks_asked_idx on public.stubby_asks (asked_at desc);

alter table public.stubby_asks enable row level security;
revoke all on public.stubby_asks from public, anon, authenticated;
grant select on public.stubby_asks to authenticated;

-- You can see your own, so the app can say how many asks are left today.
create policy "you read your asks" on public.stubby_asks for select to authenticated
  using (stubby_asks.user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Taking a turn: one lock, one check, one row
-- ─────────────────────────────────────────────────────────────────────────

-- The next enabled source not yet searched today (New York day), recorded as a run. Null when
-- every source has had its turn today.
create function public.claim_scout_source()
returns table (run_id bigint, source_id bigint, name text, focus text, search_domain text, trusted_host text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/New_York')::date;
  v_source bigint;
  v_run bigint;
begin
  perform pg_advisory_xact_lock(hashtext('claim_scout_source'));
  v_source := (
    select s.id
    from public.scout_sources s
    where s.enabled
      and not exists (
        select 1 from public.scout_runs r
        where r.kind = 'scheduled' and r.source_id = s.id and r.run_day = v_day
      )
    order by s.id
    limit 1
  );
  if v_source is null then
    return;
  end if;
  insert into public.scout_runs (kind, source_id, run_day, started_by, focus)
  values ('scheduled', v_source, v_day, null, left((select s.focus from public.scout_sources s where s.id = v_source), 200))
  returning scout_runs.id into v_run;
  return query
    select v_run, s.id, s.name, s.focus, s.search_domain, s.trusted_host
    from public.scout_sources s
    where s.id = v_source;
end;
$$;

-- Records an ask for this person if they have had fewer than p_per_user in the last 24 hours
-- and everyone together fewer than p_global. Returns the ask's id, or null when over a limit.
create function public.claim_stubby_ask(p_user uuid, p_per_user integer, p_global integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('claim_stubby_ask'));
  if (select count(*) from public.stubby_asks a where a.user_id = p_user and a.asked_at > now() - interval '24 hours') >= p_per_user then
    return null;
  end if;
  if (select count(*) from public.stubby_asks a where a.asked_at > now() - interval '24 hours') >= p_global then
    return null;
  end if;
  insert into public.stubby_asks (user_id) values (p_user) returning stubby_asks.id into v_id;
  return v_id;
end;
$$;

revoke all on function public.claim_scout_source() from public, anon, authenticated;
revoke all on function public.claim_stubby_ask(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_scout_source() to service_role;
grant execute on function public.claim_stubby_ask(uuid, integer, integer) to service_role;

-- Two days after a personal pick happens it is gone; asks are kept 30 days for the limit and
-- the costs, then gone.
create function private.purge_stubby_rows()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.personal_picks p where coalesce(p.ends_at, p.starts_at) < now() - interval '2 days';
  delete from public.stubby_asks a where a.asked_at < now() - interval '30 days';
$$;

revoke all on function private.purge_stubby_rows() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. The schedule
-- ─────────────────────────────────────────────────────────────────────────
-- Every 10 minutes from 09:00 to 10:50 UTC (4 to 6 in the morning in New York), the restock is
-- called. Each call searches the next source due today and returns; once every source has had
-- its turn, calls do nothing. The function needs no key for this: the once-a-day rule above is
-- what keeps it to one search per source per day, whoever calls it.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'stubby-restock',
  '*/10 9-10 * * *',
  $cron$select net.http_post(
    url := 'https://eyzokuhhbyidvmuqfmwm.supabase.co/functions/v1/stubby-scout',
    body := '{"mode":"restock"}'::jsonb,
    headers := '{"content-type":"application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );$cron$
);

select cron.schedule(
  'purge-stubby-rows',
  '15 4 * * *',
  $cron$select private.purge_stubby_rows();$cron$
);

-- Check it
-- select jobname, schedule, active from cron.job where jobname in ('stubby-restock', 'purge-stubby-rows');
-- -- expect 2 rows, both active
