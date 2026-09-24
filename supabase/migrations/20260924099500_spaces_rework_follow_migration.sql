-- Sushii: Spaces Rework — migrate existing Corner-level hobby_follows rows
-- from a bare slug to the composite "space_slug:slug" key
-- (src/app/context/CornersContext.tsx's cornerFollowKey, added the same
-- day this file was — see that commit's message for why a bare slug is
-- ambiguous: corners.slug is only unique within one Category).
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924099000_spaces_rework_corners.sql (uses
--   public.corners; no hard ordering requirement otherwise).
--
-- A bare-slug row converts when its slug matches exactly one Category's
-- Corner. Two things are deliberately left alone, and reported by the two
-- SELECTs at the bottom rather than guessed at:
--   - Ambiguous: the same slug exists as a Corner in more than one
--     Category — there's no way to tell which one this follow meant.
--   - No match: the slug isn't a real Corner anywhere. Most likely a
--     curated-baseline Corner (hobbies.ts's subItems) nobody has ever
--     actually tagged a Moment with yet, so it has no row in
--     public.corners for this migration to resolve against — that's a
--     real gap in what SQL alone can figure out, not a bug to silently
--     paper over with a guess.
-- Whoever runs this should look at both lists and decide by hand (rename
-- the follow's key directly, or leave it) — this migration does not do
-- that guessing for you.
--
-- Idempotent: a row already converted (contains ":") is not a candidate on
-- a second run, and the update below only ever touches rows still in the
-- bare-slug form.

create schema if not exists archive;
create table if not exists archive.hobby_follows_bare_slug_20260924 as
  table public.hobby_follows
  with no data;
insert into archive.hobby_follows_bare_slug_20260924
select * from public.hobby_follows
where hobby_key not like '%:%'
  and not exists (
    select 1 from archive.hobby_follows_bare_slug_20260924 a
    where a.user_id = public.hobby_follows.user_id and a.hobby_key = public.hobby_follows.hobby_key
  );

-- Convert the unambiguous ones. A user who somehow already follows both
-- the bare and composite spelling of the same Corner keeps the composite
-- row only (see the DELETE below) rather than erroring on the duplicate.
with candidates as (
  select hf.user_id, hf.hobby_key
  from public.hobby_follows hf
  where hf.hobby_key not like '%:%'
),
matches as (
  select c.space_slug, cand.user_id, cand.hobby_key
  from candidates cand
  join public.corners c on c.slug = cand.hobby_key
),
unambiguous as (
  select hobby_key, min(space_slug) as space_slug
  from matches
  group by hobby_key
  having count(distinct space_slug) = 1
)
update public.hobby_follows hf
set hobby_key = u.space_slug || ':' || hf.hobby_key
from unambiguous u
where hf.hobby_key = u.hobby_key
  and not exists (
    select 1 from public.hobby_follows x
    where x.user_id = hf.user_id and x.hobby_key = u.space_slug || ':' || hf.hobby_key
  );

-- The duplicates the UPDATE above skipped (composite row already existed)
-- are still sitting in the bare-slug form — drop them now that they're
-- redundant, not a real second follow.
with candidates as (
  select hf.user_id, hf.hobby_key
  from public.hobby_follows hf
  where hf.hobby_key not like '%:%'
),
matches as (
  select c.space_slug, cand.user_id, cand.hobby_key
  from candidates cand
  join public.corners c on c.slug = cand.hobby_key
),
unambiguous as (
  select hobby_key, min(space_slug) as space_slug
  from matches
  group by hobby_key
  having count(distinct space_slug) = 1
)
delete from public.hobby_follows hf
using unambiguous u
where hf.hobby_key = u.hobby_key
  and exists (
    select 1 from public.hobby_follows x
    where x.user_id = hf.user_id and x.hobby_key = u.space_slug || ':' || hf.hobby_key
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Left unconverted, on purpose — see this file's header. Read both.
-- ─────────────────────────────────────────────────────────────────────────

-- Ambiguous: same bare slug is a real Corner in more than one Category.
select hf.hobby_key,
       string_agg(distinct c.space_slug, ', ' order by c.space_slug) as categories,
       count(distinct hf.user_id) as users_affected
from public.hobby_follows hf
join public.corners c on c.slug = hf.hobby_key
where hf.hobby_key not like '%:%'
group by hf.hobby_key;

-- No match: bare slug isn't a real Corner in any Category (likely a
-- curated-baseline Corner never yet tagged into a real row).
select hf.hobby_key, count(distinct hf.user_id) as users_affected
from public.hobby_follows hf
where hf.hobby_key not like '%:%'
  and not exists (select 1 from public.corners c where c.slug = hf.hobby_key)
group by hf.hobby_key;
