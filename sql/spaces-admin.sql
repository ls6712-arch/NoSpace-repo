-- NoSpace: admin-managed Spaces.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Requires sql/categories.sql (the `categories` table and
-- `is_admin()`) and sql/security-hardening.sql to have been run first.
--
-- What this adds
--   1. The columns an admin needs to shape a Space: whether it is shown,
--      its one-line prompt, and its position in lists.
--   2. A row in `categories` now means one of two things:
--        - a slug that is NOT one of the fifteen built-ins = a Space that
--          exists only in the database (created by an admin, or approved from
--          a suggestion);
--        - a slug that IS a built-in = an override for it (rename, reword,
--          reorder, or hide). Deleting that row restores the built-in default.
--   3. Two admin-only functions: delete a Space only when nothing points at
--      it, or move everything to another Space first.
--
-- Deleting is deliberately narrow. Posts store the Space they belong to, so
-- removing a Space that still has posts would orphan real people's photos.
-- The default, reversible action is "hide" (active = false): the Space
-- disappears from every list, while posts, profiles and old links keep
-- working. The fifteen built-ins can be hidden but never hard-deleted.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.categories add column if not exists active boolean not null default true;
alter table public.categories add column if not exists prompt text;
alter table public.categories add column if not exists sort_order integer;
alter table public.categories add column if not exists updated_at timestamptz not null default now();

-- Slugs end up in URLs and in every post's hobby_slug, so keep them tame.
-- NOT VALID: only new and changed rows are checked, so an existing approved
-- category with an odd slug can't make this migration fail.
alter table public.categories drop constraint if exists categories_slug_format;
alter table public.categories
  add constraint categories_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 48) not valid;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Who can read the list
--
--    categories.sql limited reads to signed-in people, back when nothing
--    signed-out ever needed them. The landing page is public and lists
--    Spaces, so it has to know which ones an admin has hidden. Nothing in
--    this table is private: a name, a description and a prompt.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "categories are readable when signed in" on public.categories;
drop policy if exists "categories are readable by anyone" on public.categories;
create policy "categories are readable by anyone"
  on public.categories for select using (true);
-- ("reviewers manage categories", from categories.sql, already gives admins
-- insert / update / delete and nobody else. Left untouched.)

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Corners inside admin-created Spaces
--
--    security-hardening.sql section 5 limited new Corners to the fifteen
--    built-in slugs. A Space an admin creates needs to be allowed too.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "anyone signed in can create a corner" on public.corners;
create policy "anyone signed in can create a corner"
  on public.corners for insert to authenticated
  with check (
    space_slug = any (array[
      'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
      'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
      'music', 'photography-film', 'health-wellness', 'fashion-beauty',
      'tech-building', 'collecting-fandom', 'travel-adventure'
    ])
    or exists (select 1 from public.categories c where c.slug = space_slug)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. What still points at a Space
--
--    SECURITY DEFINER because a private post still counts as "in" a Space
--    even though this admin can't read it under RLS. Admin-only.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.space_usage(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'posts',    (select count(*) from public.posts    where hobby_slug = p_slug),
    'pursuits', (select count(*) from public.pursuits where hobby_slug = p_slug),
    'circles',  (select count(*) from public.circles  where hobby_slug = p_slug),
    -- A Corner with no Moments left in it is just a name; only ones that
    -- still hold Moments count as in use.
    'corners',  (select count(*) from public.corners  where space_slug = p_slug and moment_count > 0)
  );
end;
$$;

revoke all on function public.space_usage(text) from public, anon;
grant execute on function public.space_usage(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Delete a Space — only when nothing points at it
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_delete_space(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usage jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  -- The fifteen built-ins live in code and are referenced everywhere, so the
  -- server refuses to delete them no matter what the client sends.
  if p_slug = any (array[
    'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
    'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
    'music', 'photography-film', 'health-wellness', 'fashion-beauty',
    'tech-building', 'collecting-fandom', 'travel-adventure'
  ]) then
    raise exception 'Built-in Spaces can be hidden but not deleted.';
  end if;

  if not exists (select 1 from public.categories where slug = p_slug) then
    raise exception 'That Space doesn''t exist.';
  end if;

  -- Empty Corners are just names; clear them so they don't block the delete.
  delete from public.corners where space_slug = p_slug and moment_count = 0;

  usage := public.space_usage(p_slug);
  if (usage->>'posts')::int > 0
     or (usage->>'pursuits')::int > 0
     or (usage->>'circles')::int > 0
     or (usage->>'corners')::int > 0 then
    raise exception 'Still in use: % Moments, % Pursuits, % Circles. Move them to another Space first, or hide this one instead.',
      usage->>'posts', usage->>'pursuits', usage->>'circles';
  end if;

  delete from public.categories where slug = p_slug;
end;
$$;

revoke all on function public.admin_delete_space(text) from public, anon;
grant execute on function public.admin_delete_space(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Move everything from one Space into another
--
--    The escape hatch that makes "delete" possible for a Space that has
--    content. Moments keep their Corner tags; the posts trigger in
--    corners.sql re-counts them under the new Space. Returns what moved.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_move_space_content(p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_posts int;
  n_pursuits int;
  n_circles int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Pick two different Spaces.';
  end if;

  update public.posts set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_posts = row_count;

  update public.pursuits set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_pursuits = row_count;

  update public.circles set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_circles = row_count;

  return jsonb_build_object('posts', n_posts, 'pursuits', n_pursuits, 'circles', n_circles);
end;
$$;

revoke all on function public.admin_move_space_content(text, text) from public, anon;
grant execute on function public.admin_move_space_content(text, text) to authenticated;
