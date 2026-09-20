-- Security fix, draft only — NOT APPLIED. Closes a live, currently
-- exploitable privilege-escalation path: any authenticated user can
-- already run
--   update public.profiles set is_admin = true where id = auth.uid();
-- and have it succeed. Tested 2026-09-20 in a rolled-back transaction
-- with a non-admin throwaway account: before=false, after=true.
--
-- Root cause: "You can update your own profile" has USING (auth.uid() =
-- id) and NO with_check at all, so once the row-ownership check passes,
-- any column can be set to anything. A column-level
-- `revoke update (is_admin) ...` alone would NOT fix this: checked
-- information_schema.role_table_grants / column_privileges first —
-- authenticated and anon both hold a TABLE-level UPDATE grant on
-- profiles, and Postgres's column-privilege check is satisfied by either
-- a table-level grant OR a column-level one; a column-level REVOKE only
-- removes a column-level grant that was made at that same level; it
-- cannot subtract from a broader table-level grant. So the real fix is:
-- revoke the table-level UPDATE entirely, then grant UPDATE back only on
-- the columns users may actually change.
--
-- Column allow-list, built from grep of src/ plus the pause/deletion
-- feature this session is building support for:
--   Confirmed live write sites (grep):
--     display_name, bio   <- AccountSettings.tsx
--     avatar_url            <- AvatarPicker.tsx
--   Confirmed via AuthContext.tsx's updateProfile() allow-list (the one
--   general-purpose write path other than the two above):
--     tagline, onboarding_completed_at, onboarding_completed,
--     cover_title, cover_tagline, cover_post_id
--   theme_preference is in that same updateProfile() allow-list but is
--   NOT included in this grant — checked information_schema.columns:
--   this column does not exist yet on this database (sql/theme-
--   preference.sql hasn't run here; AuthContext.tsx already defends
--   against exactly this with its own themeColumnKnownMissing fallback).
--   Add it to this grant list when that migration runs — new user-
--   editable columns need an explicit grant here, they don't get one for
--   free from a table-level default.
--   Included per explicit decision, not currently grep-confirmed as
--   written anywhere in src/ (no pause/delete/discoverability UI exists
--   yet — this is pure database-layer support ahead of that frontend
--   work): paused_at, deletion_requested_at, discoverable,
--   show_this_corner.
--   Deliberately excluded: id (own with_check below), is_admin (the
--   vulnerability this migration closes), username (no editing flow
--   anywhere — profile_settings.username_changed_at exists but nothing
--   reads or writes it, matching grep finding no username-change call
--   at all), created_at (system-managed).
--
-- Also adds a with_check to the same UPDATE policy blocking id from
-- changing — belt-and-suspenders on top of the column grant, and closes
-- a separate small gap (id had no with_check either, so a client could
-- in principle try to move their row's identity via UPDATE).
--
-- profiles INSERT policy ("you can create your own profile") also had no
-- restriction beyond id-ownership, so a direct client-side INSERT (not
-- going through the handle_new_user trigger, which only fires on new
-- auth.users rows and never sets is_admin) could in principle set
-- is_admin = true at row creation. handle_new_user's own insert is
-- unaffected either way (SECURITY DEFINER, runs as the function owner,
-- bypasses grants and RLS entirely) — the gap was only in the INSERT
-- policy allowing a client-crafted insert. Closed with a with_check
-- addition, not a grant change, since with_check runs regardless of
-- which columns a statement explicitly lists vs. leaves to their column
-- defaults.
--
-- Checked profile_settings and the rest of profiles for other
-- privilege-like columns — none exist. profile_settings is all user
-- preferences (default_visibility, paused_until, username_changed_at,
-- notification_preferences). circle_members.role and space_members.role
-- are membership roles scoped to one circle/space each (checked their
-- own INSERT policies — already gated by ownership, not a global
-- privilege flag like profiles.is_admin), a different, already-handled
-- class of thing.

-- lock down UPDATE to an explicit column allow-list -----------------------

revoke update on public.profiles from authenticated, anon;

grant update (
  display_name,
  avatar_url,
  tagline,
  bio,
  cover_title,
  cover_tagline,
  cover_post_id,
  onboarding_completed,
  onboarding_completed_at,
  paused_at,
  deletion_requested_at,
  discoverable,
  show_this_corner
) on public.profiles to authenticated;

drop policy if exists "You can update your own profile" on public.profiles;
create policy "You can update your own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- block is_admin = true on a client-crafted INSERT -------------------------

drop policy if exists "you can create your own profile" on public.profiles;
create policy "you can create your own profile"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = id
    and coalesce(is_admin, false) = false
  );
