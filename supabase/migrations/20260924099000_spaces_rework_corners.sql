-- Sushii: Spaces Rework — Corners become the only browse/tag layer a user
-- ever sees. This adds what that needs on top of sql/corners.sql: hiding,
-- a trademark blocklist, a query-time 30-day activity count (for
-- Discover's "only show a Corner once it's actually active" rule), and
-- admin merge/rename/hide.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924098000_spaces_rework_app_config.sql (this file's
--   blocklist constraint calls public.is_blocklisted_name(), defined
--   there). Order relative to 20260924100000_visibility and
--   20260924110000_schema doesn't matter, as long as app_config ran first.
--
-- Safe to re-run: ALTER ... ADD COLUMN/CONSTRAINT IF NOT EXISTS-shaped,
-- CREATE OR REPLACE for functions.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Hide, and a trademark blocklist on the name anyone signed in can set
--    just by tagging (sql/corners.sql's insert policy is `with check
--    (true)` — no admin gate — so this has to be a CHECK constraint, not
--    an RLS policy, to actually stop it regardless of who's inserting).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.corners add column if not exists hidden boolean not null default false;

alter table public.corners drop constraint if exists corners_name_not_blocklisted;
alter table public.corners add constraint corners_name_not_blocklisted
  check (not public.is_blocklisted_name(name));

-- Hidden Corners stay readable (existing Moments/links that reference one
-- must keep resolving — same "hide never breaks a link" rule
-- spaces-admin.sql already established for Spaces-as-categories) but are
-- filtered out of every browse surface client-side, same pattern as
-- hobbies.ts's `hidden` flag on a Category. No RLS change needed here.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. 30-day activity, computed at query time — not a trigger-maintained
--    column, so there's no rolling-window drift to keep correct. Discover
--    reads this (not corners.moment_count, which is lifetime) to decide
--    what's actually active right now.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.corner_activity_30d()
returns table(space_slug text, slug text, moments_30d bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.hobby_slug as space_slug, coalesce(p.corner, p.sub_hobby) as slug, count(*) as moments_30d
  from public.posts p
  where p.visibility = 'public'
    and coalesce(p.corner, p.sub_hobby) is not null
    and p.created_at > now() - interval '30 days'
  group by 1, 2;
$$;
revoke all on function public.corner_activity_30d() from public;
grant execute on function public.corner_activity_30d() to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Admin: rename, hide, merge.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_rename_corner(p_corner_id bigint, p_new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  -- The blocklist constraint (section 1) still applies to this UPDATE —
  -- an admin can't rename a Corner into a blocked name either.
  update public.corners set name = p_new_name where id = p_corner_id;
end;
$$;
revoke all on function public.admin_rename_corner(bigint, text) from public, anon;
grant execute on function public.admin_rename_corner(bigint, text) to authenticated;

create or replace function public.admin_hide_corner(p_corner_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  update public.corners set hidden = p_hidden where id = p_corner_id;
end;
$$;
revoke all on function public.admin_hide_corner(bigint, boolean) from public, anon;
grant execute on function public.admin_hide_corner(bigint, boolean) to authenticated;

-- Merge p_from_id into p_into_id: every Moment, Pursuit, Space link and
-- Interest that pointed at the old Corner now points at the kept one, in
-- both its space_slug (Category) and slug (Corner) — a merge can cross
-- Category lines (e.g. a Corner that was miscategorized), and once merged
-- the Moment's Category is the kept Corner's, since Category is now
-- always derived from Corner. Returns what moved, so the admin UI can
-- report real counts rather than "done".
create or replace function public.admin_merge_corners(p_from_id bigint, p_into_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from record;
  v_into record;
  n_posts int;
  n_pursuits int;
  n_spaces int;
  n_interests int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  if p_from_id = p_into_id then
    raise exception 'Pick two different Corners.';
  end if;

  select * into v_from from public.corners where id = p_from_id;
  select * into v_into from public.corners where id = p_into_id;
  if v_from.id is null or v_into.id is null then
    raise exception 'That Corner doesn''t exist.';
  end if;

  -- Moments. The existing corners_sync trigger on posts (sql/corners.sql)
  -- fires on this UPDATE like any other, so v_into's moment_count picks up
  -- what moves here and v_from's drains — no manual recount needed.
  update public.posts
     set corner = v_into.slug,
         sub_hobby = v_into.slug,
         hobby_slug = v_into.space_slug
   where hobby_slug = v_from.space_slug
     and coalesce(corner, sub_hobby) = v_from.slug;
  get diagnostics n_posts = row_count;

  -- Pursuits.
  update public.pursuits
     set sub_hobby = v_into.slug,
         hobby_slug = v_into.space_slug
   where hobby_slug = v_from.space_slug
     and sub_hobby = v_from.slug;
  get diagnostics n_pursuits = row_count;

  -- Spaces (space_corners): move the link, but a Space that's somehow
  -- already linked to both Corners would collide on the primary key —
  -- drop the from-row for those instead of moving it. If the merged-away
  -- Corner was a Space's primary, promote the kept one for that Space (the
  -- sync_space_category_from_corner trigger, 20260924110000, then
  -- recomputes spaces.category_slug from it automatically).
  update public.space_corners sc
     set corner_id = v_into.id,
         is_primary = sc.is_primary
   where sc.corner_id = v_from.id
     and not exists (
       select 1 from public.space_corners x
       where x.space_id = sc.space_id and x.corner_id = v_into.id
     );
  get diagnostics n_spaces = row_count;
  delete from public.space_corners where corner_id = v_from.id;

  -- Interests (hobby_follows) — a user might already follow both spellings;
  -- keep one row per user.
  update public.hobby_follows hf
     set hobby_key = v_into.slug
   where hf.hobby_key = v_from.slug
     and not exists (
       select 1 from public.hobby_follows x
       where x.user_id = hf.user_id and x.hobby_key = v_into.slug
     );
  get diagnostics n_interests = row_count;
  delete from public.hobby_follows where hobby_key = v_from.slug;

  delete from public.corners where id = v_from.id;

  return jsonb_build_object(
    'moments', n_posts,
    'pursuits', n_pursuits,
    'spaces', n_spaces,
    'interests', n_interests
  );
end;
$$;
revoke all on function public.admin_merge_corners(bigint, bigint) from public, anon;
grant execute on function public.admin_merge_corners(bigint, bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select * from public.corner_activity_30d() order by moments_30d desc limit 10;
-- select id, space_slug, slug, name, hidden, moment_count from public.corners order by moment_count desc limit 10;
