-- Pause: write-side check. A revoked session (see
-- docs/pause-session-revocation-plan.md) still holds a valid access token
-- until that token's own expiry — signOut only stops a NEW token from
-- being minted. This closes that gap at the database itself: a paused or
-- pending-deletion account's own INSERT/UPDATE on posts, pursuits, or
-- thoughts (comments) is rejected regardless of whether its access token
-- is still technically valid. Draft only, for review — not applied.
--
-- Scope decisions from review:
--  - Blocks on paused_at OR deletion_requested_at (both close the same
--    access-token-outlives-signOut gap; there's no reason a pending-deletion
--    account should keep posting during its grace period either).
--  - reactions, bookmarks, post_likes, and profile_follows are deliberately
--    NOT touched — those are unblocked per explicit instruction.
--  - Every consolidated policy below is `to authenticated` only, even
--    where one of the two originals it replaces was `{public}` — anon
--    never had a valid auth.uid() to satisfy these checks anyway, this
--    just makes that explicit rather than implicit.
--  - DELETE is untouched on every table here. Verified against a live
--    pg_policies read (2026-09-20): the only DELETE policies on posts and
--    pursuits are the pre-existing owner-only ones below, and this
--    migration never drops or replaces any of them, so no new DELETE
--    policy is needed:
--      posts    DELETE "You can delete your own posts"     roles={public}        qual: auth.uid() = user_id
--      posts    DELETE "you delete your own moments"        roles={public}        qual: auth.uid() = user_id
--      pursuits DELETE "you can delete your own pursuit"    roles={authenticated} qual: auth.uid() = user_id
--      pursuits DELETE "you delete your own pursuits"       roles={public}        qual: auth.uid() = user_id
--      thoughts DELETE "you can remove your own thought"    roles={public}        qual: auth.uid() = user_id
--  - thoughts has no UPDATE policy at all today (confirmed live) — comments
--    can only be inserted or deleted, never edited. So "extend to thoughts
--    INSERT/UPDATE" only has an INSERT policy to touch; no new UPDATE
--    policy is added here, since that would newly enable comment editing
--    as a side effect rather than closing an existing gap. Flagging this
--    rather than assuming — say if a thoughts UPDATE policy should exist
--    at all, pause aside.
--  - storage.objects (post-media uploads) is a separate schema with its
--    own policy shape; a proposed follow-up draft for it is in
--    supabase/migrations/20260920000100_pause_storage_upload_check.sql,
--    also not applied — left as a comment only, not drafted further.
--  - profiles is not touched by this migration at all. Confirmed live
--    (2026-09-20): its only UPDATE policy is "You can update your own
--    profile" (roles={public}, using: auth.uid() = id, with_check: null —
--    no with_check means any new column values are allowed once the using
--    clause matches the existing row). A paused or deletion-pending user
--    can still run `update profiles set paused_at = null` or
--    `deletion_requested_at = null` on their own row; tested explicitly
--    for both columns below.
--
-- Every existing posts/pursuits INSERT and UPDATE policy this migration
-- drops (live pg_policies read, 2026-09-20) — all functionally identical
-- pairs, the same duplicate-policy pattern migration (b) consolidated for
-- SELECT on these same two tables:
--   posts    INSERT "You can post as yourself"          roles={public}        with_check: auth.uid() = user_id
--   posts    INSERT "you post your own moments"          roles={authenticated} with_check: auth.uid() = user_id
--   posts    UPDATE "You can edit or delete your own posts" roles={public}     using: auth.uid() = user_id (no with_check)
--   posts    UPDATE "own posts are editable"              roles={public}       using+with_check: auth.uid() = user_id
--   pursuits INSERT "you can start a pursuit"             roles={authenticated} with_check: auth.uid() = user_id
--   pursuits INSERT "you create your own pursuits"        roles={authenticated} with_check: auth.uid() = user_id
--   pursuits UPDATE "you can update your own pursuit"     roles={authenticated} using+with_check: auth.uid() = user_id
--   pursuits UPDATE "you edit your own pursuits"          roles={public}       using+with_check: auth.uid() = user_id
--   thoughts INSERT "anyone signed in can add a thought"  roles={authenticated} with_check: auth.uid() = user_id
-- Each pair collapses into one consolidated policy below, same as (b).

create or replace function public.write_blocked()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.paused_at is not null or p.deletion_requested_at is not null)
  );
$$;

-- Only signed-in users ever need this (anon has no auth.uid() to check
-- against anyway); revoke the default PUBLIC grant so anon doesn't carry
-- it, and grant explicitly to authenticated.
revoke execute on function public.write_blocked() from public;
revoke execute on function public.write_blocked() from anon;
grant execute on function public.write_blocked() to authenticated;

-- posts ----------------------------------------------------------------

drop policy if exists "You can post as yourself" on public.posts;
drop policy if exists "you post your own moments" on public.posts;
create policy "you post your own moments"
  on public.posts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );

drop policy if exists "You can edit or delete your own posts" on public.posts;
drop policy if exists "own posts are editable" on public.posts;
create policy "own posts are editable"
  on public.posts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );

-- pursuits ---------------------------------------------------------------

drop policy if exists "you can start a pursuit" on public.pursuits;
drop policy if exists "you create your own pursuits" on public.pursuits;
create policy "you create your own pursuits"
  on public.pursuits for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );

drop policy if exists "you can update your own pursuit" on public.pursuits;
drop policy if exists "you edit your own pursuits" on public.pursuits;
create policy "you edit your own pursuits"
  on public.pursuits for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );

-- thoughts (comments) ------------------------------------------------------
-- INSERT only — see note above on why no UPDATE policy is added.

drop policy if exists "anyone signed in can add a thought" on public.thoughts;
create policy "anyone signed in can add a thought"
  on public.thoughts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );
