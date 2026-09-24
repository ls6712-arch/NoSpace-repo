-- Rollback for 20260924097000_spaces_rework_categories.sql.
--
-- Draft only — staged for review, not run.
--
-- Only usable if that migration's export step ran and archive.categories_
-- 20260924 still exists.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Restore the old RLS shape.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "reviewers delete categories" on public.categories;
drop policy if exists "reviewers update categories" on public.categories;
drop policy if exists "reviewers insert built-in overrides only" on public.categories;

create policy "reviewers manage categories"
  on public.categories for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "anyone signed in can suggest" on public.category_suggestions;
create policy "anyone signed in can suggest"
  on public.category_suggestions for insert to authenticated
  with check (suggested_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Restore active=false on the built-ins that had it (only the ones the
--    migration actually changed — anything an admin has since flipped by
--    hand stays as they set it).
-- ─────────────────────────────────────────────────────────────────────────
update public.categories c
set active = false, updated_at = now()
from archive.categories_20260924 a
where c.slug = a.slug
  and a.active = false
  and c.active = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Restore "the-lego-makers" and its Moments' hobby_slug.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.categories
select * from archive.categories_20260924 a
where a.slug = 'the-lego-makers'
  and not exists (select 1 from public.categories c where c.slug = a.slug);

-- Only reachable if you still have the id list this migration's RAISE
-- NOTICE printed when it ran — paste them in below. Without that list,
-- there's no reliable way to tell "remapped from the-lego-makers" apart
-- from a post that was always crafts-making.
-- update public.posts set hobby_slug = 'the-lego-makers' where id in (/* paste ids here */);
