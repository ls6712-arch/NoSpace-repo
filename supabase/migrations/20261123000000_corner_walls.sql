-- Soosh: Corner walls, PR 1 (data). Brief of Nov 7, 2026.
--
-- Run after 20261122000000_post_activity_id.sql. Staging first.
-- Rollback: rollback_20261123000000_corner_walls.sql.
-- Verification: supabase/verification/corner_wall.sql.
--
-- Two read-only RPCs, no new table, no new column, no policy change:
--   corner_wall(p_corner, p_wall, p_before, p_limit)  the Still making and Made it walls of a Corner
--   corner_passed_along(p_corner, p_limit)             chains of "started because of", source to follower
-- Both are security invoker, so every existing RLS rule on posts, pursuits and profiles still decides what the
-- caller can read. On top of that they leave out people the caller blocked or was blocked by (is_visible_profile
-- does both, and hides paused and deleting accounts), test accounts, and anyone or anything the caller reported.
-- Neither is granted to anon: a signed-out visitor gets a permission error and the page shows blurred shapes only.
--
-- Corner matching follows src/app/lib/cornerAlias.ts: a Moment counts under the Corner its hobby_slug and
-- coalesce(corner, sub_hobby) name, after the merge map in src/app/data/hobbies.ts (MERGED_CORNERS). The map is copied
-- into private.corner_alias_sources() below. When MERGED_CORNERS changes, ship a new migration for this function.
--
-- A Pursuit's Finisher Stub mark: stubs are readable only by their owner, so private.pursuit_has_finisher_stub() is
-- security definer and returns one boolean for one finished Pursuit. It exposes nothing else about the Stub.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Corner key aliases
-- ═══════════════════════════════════════════════════════════════════════

