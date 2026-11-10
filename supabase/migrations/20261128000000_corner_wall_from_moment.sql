-- Soosh: a Pursuit made from a Moment counts as finished for everyone who can see that Moment.
--
-- Run after 20261127000000_moments_visible_at_once.sql.
-- Rollback: rollback_20261128000000_corner_wall_from_moment.sql.
-- Verification: supabase/verification/corner_wall_from_moment.sql.
--
-- Why. On a Corner with a room, Log a Moment asks "in progress or finished". Answering finished on a Moment
-- that counts toward no Pursuit makes a Pursuit from that Moment, finished from its first write. A Pursuit can
-- be read by other people only when it is shared, and it is shared only when the Moment is for everyone (its
-- title comes from the Moment). corner_wall is security invoker, so for a followers-only Moment the followers
-- could not read the Pursuit and still saw the Moment on the in-progress wall, while its owner saw it finished.
--
-- What changes.
--   1. pursuits.from_moment (boolean, default false): true on a Pursuit made from one Moment by that answer.
--      Nothing else sets it. The table's existing grants and policies cover the column: only the owner writes it.
--   2. private.moment_pursuit(pursuit, author): security definer. For a from_moment Pursuit that is finished and
--      belongs to that author, its finished_at and title. Nothing for any other Pursuit, so a Pursuit someone
--      made themselves and kept private stays exactly as private as before.
--   3. corner_wall: where the caller cannot read a Moment's Pursuit, it asks moment_pursuit. The Moment itself
--      still comes through posts RLS (the vis CTE, unchanged), so the finished wall follows the Moment's
--      audience: whoever can see the Moment sees it finished, and nobody else sees anything.
--
-- Not changed: the result columns, paging, corner_passed_along, every policy, every grant on corner_wall.
-- No data is changed. Every column inside every subquery is table-qualified (CLAUDE.md).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. The marker
-- ═══════════════════════════════════════════════════════════════════════

alter table public.pursuits add column from_moment boolean not null default false;

comment on column public.pursuits.from_moment is
  'True on a Pursuit made from one Moment when its maker answered "finished" in Log a Moment. corner_wall treats it as finished for anyone who can see that Moment.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. What a wall may know about a from_moment Pursuit
-- ═══════════════════════════════════════════════════════════════════════

