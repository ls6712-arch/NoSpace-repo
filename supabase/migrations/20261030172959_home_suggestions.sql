-- Home v2, PR 1 of 2: the suggestion engine.
--
--   public.home_suggestions(p_limit)   ranked things to do in the next 7 days for the
--                                      caller: events in open Spaces and open Pursuits
--                                      with room. Reads only the caller's own private
--                                      data (picks, free windows, area, budget, passes).
--   app_config 'home_ranking_v1'       every weight, cap and the pass-to-Corner map. The
--                                      function reads them from here, so a weight is
--                                      changed by an admin editing one row. (app_config
--                                      is publicly readable, so the weights are too.)
--   public.suggestion_events           what was shown and what the person did with it,
--                                      so the ranking can learn. Owner-only read; rows
--                                      are written only by log_suggestion_event().
--   public.purge_suggestion_events()   deletes rows older than 90 days (app_config
--                                      home_ranking_v1 'log_retention_days'). Scheduled
--                                      nightly at 03:45 UTC with pg_cron, the same way as
--                                      purge-deleted-accounts (20261103000000).
--   public.log_suggestion_event(...)   the one way in; user_id always comes from auth.uid().
--
-- What it returns (one row per suggestion, best first): kind ('event' or 'open_pursuit';
-- 'friend_pursuit' is not offered in v1), ref_id (the event id or Pursuit id, as text),
-- corner_key, starts_at, place_label, score, reasons (up to 2 reason codes, strongest
-- first: fits_window, picked, affinity, friend_going, nearby, trending, pass, soon),
-- and for the words on the card: title, space_slug, friend_name (a first name, only when
-- reasons has friend_going) and pass_kind (only when reasons has pass). Never a price,
-- a count of people, or another person's private data.
--
-- Friends going: the number of followed people who are going always counts toward the
-- score, but a friend is NAMED (friend_name, and the friend_going reason) only where the
-- caller could already see that person's place. For an event that means the caller is an
-- active member of the event's Space, the rule of the event_rsvps read policy
-- (public.is_space_member); for an open Pursuit it means the caller is a joined member.
-- Otherwise friend_going is left out and the next strongest reason is used.
--
-- Windows follow onboarding: Daytime is 06:00 to 17:59 and Evening is 18:00 on, in
-- America/New_York; the small hours are in no window.
--
-- Checked against the live project on Oct 30, 2026 with read-only queries: space_events
-- (capacity, price, status, city, neighborhood, created_by), event_rsvps, pursuits,
-- pursuit_members (status 'joined' / 'requested'), pursuit_sessions, space_members
-- (role 'host'), space_corners, corners, blocks, profile_follows (status 'accepted'),
-- profile_private (area, city, picks, free_windows, monthly_budget), user_passes,
-- profiles (is_test), app_config (key text, value jsonb; admins write), and the
-- functions private.is_active, private.is_blocked_between, private.pursuit_taken and
-- public.my_corner_affinity all exist as used here. Live has 1 event, 0 RSVPs and
-- 0 open Pursuits, so the function returns almost nothing there until some exist.
--
-- Run AFTER 20261108000000_require_birthdate.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261109000000_home_suggestions.sql.

-- 1. The weights -------------------------------------------------------------------

insert into public.app_config (key, value)
values (
  'home_ranking_v1',
  $json${
    "version": 1,
    "weights": {
      "window": 0.22, "picked": 0.20, "affinity": 0.08, "friends": 0.16, "nearby": 0.12,
      "trending": 0.06, "budget": 0.04, "pass": 0.06, "soon": 0.06
    },
    "window_neutral": 0.5,
    "friends_cap": 2,
    "nearby": { "area": 1.0, "city": 0.6, "elsewhere": 0.0, "online": 0.3, "unknown": 0.3 },
    "trending": { "recent_hours": 48, "baseline_days": 28, "scale": 2.0 },
    "soon_hours": 48,
    "log_retention_days": 90,
    "jitter": 0.03,
    "distinct_top": 4,
    "pass_corners": {
      "climbing": ["sports-fitness/climbing"],
      "bike": ["sports-fitness/cycling"],
      "fitness": ["sports-fitness/strength-training", "health-wellness/yoga", "sports-fitness/running"],
      "museum": ["art-creative/drawing", "art-creative/life-drawing"],
      "library": ["books-writing/reading", "books-writing/book-clubs", "art-creative/drawing", "art-creative/life-drawing"]
    }
  }$json$::jsonb
)
on conflict (key) do nothing;