-- Every `space/slug` key that counts as this Corner: the Corner itself (after any merge) and every Corner merged into it.
create or replace function private.corner_alias_sources(p_corner text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with m(src, dst) as (
    values
      ('food-cooking/espresso', 'food-cooking/coffee'),
      ('food-cooking/home-coffee', 'food-cooking/coffee'),
      ('books-writing/creative-writing', 'books-writing/writing'),
      ('books-writing/books', 'books-writing/reading'),
      ('tech-building/arduino', 'tech-building/electronics'),
      ('tech-building/raspberry-pi', 'tech-building/electronics'),
      ('photography-film/video', 'photography-film/filmmaking'),
      ('art-creative/ceramics', 'crafts-making/pottery'),
      ('gaming-tabletop/tabletop-rpgs', 'gaming-tabletop/d-d'),
      ('nature-outdoors/outdoor-photography', 'photography-film/photography'),
      ('photography-film/outdoor-photography', 'photography-film/photography'),
      ('health-wellness/mindfulness', 'health-wellness/meditation'),
      ('home-garden/restoration', 'crafts-making/upcycling'),
      ('home-garden/furniture-flipping', 'crafts-making/upcycling'),
      ('food-cooking/kombucha', 'food-cooking/fermentation'),
      ('art-creative/illustration', 'art-creative/drawing'),
      ('art-creative/watercolor', 'art-creative/painting'),
      ('music/singing', 'music/choir'),
      ('music/make-a-beat', 'music/music-production'),
      ('collecting-fandom/toys', 'collecting-fandom/lego'),
      ('crafts-making/miniatures', 'crafts-making/model-making'),
      ('travel-adventure/backpacking', 'nature-outdoors/hiking'),
      ('tech-building/web-design', 'tech-building/coding'),
      ('travel-adventure/road-trips', 'travel-adventure/travel'),
      ('travel-adventure/exploration', 'travel-adventure/travel'),
      ('home-garden/native-plants', 'home-garden/gardening'),
      ('home-garden/indoor-growing', 'home-garden/houseplants')
  ),
  k as (
    select coalesce((select m.dst from m where m.src = lower(btrim(p_corner))), lower(btrim(p_corner))) as key
  )
  select array(
    select k.key from k
    union
    select m.src from m cross join k where m.dst = k.key
  )
$$;

revoke all on function private.corner_alias_sources(text) from public, anon;
grant execute on function private.corner_alias_sources(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Finisher Stub mark (one boolean, nothing else)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function private.pursuit_has_finisher_stub(p_pursuit text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stubs s
    where s.pursuit_id = p_pursuit
      and s.kind = 'finish'
  )
$$;

revoke all on function private.pursuit_has_finisher_stub(text) from public, anon;
grant execute on function private.pursuit_has_finisher_stub(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. corner_wall
-- ═══════════════════════════════════════════════════════════════════════
--
-- Still making ('making'): Moments in the Corner, public or followers-only (never private, never a group Moment), whose
--   Pursuit is not finished (or that have no Pursuit). One card per Pursuit, its newest Moment. Newest first.
--   p_before pages on the Moment's created_at.
-- Made it ('made'): one card per finished Pursuit in the Corner that has at least one Moment the caller may see. The
--   Pursuit's newest visible Moment supplies the photo and caption. Newest finished_at first. p_before pages on finished_at.
--
-- inspired_by_*: only when the card's Pursuit has inspired_by_post_id AND the caller can read that source Moment
--   (the select on posts runs under the caller's RLS). Otherwise both are null.
-- started_because: first names of people whose Pursuit was inspired by this card's Moment (or by any Moment of the
--   card's Pursuit, since the card shows only its newest one), who have at least one Moment
--   the caller may see in this Corner. Newest first, at most 3 (the page writes "A", "A and B" or "A, B and others";
--   never a number).

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
    where (v.pursuit_id is null or pu.id is null or pu.finished_at is null)
    order by coalesce(v.pursuit_id, 'moment-' || v.id::text), v.created_at desc, v.id desc
  ),
  made as (
    select distinct on (pu.id)
           v.id, v.user_id, v.pursuit_id, v.created_at, v.caption, v.type, v.media_url, v.media_urls, v.media_paths,
           pu.finished_at as fin_at
    from public.pursuits pu
    join vis v on v.pursuit_id = pu.id
    where pu.finished_at is not null
    order by pu.id, v.created_at desc, v.id desc
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
    pu.title,
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

-- ═══════════════════════════════════════════════════════════════════════
-- 4. corner_passed_along
-- ═══════════════════════════════════════════════════════════════════════
--
-- A link is: a Pursuit B whose inspired_by_post_id is a Moment of Pursuit A. A chain starts at a Pursuit nobody visible
-- inspired it, follows the newest follower at each step, and is at most 4 people long. Every Pursuit in a chain has at
-- least one Moment the caller may see in this Corner, the source Moment is one the caller can read, and no person is
-- blocked, hidden, reported or a test account. A chain is cut at the first link that fails. A chain needs at least one link.
--
-- One row per person per chain: pos 1 is the source (pursuit_title is set), the last row is the newest follower.
-- last_post_id is the newest Moment the caller may see in that person's Pursuit; the "You?" chip seeds Make your version
-- with the last row's last_post_id. Chains come newest link first (chain_no 1, 2, 3).

create or replace function public.corner_passed_along(
  p_corner text,
  p_limit integer default 3
)
returns table (
  chain_no integer,
  pos integer,
  author_id uuid,
  author_first_name text,
  pursuit_id text,
  pursuit_title text,
  last_post_id bigint
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 3), 6));
begin
  if v_me is null then
    return;
  end if;

  return query
  with recursive
  vis as (
    select p.id, p.user_id, p.pursuit_id, p.created_at
    from public.posts p
    where p.hobby_slug = any (v_spaces)
      and (p.hobby_slug || '/' || lower(coalesce(p.corner, p.sub_hobby))) = any (v_src)
      and p.pursuit_id is not null
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
  -- Pursuits with something to show here, with their newest visible Moment.
  node as (
    select distinct on (v.pursuit_id) v.pursuit_id as pid, v.user_id as uid, v.id as last_post, v.created_at as last_at
    from vis v
    order by v.pursuit_id, v.created_at desc, v.id desc
  ),
  -- follower pursuit -> source pursuit, only where the source Moment is visible (it is in vis).
  edge as (
    select f.id as follower, sv.pursuit_id as source, f.started_at as linked_at
    from public.pursuits f
    join vis sv on sv.id = f.inspired_by_post_id
    join node nf on nf.pid = f.id
    where f.id <> sv.pursuit_id
      and f.user_id <> sv.user_id
  ),
  roots as (
    select distinct e.source as pid
    from edge e
    where not exists (select 1 from edge e2 where e2.follower = e.source)
  ),
  walk as (
    select r.pid as head, 1 as depth, array[r.pid] as path, array[nr.uid] as people, null::timestamptz as linked_at
    from roots r
    join node nr on nr.pid = r.pid
    union all
    select nxt.follower, w.depth + 1, w.path || nxt.follower, w.people || nxt.uid, nxt.linked_at
    from walk w
    cross join lateral (
      select e.follower, e.linked_at, nf.uid
      from edge e
      join node nf on nf.pid = e.follower
      where e.source = w.head
        and not (e.follower = any (w.path))
        and not (nf.uid = any (w.people))
      order by e.linked_at desc, e.follower
      limit 1
    ) nxt
    where w.depth < 4
  ),
  -- The longest walk from each root is its chain; keep the ones with at least one link.
  chains as (
    select distinct on (w.path[1]) w.path, w.depth,
           (select max(w2.linked_at) from walk w2 where w2.path[1] = w.path[1]) as newest_link
    from walk w
    where w.depth >= 2
    order by w.path[1], w.depth desc
  ),
  ranked as (
    select c.path, (row_number() over (order by c.newest_link desc, c.path[1]))::integer as no
    from chains c
    order by c.newest_link desc, c.path[1]
    limit v_limit
  )
  select
    rk.no,
    (u.ord)::integer,
    nd.uid,
    left(split_part(btrim(coalesce(pf.display_name, '')), ' ', 1), 60),
    nd.pid,
    case when u.ord = 1 then left(pu.title, 24) end,
    nd.last_post
  from ranked rk
  cross join lateral unnest(rk.path) with ordinality as u(pid, ord)
  join node nd on nd.pid = u.pid
  join public.pursuits pu on pu.id = nd.pid
  join public.profiles pf on pf.id = nd.uid
  order by rk.no, u.ord;
end
$$;

revoke all on function public.corner_passed_along(text, integer) from public, anon;
grant execute on function public.corner_passed_along(text, integer) to authenticated;
