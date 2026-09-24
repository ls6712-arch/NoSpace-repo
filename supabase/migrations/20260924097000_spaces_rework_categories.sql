-- Sushii: Spaces Rework Phase 2 — categories cleanup.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924095000_spaces_rework_cleanup.sql.
--   Independent of 20260924100000_visibility and 20260924110000_schema —
--   order relative to those two doesn't matter.
--
-- Three things, all found while answering questions about this rework's
-- live-data audit:
--
--   1. "the-lego-makers" (public.categories, active=true, created
--      2026-09-21) is a database-only custom Space — the 16th slot the
--      unified 15-item Category model (this rework's own decision) doesn't
--      have room for. Treated like the other old Spaces: exported, then
--      removed. Its 2 Moments are remapped to crafts-making rather than
--      left pointing at a slug that's about to stop existing.
--
--   2. All 15 built-in category rows currently have active=false, which
--      hobbies.ts's applySpaceRows() (hidden: r.active === false) turns
--      into `hidden: true`, and visibleSpaces() filters hidden ones out of
--      every browsable list. Fixed by setting active=true on all 15.
--
--      Spec change, after this file was first written: Categories are now
--      internal-only — nobody ever sees or picks one directly, so this fix
--      no longer restores 15 visible Discover chips (that whole surface is
--      removed). It still matters: `hidden`/`active` still gates whether
--      guessCornerCategory()-style keyword matching and any other internal
--      ranking machinery considers a Category, and AdminSpaces.tsx (rename/
--      hide/reset) still reads it. Whatever caused all 15 to be off (looks
--      like bulk admin-panel testing, not an intentional launch state)
--      shouldn't leave built-in Category plumbing silently disabled either
--      way, so the fix stands unchanged.
--
--   3. "Suggest a Space" is disabled: category_suggestions can no longer
--      be inserted by anyone (there was no live UI entry point for this
--      already — grep confirms CategoriesContext's suggest() is exported
--      but never called from any component — but the RLS itself still
--      allowed any signed-in user to submit one directly via the API, so
--      that's closed too), and public.categories can no longer accept an
--      INSERT for any slug that isn't one of the 15 built-ins — blocking
--      new database-only "Spaces" from being created via the old admin
--      tool (src/app/pages/AdminSpaces.tsx's "Create a Space" form, now
--      removed from that page in this same commit). Admins can still
--      UPDATE/DELETE existing rows (rename, hide, reset a built-in) —
--      only creating a NEW custom Space-as-category row is blocked.
--      Creating communities moves to the Create Space form in Phase 5.
--
-- Safe to re-run: the categories/posts changes are idempotent (delete/
-- update are naturally re-runnable), and the RLS statements use
-- drop-then-create.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Export, then remove "the-lego-makers".
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists archive.categories_20260924 as
  table public.categories;
revoke all on archive.categories_20260924 from anon, authenticated;

do $$
declare
  affected_ids bigint[];
begin
  select array_agg(id order by id) into affected_ids
  from public.posts where hobby_slug = 'the-lego-makers';

  raise notice 'Moments to remap from the-lego-makers to crafts-making: %', affected_ids;

  update public.posts set hobby_slug = 'crafts-making' where hobby_slug = 'the-lego-makers';

  raise notice 'Remapped % Moment(s) to crafts-making: %', coalesce(array_length(affected_ids, 1), 0), affected_ids;
end
$$;

delete from public.categories where slug = 'the-lego-makers';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. All 15 built-ins visible.
-- ─────────────────────────────────────────────────────────────────────────
update public.categories
set active = true, updated_at = now()
where slug in (
  'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
  'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
  'music', 'photography-film', 'health-wellness', 'fashion-beauty',
  'tech-building', 'collecting-fandom', 'travel-adventure'
)
and (active is distinct from true);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Disable "Suggest a Space" / creating new database-only Spaces.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "anyone signed in can suggest" on public.category_suggestions;
-- No replacement insert policy — RLS defaults to deny, so nobody (not even
-- an admin) can insert a new suggestion. The review UI (AdminCategories.tsx)
-- still works on whatever's already there.

drop policy if exists "reviewers manage categories" on public.categories;

-- Live-database correction (caught before running, 2026-09-24, by
-- cross-checking docs/schema-baseline-20260920.sql before handing this
-- file off — same shape of bug as the earlier are_connected/is_space_member
-- ones): is_admin(uuid) lives in the `private` schema on this database, not
-- `public`. The very policy this migration drops two statements up
-- ("reviewers manage categories") already called private.is_admin(auth.
-- uid()) correctly — these three replace it and need to match, or every
-- CREATE POLICY below fails outright with "function public.is_admin(uuid)
-- does not exist" (it would fail at CREATE time, not just at use).
create policy "reviewers insert built-in overrides only"
  on public.categories for insert to authenticated
  with check (
    private.is_admin(auth.uid())
    and slug = any (array[
      'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
      'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
      'music', 'photography-film', 'health-wellness', 'fashion-beauty',
      'tech-building', 'collecting-fandom', 'travel-adventure'
    ])
  );

create policy "reviewers update categories"
  on public.categories for update to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

create policy "reviewers delete categories"
  on public.categories for delete to authenticated
  using (private.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Check it
-- ─────────────────────────────────────────────────────────────────────────
-- Should be 15 rows, all active=true:
-- select slug, active from public.categories order by slug;
-- Should be 0:
-- select count(*) from public.posts where hobby_slug not in (
--   'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
--   'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
--   'music', 'photography-film', 'health-wellness', 'fashion-beauty',
--   'tech-building', 'collecting-fandom', 'travel-adventure'
-- );