create function private.moment_pursuit(p_pursuit text, p_author uuid)
returns table (finished_at timestamptz, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select pu.finished_at, pu.title
  from public.pursuits pu
  where pu.id = p_pursuit
    and pu.user_id = p_author
    and pu.from_moment
    and pu.finished_at is not null
$$;

revoke all on function private.moment_pursuit(text, uuid) from public, anon;
grant execute on function private.moment_pursuit(text, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. corner_wall: the same function as 20261123000000_corner_walls.sql, with the three marked changes
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.corner_wall(
  p_corner text,
  p_wall text,
  p_before timestamptz default null,
  p_limit integer default 8
)
returns table (
  wall text,
  post_id bigint,
  author_id uuid,
  author_first_name text,
  author_avatar_url text,
  is_mine boolean,
  pursuit_id text,
  pursuit_title text,
  media_type text,
  media_url text,
  media_urls text[],
  media_paths text[],
  caption text,
  posted_at timestamptz,
  finished_at timestamptz,
  has_finisher_stub boolean,
  inspired_by_post_id bigint,
  inspired_by_first_name text,
  started_because text[]
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_src text[] := private.corner_alias_sources(p_corner);
  v_spaces text[] := array(select distinct split_part(x.k, '/', 1) from unnest(private.corner_alias_sources(p_corner)) as x(k));
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
begin
  if p_wall is null or p_wall not in ('making', 'made') then
    raise exception 'corner_wall: p_wall must be making or made' using errcode = '22023';
  end if;
  if v_me is null then
    return;
  end if;

  return query
  with
  -- Moments the caller may see in this Corner. posts RLS decides the audience; the rest narrows to wall material.
  vis as (
    select p.id, p.user_id, p.pursuit_id, p.created_at, p.caption, p.type, p.media_url, p.media_urls, p.media_paths
    from public.posts p
    where p.hobby_slug = any (v_spaces)
      and (p.hobby_slug || '/' || lower(coalesce(p.corner, p.sub_hobby))) = any (v_src)
      and p.visibility in ('public', 'followers')
      and coalesce(p.audience, 'everyone') <> 'group'
      and coalesce(p.visible_at, p.created_at) <= now()
      and public.is_visible_profile(p.user_id)
      and not coalesce((select pr.is_test from public.profiles pr where pr.id = p.user_id), false)
      and not exists (
        select 1 from public.reports r
        where r.reporter_id = v_me
          and r.status <> 'dismissed'
          and (
            (r.target_kind = 'profile' and r.target_user_id = p.user_id)
            or (r.target_kind = 'moment' and r.target_id = p.id)
          )
      )
  ),
  making as (
    select distinct on (coalesce(v.pursuit_id, 'moment-' || v.id::text))
           v.id, v.user_id, v.pursuit_id, v.created_at, v.caption, v.type, v.media_url, v.media_urls, v.media_paths,
           null::timestamptz as fin_at
    from vis v
    left join public.pursuits pu on pu.id = v.pursuit_id
    -- A Pursuit the caller cannot read (not shared): finished only if it was made from a Moment (from_moment).
    left join lateral (
      select fp.finished_at
      from private.moment_pursuit(v.pursuit_id, v.user_id) fp
      where pu.id is null and v.pursuit_id is not null
    ) fm on true
    where (v.pursuit_id is null or coalesce(pu.finished_at, fm.finished_at) is null)
    order by coalesce(v.pursuit_id, 'moment-' || v.id::text), v.created_at desc, v.id desc
  ),
  made as (
    select distinct on (v.pursuit_id)
           v.id, v.user_id, v.pursuit_id, v.created_at, v.caption, v.type, v.media_url, v.media_urls, v.media_paths,
           coalesce(pu.finished_at, fm.finished_at) as fin_at
    from vis v
    left join public.pursuits pu on pu.id = v.pursuit_id
    left join lateral (
      select fp.finished_at
      from private.moment_pursuit(v.pursuit_id, v.user_id) fp
      where pu.id is null
    ) fm on true
    where v.pursuit_id is not null
      and coalesce(pu.finished_at, fm.finished_at) is not null
    order by v.pursuit_id, v.created_at desc, v.id desc
  ),
  picked as (
    select 'making'::text as w, m.*, m.created_at as sort_at from making m
    where p_wall = 'making' and (p_before is null or m.created_at < p_before)
    union all
    select 'made'::text, d.*, d.fin_at from made d
    where p_wall = 'made' and (p_before is null or d.fin_at < p_before)
  ),
  page as (
    select pk.* from picked pk order by pk.sort_at desc, pk.id desc limit v_limit
  )
  select
    pg.w,
    pg.id,
    pg.user_id,
    left(split_part(btrim(coalesce(au.display_name, '')), ' ', 1), 60),
    au.avatar_url,
    (pg.user_id = v_me),
    pg.pursuit_id,
    coalesce(pu.title, ft.title),
    pg.type,
    pg.media_url,
    pg.media_urls,
    pg.media_paths,
    pg.caption,
    pg.created_at,
    pg.fin_at,
    case when pg.w = 'made' then private.pursuit_has_finisher_stub(pg.pursuit_id) else false end,
    src.id,
    case when src.id is not null then left(split_part(btrim(coalesce(sa.display_name, '')), ' ', 1), 60) end,
    coalesce((
      select array_agg(q.first_name order by q.started desc)
      from (
        select distinct on (f.user_id) f.user_id, f.started_at as started,
               left(split_part(btrim(coalesce(fa.display_name, '')), ' ', 1), 60) as first_name
        from public.pursuits f
        join public.profiles fa on fa.id = f.user_id
        where (
            f.inspired_by_post_id = pg.id
            or (
              pg.pursuit_id is not null
              and exists (
                select 1 from public.posts sp
                where sp.id = f.inspired_by_post_id and sp.pursuit_id = pg.pursuit_id
              )
            )
          )
          and f.user_id <> pg.user_id
          and public.is_visible_profile(f.user_id)
          and not coalesce(fa.is_test, false)
          and btrim(coalesce(fa.display_name, '')) <> ''
          and exists (select 1 from vis fv where fv.pursuit_id = f.id)
        order by f.user_id, f.started_at desc
        limit 3
      ) q
    ), '{}'::text[])
  from page pg
  join public.profiles au on au.id = pg.user_id
  left join public.pursuits pu on pu.id = pg.pursuit_id
  -- The title of a from_moment Pursuit the caller cannot read: it is the first line of the Moment they can see.
  left join lateral (
    select fp.title
    from private.moment_pursuit(pg.pursuit_id, pg.user_id) fp
    where pu.id is null and pg.pursuit_id is not null
  ) ft on true
  -- The source Moment, only if the caller can read it and could see its maker (a Moment they could not open stays unnamed).
  left join lateral (
    select sp.id, sp.user_id
    from public.posts sp
    where sp.id = pu.inspired_by_post_id
      and public.is_visible_profile(sp.user_id)
  ) src on true
  left join public.profiles sa on sa.id = src.user_id
  order by pg.sort_at desc, pg.id desc;
end
$$;

revoke all on function public.corner_wall(text, text, timestamptz, integer) from public, anon;
grant execute on function public.corner_wall(text, text, timestamptz, integer) to authenticated;