-- 2. What was shown and what was done ---------------------------------------------

create table public.suggestion_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  surface text not null check (surface in ('home')),
  kind text not null check (kind in ('event', 'open_pursuit', 'friend_pursuit', 'at_home')),
  ref_id text not null check (char_length(ref_id) between 1 and 80),
  corner_key text check (corner_key is null or char_length(corner_key) between 1 and 160),
  position smallint not null check (position between 0 and 99),
  score double precision,
  reasons text[] not null default '{}'
    check (cardinality(reasons) <= 2 and reasons <@ array['fits_window', 'picked', 'affinity', 'friend_going', 'nearby', 'trending', 'pass', 'soon']::text[]),
  action text not null check (action in ('shown', 'opened', 'going', 'invite', 'dismissed')),
  created_at timestamptz not null default now()
);

create index suggestion_events_user_created_idx on public.suggestion_events (user_id, created_at);

alter table public.suggestion_events enable row level security;

revoke all on public.suggestion_events from public, anon, authenticated;
grant select on public.suggestion_events to authenticated;

create policy "you read your own suggestion events" on public.suggestion_events
  for select to authenticated
  using ((select auth.uid()) = suggestion_events.user_id);

create or replace function public.log_suggestion_event(
  p_kind text,
  p_ref_id text,
  p_corner_key text,
  p_position integer,
  p_score double precision,
  p_reasons text[],
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not private.is_active(v_me) then
    return;
  end if;
  -- A runaway page cannot fill the table: 600 rows an hour is far above real use.
  if (select count(*) from public.suggestion_events se
      where se.user_id = v_me and se.created_at > now() - interval '1 hour') >= 600 then
    return;
  end if;
  insert into public.suggestion_events (user_id, surface, kind, ref_id, corner_key, position, score, reasons, action)
  values (
    v_me, 'home', p_kind, p_ref_id, p_corner_key,
    greatest(0, least(coalesce(p_position, 0), 99))::smallint,
    p_score, coalesce(p_reasons, '{}'), p_action
  );
end
$$;
revoke all on function public.log_suggestion_event(text, text, text, integer, double precision, text[], text) from public, anon;
grant execute on function public.log_suggestion_event(text, text, text, integer, double precision, text[], text) to authenticated;

-- 2b. Keeping the log 90 days -------------------------------------------------------

create or replace function public.purge_suggestion_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((select (c.value ->> 'log_retention_days')::integer from public.app_config c where c.key = 'home_ranking_v1'), 90);
  v_count integer;
begin
  v_days := greatest(1, v_days);
  with gone as (
    delete from public.suggestion_events se
    where se.created_at < now() - make_interval(days => v_days)
    returning se.id
  )
  select count(*)::integer into v_count from gone;
  return v_count;
end
$$;
revoke all on function public.purge_suggestion_events() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'purge-suggestion-events',
  '45 3 * * *',
  $cron$select public.purge_suggestion_events();$cron$
);

-- Check it
-- select jobname, schedule, command, active from cron.job where jobname = 'purge-suggestion-events';
-- -- expect 1 row, active = true, schedule = '45 3 * * *'
-- Then run supabase/verification/home_suggestions_check.sql.

-- 3. The ranking ----------------------------------------------------------------------

