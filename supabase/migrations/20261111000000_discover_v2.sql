-- Discover v2, PR 1 of 2: the world, not your world.
--
-- Run AFTER 20261110000000_profile_roles_and_planning.sql (and so after
-- 20261109000000_home_suggestions.sql, which made suggestion_events).
--
--   posts.city                         the city a Moment was made in (nullable, no backfill).
--   public.discover_moments(p_corner, p_cursor, p_limit)
--       Moments from people the caller does not follow, in Spaces the caller has not
--       joined. Everyone Moments only, newest first, keyset paged by created_at.
--   public.discover_corners(p_limit, p_candidates)
--       Corners new to the caller, with a flag for each way in.
--   public.discover_spaces(p_limit)
--       Open and Closed Spaces in the caller's city that the caller has not joined.
--   public.log_discover_event(...)
--       The one way to write a Discover row to suggestion_events (surface 'discover');
--       user_id always comes from auth.uid(). The table's checks are widened to allow
--       the new surface, kinds and actions; Home's rows and function are untouched.
--
-- Checked against the live project on Oct 30, 2026 with read-only queries:
-- posts (visibility, audience, visible_at, hobby_slug, corner, sub_hobby), space_moments
-- (status, removed_by_host), spaces (access, status, city, neighborhood, created_by),
-- space_members (status 'active' / 'banned'), space_join_requests, space_events,
-- space_corners, corners, hobby_follows (hobby_key 'space:slug'), profile_follows
-- (status), profile_private (picks, city, area), profiles (is_test), and the functions
-- private.is_active, private.is_blocked_between, public.is_visible_profile,
-- public.space_moment_count_30d, public.my_corner_affinity, public.corners_with_activity.
--
-- Decisions made with the founder while building this (see the PR):
--   * "Everyone" is posts.visibility = 'public' with audience null or 'everyone'. That is
--     how the app already words it, and all 24 live Moments are audience null / public.
--   * A Moment now carries its own city: posts.city (nullable text, no backfill). The
--     composer defaults it from the author's own profile_private.city and lets the author
--     remove it (saving null). Older Moments have null, and null counts as local.
--     discover_moments filters on posts.city only and never reads another person's
--     profile_private. The viewer's own city, read from their own row, is the one thing it
--     compares against. posts has table-wide column grants today, so the new column is
--     readable and writable like its neighbours; when docs/tickets/posts-column-privacy.md
--     moves posts to explicit column grants, city must be in the readable list.
--   * Built-in Corners live in code (hobbies.ts), not in public.corners (6 live rows), so
--     discover_corners takes the candidate Corner keys from the app (p_candidates, the
--     Corners that have a guide). Without it, it falls back to the rows in public.corners.
--     has_home is true for every candidate for that reason: the app only sends Corners
--     that have an at-home guide.
--
-- None of the three functions returns a follower count, a member count, a person's
-- private data, or anything about people other than who made a Moment.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261111000000_discover_v2.sql.

-- 0. A Moment's city ---------------------------------------------------------------------

alter table public.posts
  add column city text check (city is null or char_length(btrim(city)) between 1 and 80);

-- 1. The log learns about Discover ---------------------------------------------------

alter table public.suggestion_events drop constraint suggestion_events_surface_check;
alter table public.suggestion_events
  add constraint suggestion_events_surface_check check (surface in ('home', 'discover'));

alter table public.suggestion_events drop constraint suggestion_events_kind_check;
alter table public.suggestion_events
  add constraint suggestion_events_kind_check
  check (kind in ('event', 'open_pursuit', 'friend_pursuit', 'at_home', 'idea', 'corner', 'space', 'moment'));

alter table public.suggestion_events drop constraint suggestion_events_action_check;
alter table public.suggestion_events
  add constraint suggestion_events_action_check
  check (action in ('shown', 'opened', 'going', 'invite', 'dismissed', 'followed', 'joined', 'tried'));

