-- Step 0 · Loop metrics + trimmed events table
--
-- BACKFILL: this file documents a migration that is already live
-- (recorded in supabase_migrations.schema_migrations as version
-- 20260928150922, name step0_loop_metrics) but was never committed to
-- this repo. Content reconstructed from the staged copy that was applied;
-- not re-run, not re-verified against a live pg_dump. See the repo audit
-- from Oct 1, 2026 for how this gap was found (CI's "Remote migration
-- versions not found in local migrations directory" check).
--
-- What this does
--   1. A private `metrics` schema of read-only views that compute the memo's
--      metrics from tables that already exist (profiles, posts, thoughts,
--      reactions). Nothing is logged by the app, so a failed page load can't
--      lose a data point.
--   2. A small `public.events` table only for what the database can't see:
--      edition opened (written by the app), invite link opened and email
--      sent/opened/clicked (written later by Edge Functions with the service key).
--
-- Definitions (from the memo)
--   moment           = a row in posts that isn't a Circle post (circle_id is null)
--   new user         = a non-admin profile; cohort = the week they signed up
--   first response   = the first WRITTEN thought (non-empty body) by someone else
--                      on a person's first moment. Reactions don't count.
--   team response    = a first response written by an admin
--   two-way exchange = someone else writes a thought on your moment and you then
--                      write a thought on the same moment (within your first 14 days)
--   noticed          = any reaction or thought by someone else within 24 hours
--
-- Who can read it
--   The metrics schema is not exposed through the API and gets no grants, so
--   only the database owner (SQL editor, Supabase MCP) can read it. An admin
--   screen can come later through an is_admin-checked function.

begin;

-- ── 1. Metrics schema ───────────────────────────────────────────────────────
create schema if not exists metrics;
revoke all on schema metrics from public, anon, authenticated;

-- One row per new (non-admin) user.
create view metrics.user_cohort as
with m as (
  select p.id as post_id, p.user_id, p.created_at
  from public.posts p
  where p.circle_id is null
)
select
  pr.id                                                    as user_id,
  pr.created_at                                            as signed_up_at,
  date_trunc('week', pr.created_at)::date                  as cohort_week,
  fm.first_moment_id,
  fm.first_moment_at,
  extract(epoch from fm.first_moment_at - pr.created_at)::int as seconds_to_first_moment,
  (select count(*) from m
    where m.user_id = pr.id
      and m.created_at < pr.created_at + interval '14 days')  as moments_d14,
  exists (select 1 from m
    where m.user_id = pr.id
      and m.created_at >= pr.created_at + interval '14 days'
      and m.created_at <  pr.created_at + interval '28 days') as active_d15_28,
  exists (
    select 1
    from public.thoughts o
    join public.posts p   on p.id = o.post_id and p.user_id = pr.id and p.circle_id is null
    join public.thoughts r on r.post_id = o.post_id
                          and r.user_id = pr.id
                          and r.created_at > o.created_at
    where o.user_id <> pr.id
      and nullif(btrim(o.body), '') is not null
      and nullif(btrim(r.body), '') is not null
      and r.created_at < pr.created_at + interval '14 days')  as had_two_way_d14,
  now() >= pr.created_at + interval '14 days'              as d14_complete,
  now() >= pr.created_at + interval '28 days'              as d28_complete
from public.profiles pr
left join lateral (
  select m.post_id as first_moment_id, m.created_at as first_moment_at
  from m
  where m.user_id = pr.id
  order by m.created_at, m.post_id
  limit 1
) fm on true
where not coalesce(pr.is_admin, false);

-- One row per new user who has added a first moment.
create view metrics.first_moment_responses as
select
  c.user_id,
  c.cohort_week,
  c.first_moment_id,
  c.first_moment_at,
  r.responder_id,
  r.responded_at,
  coalesce(r.responder_is_team, false)                      as responder_is_team,
  (r.responded_at is not null
    and r.responded_at <= c.first_moment_at + interval '24 hours') as responded_24h,
  exists (
    select 1 from public.thoughts t
    where t.post_id = c.first_moment_id
      and t.user_id = c.user_id
      and nullif(btrim(t.body), '') is not null
      and r.responded_at is not null
      and t.created_at >  r.responded_at
      and t.created_at <= r.responded_at + interval '48 hours') as replied_48h,
  exists (
    select 1 from public.posts p
    where p.user_id = c.user_id
      and p.circle_id is null
      and r.responded_at is not null
      and p.created_at >  r.responded_at
      and p.created_at <= r.responded_at + interval '7 days')  as moment_within_7d_of_response
from metrics.user_cohort c
left join lateral (
  select t.user_id as responder_id,
         t.created_at as responded_at,
         coalesce(pr.is_admin, false) as responder_is_team
  from public.thoughts t
  join public.profiles pr on pr.id = t.user_id
  where t.post_id = c.first_moment_id
    and t.user_id <> c.user_id
    and nullif(btrim(t.body), '') is not null
  order by t.created_at
  limit 1
) r on true
where c.first_moment_id is not null;

-- One row per moment: was it noticed by someone else within 24 hours?
create view metrics.moment_noticed as
select
  p.id                                  as post_id,
  p.user_id,
  p.created_at,
  date_trunc('week', p.created_at)::date as week,
  now() >= p.created_at + interval '24 hours' as window_complete,
  (exists (select 1 from public.reactions x
            where x.post_id = p.id and x.user_id <> p.user_id
              and x.created_at <= p.created_at + interval '24 hours')
   or exists (select 1 from public.thoughts t
            where t.post_id = p.id and t.user_id <> p.user_id
              and t.created_at <= p.created_at + interval '24 hours')) as noticed_24h
from public.posts p
where p.circle_id is null;

-- The memo's scoreboard, one row per signup week. Percentages only count
-- people whose measurement window has finished (null = not readable yet).
create view metrics.loop_summary as
select
  c.cohort_week,
  count(*)                                                        as new_users,
  count(*) filter (where c.first_moment_at is not null)           as added_first_moment,
  round((percentile_cont(0.5) within group (order by c.seconds_to_first_moment)
         filter (where c.seconds_to_first_moment is not null))::numeric / 60, 1)
                                                                  as median_minutes_to_first_moment,
  -- North star, its pair, the return check
  round(100.0 * count(*) filter (where c.d14_complete and c.moments_d14 >= 3)
        / nullif(count(*) filter (where c.d14_complete), 0), 1)   as north_star_pct,
  round(100.0 * count(*) filter (where c.d14_complete and c.moments_d14 >= 3 and c.had_two_way_d14)
        / nullif(count(*) filter (where c.d14_complete and c.moments_d14 >= 3), 0), 1)
                                                                  as pair_two_way_pct,
  round(100.0 * count(*) filter (where c.d28_complete and c.active_d15_28)
        / nullif(count(*) filter (where c.d28_complete), 0), 1)   as return_d15_28_pct,
  -- First response within 24h, split by who wrote it
  round(100.0 * count(*) filter (where f.responded_24h)
        / nullif(count(*) filter (where f.first_moment_at <= now() - interval '24 hours'), 0), 1)
                                                                  as first_response_24h_pct,
  round(100.0 * count(*) filter (where f.responded_24h and not f.responder_is_team)
        / nullif(count(*) filter (where f.first_moment_at <= now() - interval '24 hours'), 0), 1)
                                                                  as by_person_24h_pct,
  round(100.0 * count(*) filter (where f.responded_24h and f.responder_is_team)
        / nullif(count(*) filter (where f.first_moment_at <= now() - interval '24 hours'), 0), 1)
                                                                  as by_team_24h_pct,
  -- Leading indicator + the "added another moment" input
  round(100.0 * count(*) filter (where f.replied_48h)
        / nullif(count(*) filter (where f.responded_at <= now() - interval '48 hours'), 0), 1)
                                                                  as replied_to_first_response_48h_pct,
  round(100.0 * count(*) filter (where f.moment_within_7d_of_response)
        / nullif(count(*) filter (where f.responded_at <= now() - interval '7 days'), 0), 1)
                                                                  as moment_within_7d_of_response_pct
from metrics.user_cohort c
left join metrics.first_moment_responses f on f.user_id = c.user_id
group by c.cohort_week
order by c.cohort_week desc;

-- Weekly: share of moments noticed within 24 hours.
create view metrics.noticed_weekly as
select
  week,
  count(*)                                                        as moments,
  round(100.0 * count(*) filter (where window_complete and noticed_24h)
        / nullif(count(*) filter (where window_complete), 0), 1)  as noticed_24h_pct
from metrics.moment_noticed
group by week
order by week desc;

revoke all on all tables in schema metrics from public, anon, authenticated;

-- ── 2. Trimmed events table ─────────────────────────────────────────────────
create table public.events (
  id         bigint generated always as identity primary key,
  name       text not null check (name in (
               'edition_opened',       -- app, signed in
               'invite_link_opened',   -- Edge Function (Step 2)
               'email_sent',           -- Edge Function (Step 4+)
               'email_opened',         -- email provider webhook → Edge Function
               'email_clicked')),      -- email provider webhook → Edge Function
  user_id    uuid references public.profiles(id) on delete set null,
  props      jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);

create index events_name_created_idx on public.events (name, created_at desc);
create index events_user_created_idx on public.events (user_id, created_at desc);

alter table public.events enable row level security;

-- The app may only record "edition opened" for the signed-in person.
-- Everything else is written by Edge Functions with the service key (bypasses RLS).
create policy events_insert_own_edition_open on public.events
  for insert to authenticated
  with check (user_id = auth.uid() and name = 'edition_opened');

create policy events_admin_read on public.events
  for select to authenticated
  using (private.is_admin(auth.uid()));

revoke all on public.events from anon;
revoke update, delete, truncate, references, trigger on public.events from authenticated;
grant insert, select on public.events to authenticated;

commit;
