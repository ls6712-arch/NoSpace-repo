-- Soosh: what a person's own activity says about which Corners they like, for
-- ordering the Corners home (/corners). Read-only: it creates one function and
-- changes no table, policy or existing function.
--
-- Run AFTER 20261028000000_stubs.sql.
--
-- public.my_corner_affinity() returns one row per Corner (hobby_slug is the
-- Corner's old Space, corner its slug; corner = '' is the whole Space) with
-- three scores, each 0 to 1:
--
--   mine      what the CALLER did, decayed with a 45 day half-life: their own
--             Moments (every audience, private ones included), Pursuits (as
--             owner or member), likes and saves of public Moments, followed
--             Corners, joined Spaces' Corners, and "I'm going" RSVPs.
--             Saturating: 1 - exp(-weight / 3), so one recent Moment is about
--             0.63 and several are near 1.
--   peers     "people like you": for each other person with public Moments in
--             the last 90 days, how many Corners they share with the caller's
--             (cosine on the sets of Corners), summed over the people who
--             post in a Corner. Counted only when 2 or more different people
--             contribute, so no single person's activity can be read off it.
--   trending  how many different people posted publicly in the Corner in the
--             last 30 days. Counted only at 2 or more people.
--
-- Privacy: SECURITY DEFINER so it can read other people's PUBLIC Moments in
-- aggregate. It reads the caller's own private rows only for the caller (the
-- uid comes from auth.uid(), never an argument), and the output never names
-- or points at another person. Anonymous callers get nothing (no execute).
--
-- Nothing is stored and nothing is a count shown to anyone: the app uses the
-- scores only to order rows and cards for the person asking.
--
-- Every column is table-qualified, including inside subqueries (CLAUDE.md).