create or replace function public.log_discover_event(
  p_kind text,
  p_ref_id text,
  p_corner_key text,
  p_position integer,
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
  if p_kind is null or p_kind not in ('idea', 'corner', 'space', 'moment')
     or p_action is null or p_action not in ('shown', 'opened', 'followed', 'joined', 'tried') then
    raise exception 'Not a Discover event.' using errcode = '22023';
  end if;
  if not private.is_active(v_me) then
    return;
  end if;
  -- Same cap as Home, across both surfaces: a runaway page cannot fill the table.
  if (select count(*) from public.suggestion_events se
      where se.user_id = v_me and se.created_at > now() - interval '1 hour') >= 600 then
    return;
  end if;
  insert into public.suggestion_events (user_id, surface, kind, ref_id, corner_key, position, score, reasons, action)
  values (
    v_me, 'discover', p_kind, p_ref_id, p_corner_key,
    greatest(0, least(coalesce(p_position, 0), 99))::smallint,
    null, '{}', p_action
  );
end
$$;
revoke all on function public.log_discover_event(text, text, text, integer, text) from public, anon;
grant execute on function public.log_discover_event(text, text, text, integer, text) to authenticated;

-- 2. Moments from people you do not follow yet ------------------------------------

create or replace function public.discover_moments(
  p_corner text default null,
  p_cursor timestamptz default null,
  p_limit integer default 20
)
returns table (
  post_id bigint,
  author_id uuid,
  created_at timestamptz,
  corner_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_city text := lower(btrim(coalesce((select pp.city from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_corner text := nullif(lower(btrim(coalesce(p_corner, ''))), '');
begin
  if v_me is null or not private.is_active(v_me) then
    return;
  end if;

  return query
  select po.id, po.user_id, po.created_at,
         (po.hobby_slug || '/' || lower(coalesce(nullif(btrim(po.corner), ''), nullif(btrim(po.sub_hobby), ''), '')))
  from public.posts po
  where po.visibility = 'public'
    and (po.audience is null or po.audience = 'everyone')
    and coalesce(po.visible_at, po.created_at) <= now()
    and (p_cursor is null or po.created_at < p_cursor)
    and po.user_id <> v_me
    and public.is_visible_profile(po.user_id)
    -- authors the caller follows are Home's, not Discover's
    and not exists (
      select 1 from public.profile_follows pf
      where pf.follower_id = v_me and pf.followed_id = po.user_id and pf.status = 'accepted'
    )
    -- a Moment shared to a Space the caller has joined is Home's
    and not exists (
      select 1 from public.space_moments sm
      join public.space_members mem on mem.space_id = sm.space_id
      where sm.post_id = po.id and mem.user_id = v_me and mem.status = 'active'
    )
    and not private.is_blocked_between(v_me, po.user_id)
    and not coalesce((select pr.is_test from public.profiles pr where pr.id = po.user_id), false)
    -- the Moment's own city matches; no city on the Moment counts as local
    and (v_city = '' or po.city is null or lower(btrim(po.city)) = v_city)
    and (
      v_corner is null
      or (po.hobby_slug || '/' || lower(coalesce(nullif(btrim(po.corner), ''), nullif(btrim(po.sub_hobby), ''), ''))) = v_corner
    )
  order by po.created_at desc, po.id desc
  limit v_limit;
end
$$;
revoke all on function public.discover_moments(text, timestamptz, integer) from public, anon;
grant execute on function public.discover_moments(text, timestamptz, integer) to authenticated;

-- 3. Corners new to you ------------------------------------------------------------

create or replace function public.discover_corners(
  p_limit integer default 3,
  p_candidates text[] default null
)
returns table (
  corner_key text,
  has_home boolean,
  has_group boolean,
  has_place boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 3), 24));
  v_today date := (now() at time zone 'America/New_York')::date;
  v_city text := lower(btrim(coalesce((select pp.city from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_picks text[] := coalesce((select pp.picks from public.profile_private pp where pp.user_id = auth.uid()), '{}');
begin
  if v_me is null or not private.is_active(v_me) then
    return;
  end if;
  if p_candidates is not null and cardinality(p_candidates) > 400 then
    raise exception 'Too many candidates.' using errcode = '22023';
  end if;

  return query
  with
  cand as (
    select distinct lower(btrim(k.key)) as key
    from unnest(p_candidates) as k(key)
    where p_candidates is not null
      and btrim(k.key) ~ '^[a-z0-9-]+/[a-z0-9-]+$'
    union
    select (c.space_slug || '/' || c.slug)
    from public.corners c
    where p_candidates is null and not c.hidden
  ),
  mine as (
    select a.hobby_slug || '/' || a.corner as key, a.peers
    from public.my_corner_affinity() a
    where a.corner <> ''
  ),
  city_activity as (
    select ca.corner_key as key, (ca.events + ca.pursuits + ca.partners) as n
    from public.corners_with_activity(v_city, 7) ca
  ),
  open_group as (
    select distinct (pu.hobby_slug || '/' || lower(pu.sub_hobby)) as key
    from public.pursuits pu
    join public.spaces s on s.id = pu.space_id and s.status = 'active' and s.access = 'open'
    where pu.visibility = 'open'
      and pu.hobby_slug is not null and pu.sub_hobby is not null
      and pu.finished_at is null and pu.let_go_at is null and pu.paused_at is null
      and (pu.ends_at is null or pu.ends_at > now())
      and pu.user_id <> v_me
      and private.pursuit_taken(pu.id) < coalesce(pu.capacity, 0)
      and not private.is_blocked_between(v_me, pu.user_id)
      and not coalesce((select pr.is_test from public.profiles pr where pr.id = pu.user_id), false)
      and (v_city = '' or lower(btrim(coalesce(s.city, ''))) = v_city)
  ),
  open_place as (
    select distinct (co.space_slug || '/' || co.slug) as key
    from public.spaces s
    join public.space_corners sc on sc.space_id = s.id
    join public.corners co on co.id = sc.corner_id and not co.hidden
    where s.status = 'active' and s.access = 'open'
      and v_city <> '' and lower(btrim(coalesce(s.city, ''))) = v_city
    union
    select distinct (co2.space_slug || '/' || co2.slug)
    from public.space_events e
    join public.spaces s2 on s2.id = e.space_id and s2.status = 'active' and s2.access = 'open'
    join public.space_corners sc2 on sc2.space_id = s2.id
    join public.corners co2 on co2.id = sc2.corner_id and not co2.hidden
    where e.status is distinct from 'cancelled'
      and e.starts_at > now()
      and v_city <> '' and lower(btrim(coalesce(e.city, s2.city, ''))) = v_city
  )
  select cand.key,
         (p_candidates is not null),
         exists (select 1 from open_group og where og.key = cand.key),
         exists (select 1 from open_place op where op.key = cand.key)
  from cand
  where not (cand.key = any (v_picks))
    -- not followed: 'space:slug', or the older bare slug
    and not exists (
      select 1 from public.hobby_follows hf
      where hf.user_id = v_me
        and hf.hobby_key in (replace(cand.key, '/', ':'), split_part(cand.key, '/', 2))
    )
    -- no Moment or Pursuit logged in it
    and not exists (
      select 1 from public.posts po
      where po.user_id = v_me
        and po.hobby_slug = split_part(cand.key, '/', 1)
        and lower(coalesce(nullif(btrim(po.corner), ''), nullif(btrim(po.sub_hobby), ''), '')) = split_part(cand.key, '/', 2)
    )
    and not exists (
      select 1 from public.pursuits pm
      where pm.user_id = v_me
        and pm.hobby_slug = split_part(cand.key, '/', 1)
        and lower(coalesce(pm.sub_hobby, '')) = split_part(cand.key, '/', 2)
    )
  order by coalesce((select m.peers from mine m where m.key = cand.key), 0) desc,
           coalesce((select ca.n from city_activity ca where ca.key = cand.key), 0) desc,
           (abs(hashtextextended(v_me::text || v_today::text || cand.key, 0)) % 1000) desc,
           cand.key
  limit v_limit;
end
$$;
revoke all on function public.discover_corners(integer, text[]) from public, anon;
grant execute on function public.discover_corners(integer, text[]) to authenticated;

-- 4. Spaces near you -----------------------------------------------------------------

create or replace function public.discover_spaces(p_limit integer default 10)
returns table (
  space_id uuid,
  slug text,
  name text,
  corner_key text,
  neighborhood text,
  access text,
  moments_this_month integer,
  next_event_title text,
  next_event_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 30));
  v_today date := (now() at time zone 'America/New_York')::date;
  v_city text := lower(btrim(coalesce((select pp.city from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_area text := lower(btrim(coalesce((select pp.area from public.profile_private pp where pp.user_id = auth.uid()), '')));
begin
  if v_me is null or not private.is_active(v_me) or v_city = '' then
    return;
  end if;

  return query
  select s.id, s.slug, s.name,
         (select (co.space_slug || '/' || co.slug)
            from public.space_corners sc
            join public.corners co on co.id = sc.corner_id and not co.hidden
           where sc.space_id = s.id
           order by sc.is_primary desc, co.space_slug, co.slug
           limit 1),
         nullif(btrim(s.neighborhood), ''),
         s.access,
         public.space_moment_count_30d(s.id),
         (select ev.title from public.space_events ev
           where ev.space_id = s.id and ev.status is distinct from 'cancelled' and ev.starts_at > now()
           order by ev.starts_at limit 1),
         (select ev2.starts_at from public.space_events ev2
           where ev2.space_id = s.id and ev2.status is distinct from 'cancelled' and ev2.starts_at > now()
           order by ev2.starts_at limit 1)
  from public.spaces s
  where s.status = 'active'
    and s.access in ('open', 'closed')
    and lower(btrim(coalesce(s.city, ''))) = v_city
    -- never one the caller joined, was banned from, or has already asked to join
    and not exists (select 1 from public.space_members mem where mem.space_id = s.id and mem.user_id = v_me)
    and not exists (select 1 from public.space_join_requests jr where jr.space_id = s.id and jr.user_id = v_me)
    and (s.created_by is null or not private.is_blocked_between(v_me, s.created_by))
    and not coalesce((select pr.is_test from public.profiles pr where pr.id = s.created_by), false)
  order by (v_area <> '' and lower(btrim(coalesce(s.neighborhood, ''))) = v_area) desc,
           (abs(hashtextextended(v_me::text || v_today::text || s.id::text, 0)) % 1000),
           s.id
  limit v_limit;
end
$$;
revoke all on function public.discover_spaces(integer) from public, anon;
grant execute on function public.discover_spaces(integer) to authenticated;

-- Then run supabase/verification/discover_v2_check.sql.