create or replace function public.home_suggestions(p_limit integer default 8)
returns table (
  kind text,
  ref_id text,
  corner_key text,
  starts_at timestamptz,
  place_label text,
  score double precision,
  reasons text[],
  title text,
  space_slug text,
  friend_name text,
  pass_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_cfg jsonb := (select c.value from public.app_config c where c.key = 'home_ranking_v1');
  v_tz constant text := 'America/New_York';
  v_today date := (now() at time zone 'America/New_York')::date;
  v_area text := lower(btrim(coalesce((select pp.area from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_city text := lower(btrim(coalesce((select pp.city from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_picks text[] := coalesce((select pp.picks from public.profile_private pp where pp.user_id = auth.uid()), '{}');
  v_windows text[] := coalesce((select pp.free_windows from public.profile_private pp where pp.user_id = auth.uid()), '{}');
  v_budget smallint := (select pp.monthly_budget from public.profile_private pp where pp.user_id = auth.uid());
  v_passes text[] := coalesce((select array_agg(distinct up.kind) from public.user_passes up where up.user_id = auth.uid()), '{}');
  w_window double precision;
  w_picked double precision;
  w_affinity double precision;
  w_friends double precision;
  w_nearby double precision;
  w_trending double precision;
  w_budget double precision;
  w_pass double precision;
  w_soon double precision;
  v_window_neutral double precision;
  v_friends_cap double precision;
  v_n_area double precision;
  v_n_city double precision;
  v_n_else double precision;
  v_n_online double precision;
  v_n_unknown double precision;
  v_tr_recent integer;
  v_tr_base integer;
  v_tr_scale double precision;
  v_soon_hours double precision;
  v_jitter double precision;
  v_top integer;
  v_pass_map jsonb;
begin
  if v_me is null or not private.is_active(v_me) or v_cfg is null then
    return;
  end if;

  w_window := (v_cfg #>> '{weights,window}')::double precision;
  w_picked := (v_cfg #>> '{weights,picked}')::double precision;
  w_affinity := (v_cfg #>> '{weights,affinity}')::double precision;
  w_friends := (v_cfg #>> '{weights,friends}')::double precision;
  w_nearby := (v_cfg #>> '{weights,nearby}')::double precision;
  w_trending := (v_cfg #>> '{weights,trending}')::double precision;
  w_budget := (v_cfg #>> '{weights,budget}')::double precision;
  w_pass := (v_cfg #>> '{weights,pass}')::double precision;
  w_soon := (v_cfg #>> '{weights,soon}')::double precision;
  v_window_neutral := (v_cfg ->> 'window_neutral')::double precision;
  v_friends_cap := greatest(1, (v_cfg ->> 'friends_cap')::double precision);
  v_n_area := (v_cfg #>> '{nearby,area}')::double precision;
  v_n_city := (v_cfg #>> '{nearby,city}')::double precision;
  v_n_else := (v_cfg #>> '{nearby,elsewhere}')::double precision;
  v_n_online := (v_cfg #>> '{nearby,online}')::double precision;
  v_n_unknown := (v_cfg #>> '{nearby,unknown}')::double precision;
  v_tr_recent := greatest(1, (v_cfg #>> '{trending,recent_hours}')::integer);
  v_tr_base := greatest(1, (v_cfg #>> '{trending,baseline_days}')::integer);
  v_tr_scale := greatest(0.1, (v_cfg #>> '{trending,scale}')::double precision);
  v_soon_hours := greatest(1, (v_cfg ->> 'soon_hours')::double precision);
  v_jitter := (v_cfg ->> 'jitter')::double precision;
  v_top := greatest(1, (v_cfg ->> 'distinct_top')::integer);
  v_pass_map := coalesce(v_cfg -> 'pass_corners', '{}'::jsonb);

  return query
  with
  aff as (
    select a.hobby_slug || '/' || a.corner as k, a.mine
    from public.my_corner_affinity() a
    where a.corner <> ''
  ),
  friends as (
    select f.followed_id as uid
    from public.profile_follows f
    where f.follower_id = v_me and f.status = 'accepted'
      and not private.is_blocked_between(v_me, f.followed_id)
      and not coalesce((select p.is_test from public.profiles p where p.id = f.followed_id), false)
  ),
  ev as (
    select e.id::text as ref_id, 'event'::text as kind, e.title, e.starts_at, s.slug as space_slug, s.id as space_id,
           -- the event's own place when it has one, else its Space's; never half of each
           case when nullif(btrim(e.neighborhood), '') is not null or nullif(btrim(e.city), '') is not null
                then nullif(btrim(e.neighborhood), '') else nullif(btrim(s.neighborhood), '') end as hood,
           case when nullif(btrim(e.neighborhood), '') is not null or nullif(btrim(e.city), '') is not null
                then nullif(btrim(e.city), '') else nullif(btrim(s.city), '') end as city,
           (e.meets = 'online') as online,
           e.price as price
    from public.space_events e
    join public.spaces s on s.id = e.space_id and s.status = 'active' and s.access = 'open'
    where e.status is distinct from 'cancelled'
      and e.starts_at > now()
      and e.starts_at <= now() + interval '7 days'
      and e.created_by is distinct from v_me
      and not exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = v_me)
      and not exists (
        select 1 from public.space_members sm
        where sm.space_id = s.id and sm.user_id = v_me and sm.role = 'host' and sm.status = 'active'
      )
      and (e.capacity is null or (select count(*) from public.event_rsvps r2 where r2.event_id = e.id) < e.capacity)
      and (e.created_by is null or not private.is_blocked_between(v_me, e.created_by))
      and not coalesce((select p.is_test from public.profiles p where p.id = e.created_by), false)
  ),
  evc as (
    select distinct on (ev.ref_id)
           ev.ref_id, ev.kind, ev.title, ev.starts_at, ev.space_slug, ev.hood, ev.city, ev.online, ev.price, coalesce(ev.hood, ev.city) as place_label, ev.space_id,
           (c.space_slug || '/' || c.slug) as corner_key
    from ev
    join public.space_corners sc on sc.space_id = ev.space_id
    join public.corners c on c.id = sc.corner_id and not c.hidden
    left join aff on aff.k = c.space_slug || '/' || c.slug
    order by ev.ref_id,
             ((c.space_slug || '/' || c.slug) = any (v_picks)) desc,
             coalesce(aff.mine, 0) desc,
             sc.is_primary desc,
             c.space_slug, c.slug
  ),
  pu as (
    select p.id as ref_id, 'open_pursuit'::text as kind, p.title, sess.starts_at, s.slug as space_slug,
           nullif(btrim(s.neighborhood), '') as hood, nullif(btrim(s.city), '') as city,
           false as online, null::text as price,
           coalesce(nullif(btrim(sess.place), ''), nullif(btrim(s.neighborhood), ''), nullif(btrim(s.city), '')) as place_label,
           (p.hobby_slug || '/' || p.sub_hobby) as corner_key
    from public.pursuits p
    join public.spaces s on s.id = p.space_id and s.status = 'active' and s.access = 'open'
    join lateral (
      select ps.starts_at, ps.place
      from public.pursuit_sessions ps
      where ps.pursuit_id = p.id and ps.starts_at > now()
      order by ps.starts_at
      limit 1
    ) sess on true
    where p.visibility = 'open'
      and p.hobby_slug is not null and p.sub_hobby is not null
      and p.finished_at is null and p.let_go_at is null and p.paused_at is null
      and (p.ends_at is null or p.ends_at > now())
      and sess.starts_at <= now() + interval '7 days'
      and p.user_id <> v_me
      and private.pursuit_taken(p.id) < coalesce(p.capacity, 0)
      and not exists (select 1 from public.pursuit_members m where m.pursuit_id = p.id and m.user_id = v_me)
      and not private.is_blocked_between(v_me, p.user_id)
      and not coalesce((select pr.is_test from public.profiles pr where pr.id = p.user_id), false)
  ),
  cand as (
    select evc.kind, evc.ref_id, evc.title, evc.starts_at, evc.space_slug, evc.corner_key, evc.hood, evc.city, evc.online, evc.price, evc.place_label, evc.space_id from evc
    union all
    select pu.kind, pu.ref_id, pu.title, pu.starts_at, pu.space_slug, pu.corner_key, pu.hood, pu.city, pu.online, pu.price, pu.place_label, null::uuid from pu
  ),
  -- Who is going: people the caller follows, by candidate.
  going as (
    select 'event'::text as kind, r.event_id::text as ref_id, r.user_id as uid, r.created_at as seen_at
    from public.event_rsvps r
    join friends on friends.uid = r.user_id
    union all
    select 'open_pursuit'::text, m.pursuit_id, m.user_id, m.created_at
    from public.pursuit_members m
    join friends on friends.uid = m.user_id
    where m.status = 'joined'
    union all
    select 'open_pursuit'::text, p2.id, p2.user_id, p2.started_at
    from public.pursuits p2
    join friends on friends.uid = p2.user_id
  ),
  -- New people joining a Corner: RSVPs and Pursuit joins, by Corner.
  joins as (
    select (c2.space_slug || '/' || c2.slug) as corner_key, r2.user_id as uid, r2.created_at as seen_at
    from public.event_rsvps r2
    join public.space_events e2 on e2.id = r2.event_id
    join public.space_corners sc2 on sc2.space_id = e2.space_id
    join public.corners c2 on c2.id = sc2.corner_id and not c2.hidden
    where r2.created_at > now() - make_interval(days => v_tr_base)
    union all
    select (p3.hobby_slug || '/' || p3.sub_hobby), m3.user_id, m3.created_at
    from public.pursuit_members m3
    join public.pursuits p3 on p3.id = m3.pursuit_id
    where m3.status = 'joined' and p3.hobby_slug is not null and p3.sub_hobby is not null
      and m3.created_at > now() - make_interval(days => v_tr_base)
  ),
  trend as (
    select j.corner_key,
           count(distinct j.uid) filter (where j.seen_at > now() - make_interval(hours => v_tr_recent)) as recent,
           count(distinct j.uid) filter (where j.seen_at <= now() - make_interval(hours => v_tr_recent)) as base
    from joins j
    group by j.corner_key
  ),
  signals as (
    select cand.*,
           -- the window the start time falls in, New York time
           case
             when extract(hour from (cand.starts_at at time zone v_tz)) >= 18 then
               (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from (cand.starts_at at time zone v_tz))::integer] || '-eve'
             when extract(hour from (cand.starts_at at time zone v_tz)) >= 6 then
               (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from (cand.starts_at at time zone v_tz))::integer] || '-day'
             else null
           end as wkey,
           (cand.corner_key = any (v_picks)) as is_pick,
           coalesce((select a.mine from aff a where a.k = cand.corner_key), 0)::double precision as s_aff,
           (select count(distinct g.uid) from going g where g.kind = cand.kind and g.ref_id = cand.ref_id)::integer as n_friends,
           -- may the caller already see who is going? (event: member of the Space; Pursuit: joined member)
           (case
              when cand.kind = 'event' then coalesce(public.is_space_member(cand.space_id, v_me), false)
              else exists (select 1 from public.pursuit_members mv where mv.pursuit_id = cand.ref_id and mv.user_id = v_me and mv.status = 'joined')
            end) as can_see,
           coalesce((select t.recent from trend t where t.corner_key = cand.corner_key), 0)::double precision as tr_recent,
           coalesce((select t.base from trend t where t.corner_key = cand.corner_key), 0)::double precision as tr_base,
           (select pk from unnest(v_passes) as pk
             where jsonb_exists(v_pass_map -> pk, cand.corner_key)
             order by pk limit 1) as pass_kind
    from cand
  ),
  scored as (
    select sg.*,
           case
             when cardinality(v_windows) = 0 then v_window_neutral
             when sg.wkey = any (v_windows) then 1.0
             else 0.0
           end as s_window,
           (case when sg.is_pick then 1.0 else 0.0 end) as s_pick,
           (case when sg.can_see then
              (select split_part(btrim(pr2.display_name), ' ', 1)
                 from going g2
                 join public.profiles pr2 on pr2.id = g2.uid
                where g2.kind = sg.kind and g2.ref_id = sg.ref_id and btrim(coalesce(pr2.display_name, '')) <> ''
                order by g2.seen_at, g2.uid
                limit 1)
            end) as friend_first,
           least(sg.n_friends, v_friends_cap) / v_friends_cap as s_friends,
           case
             when sg.online then v_n_online
             when v_area = '' and v_city = '' then v_n_unknown
             when v_area <> '' and lower(coalesce(sg.hood, '')) = v_area then v_n_area
             when v_city <> '' and lower(coalesce(sg.city, '')) = v_city then v_n_city
             else v_n_else
           end as s_near,
           case when sg.tr_recent > 0 then 1.0 - exp(- (sg.tr_recent / (sg.tr_base / greatest(1.0, (v_tr_base * 24.0) / v_tr_recent) + 1.0)) / v_tr_scale) else 0.0 end as s_trend,
           (case
              when v_budget = 0 and (sg.price is null or btrim(sg.price) = '' or sg.price ~* '^\s*(free|\$?\s*0([.]0+)?)\s*$') then 1.0
              else 0.0
            end) as s_budget,
           (case when sg.pass_kind is not null then 1.0 else 0.0 end) as s_pass,
           greatest(0.0, 1.0 - (extract(epoch from (sg.starts_at - now())) / 3600.0) / v_soon_hours) as s_soon,
           ((abs(hashtextextended(v_me::text || v_today::text || sg.kind || sg.ref_id, 0)) % 1000) / 1000.0) * v_jitter as jit
    from signals sg
  ),
  final_scores as (
    select sc.*,
           (w_window * sc.s_window + w_picked * sc.s_pick + w_affinity * sc.s_aff + w_friends * sc.s_friends
            + w_nearby * sc.s_near + w_trending * sc.s_trend + w_budget * sc.s_budget + w_pass * sc.s_pass
            + w_soon * sc.s_soon + sc.jit) as total
    from scored sc
  ),
  reasoned as (
    select fs.*,
           (select array_agg(x.code order by x.c desc, x.code)
              from (
                select v.code, v.c
                from (values
                  ('fits_window', case when cardinality(v_windows) > 0 and fs.wkey = any (v_windows) then w_window else 0.0 end),
                  ('picked', case when fs.is_pick then w_picked else 0.0 end),
                  ('affinity', case when not fs.is_pick then w_affinity * fs.s_aff else 0.0 end),
                  ('friend_going', case when fs.can_see then w_friends * fs.s_friends else 0.0 end),
                  ('nearby', case when not fs.online and fs.s_near >= v_n_city and fs.s_near > v_n_unknown then w_nearby * fs.s_near else 0.0 end),
                  ('trending', w_trending * fs.s_trend),
                  ('pass', w_pass * fs.s_pass),
                  ('soon', w_soon * fs.s_soon)
                ) as v(code, c)
                where v.c > 0
                order by v.c desc, v.code
                limit 2
              ) x) as why
    from final_scores fs
  ),
  ranked as (
    select r.*, row_number() over (partition by r.corner_key order by r.total desc, r.ref_id) as rn_in_corner
    from reasoned r
  ),
  firsts as (
    select rk.* from ranked rk where rk.rn_in_corner = 1 order by rk.total desc, rk.ref_id limit v_top
  ),
  ordered as (
    select f.kind, f.ref_id, f.corner_key, f.starts_at, f.place_label, f.total, f.why, f.title, f.space_slug,
           f.friend_first, f.pass_kind, f.is_pick, f.n_friends, 0 as grp
    from firsts f
    union all
    select rk.kind, rk.ref_id, rk.corner_key, rk.starts_at, rk.place_label, rk.total, rk.why, rk.title, rk.space_slug,
           rk.friend_first, rk.pass_kind, rk.is_pick, rk.n_friends, 1
    from ranked rk
    where not exists (select 1 from firsts f2 where f2.kind = rk.kind and f2.ref_id = rk.ref_id)
  )
  select o.kind, o.ref_id, o.corner_key, o.starts_at, o.place_label,
         round(o.total::numeric, 4)::double precision,
         coalesce(o.why, '{}'::text[]),
         o.title, o.space_slug,
         case when o.why @> array['friend_going']::text[] then left(o.friend_first, 60) else null end,
         case when o.why @> array['pass']::text[] then o.pass_kind else null end
  from ordered o
  order by o.grp, o.total desc, o.ref_id
  limit v_limit;
end
$$;
revoke all on function public.home_suggestions(integer) from public, anon;
grant execute on function public.home_suggestions(integer) to authenticated;