create or replace function public.my_corner_affinity()
returns table (hobby_slug text, corner text, mine double precision, peers double precision, trending double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return;
  end if;

  return query
  with raw as (
    -- Own Moments, whoever can see them.
    select p.hobby_slug::text as h, lower(coalesce(p.corner, p.sub_hobby))::text as c,
           3.0::double precision * power(0.5::double precision, extract(epoch from (now() - p.created_at))::double precision / 86400.0 / 45.0) as w
      from public.posts p
     where p.user_id = v_me
    union all
    -- Own Pursuits.
    select pu.hobby_slug::text, lower(pu.sub_hobby)::text,
           4.0::double precision * power(0.5::double precision, extract(epoch from (now() - pu.started_at))::double precision / 86400.0 / 45.0)
      from public.pursuits pu
     where pu.user_id = v_me
    union all
    -- Pursuits they are an active member of.
    select pu.hobby_slug::text, lower(pu.sub_hobby)::text,
           3.0::double precision * power(0.5::double precision, extract(epoch from (now() - pm.created_at))::double precision / 86400.0 / 45.0)
      from public.pursuit_members pm
      join public.pursuits pu on pu.id = pm.pursuit_id
     where pm.user_id = v_me and pm.status = 'active' and pu.user_id <> v_me
    union all
    -- Likes of public Moments.
    select p.hobby_slug::text, lower(coalesce(p.corner, p.sub_hobby))::text,
           1.5::double precision * power(0.5::double precision, extract(epoch from (now() - pl.created_at))::double precision / 86400.0 / 45.0)
      from public.post_likes pl
      join public.posts p on p.id = pl.post_id
     where pl.user_id = v_me and p.visibility = 'public'
    union all
    -- Saves of public Moments.
    select p.hobby_slug::text, lower(coalesce(p.corner, p.sub_hobby))::text,
           2.0::double precision * power(0.5::double precision, extract(epoch from (now() - b.created_at))::double precision / 86400.0 / 45.0)
      from public.bookmarks b
      join public.posts p on p.id = b.post_id
     where b.user_id = v_me and p.visibility = 'public'
    union all
    -- Followed Corners ('space:slug') and Spaces-level follows ('space').
    select split_part(hf.hobby_key, ':', 1)::text, nullif(split_part(hf.hobby_key, ':', 2), '')::text,
           2.0::double precision * power(0.5::double precision, extract(epoch from (now() - hf.created_at))::double precision / 86400.0 / 45.0)
      from public.hobby_follows hf
     where hf.user_id = v_me
    union all
    -- Corners of Spaces they are an active member of.
    select co.space_slug::text, co.slug::text,
           2.0::double precision * power(0.5::double precision, extract(epoch from (now() - sm.joined_at))::double precision / 86400.0 / 45.0)
      from public.space_members sm
      join public.space_corners sc on sc.space_id = sm.space_id
      join public.corners co on co.id = sc.corner_id
     where sm.user_id = v_me and sm.status = 'active'
    union all
    -- Events they said they are going to, by the Space's Corners.
    select co.space_slug::text, co.slug::text,
           2.5::double precision * power(0.5::double precision, extract(epoch from (now() - r.created_at))::double precision / 86400.0 / 45.0)
      from public.event_rsvps r
      join public.space_events e on e.id = r.event_id
      join public.space_corners sc on sc.space_id = e.space_id
      join public.corners co on co.id = sc.corner_id
     where r.user_id = v_me
  ),
  mine_corner as (
    select r.h, r.c, sum(r.w) as w
      from raw r
     where r.h is not null and r.h <> '' and r.c is not null and r.c <> ''
     group by r.h, r.c
  ),
  mine_hobby as (
    select r.h, sum(r.w) as w
      from raw r
     where r.h is not null and r.h <> ''
     group by r.h
  ),
  my_set as (
    select mc.h, mc.c from mine_corner mc where mc.w >= 0.25
  ),
  -- One row per other person and Corner they posted in publicly, last 90 days.
  pub as (
    select distinct p.user_id as u, p.hobby_slug::text as h, lower(coalesce(p.corner, p.sub_hobby))::text as c
      from public.posts p
     where p.visibility = 'public'
       and p.user_id <> v_me
       and p.created_at > now() - interval '90 days'
       and coalesce(p.corner, p.sub_hobby) is not null
       and coalesce(p.corner, p.sub_hobby) <> ''
  ),
  pub_size as (
    select pb.u, count(*) as n from pub pb group by pb.u
  ),
  overlap as (
    select pb.u, count(*) as k
      from pub pb
      join my_set ms on ms.h = pb.h and ms.c = pb.c
     group by pb.u
  ),
  neighbor as (
    select o.u,
           o.k::double precision / sqrt((select count(*) from my_set)::double precision * ps.n::double precision) as sim
      from overlap o
      join pub_size ps on ps.u = o.u
  ),
  peer as (
    select pb.h, pb.c, sum(nb.sim) as s, count(*) as n
      from pub pb
      join neighbor nb on nb.u = pb.u
     group by pb.h, pb.c
  ),
  trend as (
    select p.hobby_slug::text as h, lower(coalesce(p.corner, p.sub_hobby))::text as c, count(distinct p.user_id) as n
      from public.posts p
     where p.visibility = 'public'
       and p.created_at > now() - interval '30 days'
       and coalesce(p.corner, p.sub_hobby) is not null
       and coalesce(p.corner, p.sub_hobby) <> ''
     group by p.hobby_slug, lower(coalesce(p.corner, p.sub_hobby))
  ),
  keys as (
    select mc.h, mc.c from mine_corner mc
    union
    select pe.h, pe.c from peer pe where pe.n >= 2
    union
    select t.h, t.c from trend t where t.n >= 2
  )
  select k.h, k.c,
         coalesce(1.0 - exp(-mc.w / 3.0), 0.0)::double precision,
         case when pe.n >= 2 then (1.0 - exp(-pe.s * 2.0))::double precision else 0.0::double precision end,
         case when t.n >= 2 then (1.0 - exp(-t.n::double precision / 5.0))::double precision else 0.0::double precision end
    from keys k
    left join mine_corner mc on mc.h = k.h and mc.c = k.c
    left join peer pe on pe.h = k.h and pe.c = k.c
    left join trend t on t.h = k.h and t.c = k.c
  union all
  select mh.h, ''::text, (1.0 - exp(-mh.w / 3.0))::double precision, 0.0::double precision, 0.0::double precision
    from mine_hobby mh;
end;
$$;

revoke all on function public.my_corner_affinity() from public, anon;
grant execute on function public.my_corner_affinity() to authenticated;
