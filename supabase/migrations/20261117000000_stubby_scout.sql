-- Stubby's scout: finds real New York things on the web and leaves them as City pick drafts.
--
-- Run AFTER 20261116000000_suggestion_events_start_logged.sql. Applied only with the founder's
-- written approval naming this file (CLAUDE.md).
--
-- The scout (Edge Function stubby-scout) runs when an admin asks it to, from the City picks
-- admin page. It never publishes: every pick it finds is a draft, and an admin reads it, checks
-- the source link and publishes it by hand. So the only new things here are:
--
--   1. city_picks: where a pick came from (found_by), the page it was found on (source_url),
--      when that page was read (checked_at) and anything the scout was unsure of (scout_note).
--      Every existing pick is an editor's pick. The existing RLS policies already cover these
--      columns: only admins write, signed-in people read published picks.
--   2. scout_runs: one row per run, admins only. The function counts these to keep to a daily
--      cap, and the admin page can show when the scout last ran.
--   3. A unique index so the same scout pick (same title, same start) is never saved twice,
--      even if two runs overlap.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261117000000_stubby_scout.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. city_picks: where a pick came from
-- ─────────────────────────────────────────────────────────────────────────
alter table public.city_picks
  add column found_by text not null default 'editor' check (found_by in ('editor', 'scout')),
  add column source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~* '^https://[^[:space:]]+$')),
  add column checked_at timestamptz,
  add column scout_note text check (scout_note is null or char_length(scout_note) between 1 and 200);

-- A scout pick always says where it was found and when.
alter table public.city_picks
  add constraint city_picks_scout_has_source check (found_by <> 'scout' or (source_url is not null and checked_at is not null));

create unique index city_picks_scout_once_idx
  on public.city_picks (city, lower(title), starts_at)
  where found_by = 'scout';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. scout_runs: one row per run, admins only
-- ─────────────────────────────────────────────────────────────────────────
create table public.scout_runs (
  id bigint generated always as identity primary key,
  city text not null default 'new-york' check (char_length(city) between 1 and 40),
  started_by uuid references auth.users (id) on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- What the admin asked for, if anything ("pottery, running"). Their own words.
  focus text check (focus is null or char_length(focus) <= 200),
  searches integer not null default 0 check (searches between 0 and 100),
  found integer not null default 0 check (found between 0 and 200),
  added integer not null default 0 check (added between 0 and 200),
  error text check (error is null or char_length(error) <= 300),
  check (finished_at is null or finished_at >= started_at)
);

create index scout_runs_started_idx on public.scout_runs (started_at desc);

alter table public.scout_runs enable row level security;

revoke all on public.scout_runs from public, anon, authenticated;
grant select, insert, update on public.scout_runs to authenticated;

create policy "admins read scout runs"
  on public.scout_runs for select to authenticated
  using (private.is_admin((select auth.uid())));

create policy "admins start scout runs"
  on public.scout_runs for insert to authenticated
  with check (
    private.is_admin((select auth.uid()))
    and scout_runs.started_by = (select auth.uid())
  );

create policy "admins finish scout runs"
  on public.scout_runs for update to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
