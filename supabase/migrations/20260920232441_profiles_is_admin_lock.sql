-- Security fix, draft only — NOT APPLIED. Closes a live, currently
-- exploitable privilege-escalation path: any authenticated user can
-- already run
--   update public.profiles set is_admin = true where id = auth.uid();
-- and have it succeed. Tested 2026-09-20 in a rolled-back transaction
-- with a non-admin throwaway account: before=false, after=true.
--
-- Applied 2026-09-20 as migration profiles_is_admin_lock
-- (v20260920232441), after 20260920005000_theme_preference.sql. Full
-- test suite re-run against the live, committed state: is_admin
-- escalation blocked, normal update succeeds, paused_at set/cleared
-- succeeds, theme_preference update succeeds, insert with is_admin=true
-- blocked, signup-shaped upsert (id + display_name, matching the actual
-- client code) succeeds. A username-included variant of that same
-- upsert correctly fails (permission denied) — username is deliberately
-- not in the allow-list; the real signup code doesn't send it either.
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
--     cover_title, cover_tagline, cover_post_id, theme_preference
--   theme_preference now included: apply order is
--   20260920005000_theme_preference.sql (adds the column) BEFORE this
--   migration. It's read via ThemeContext.tsx's updateProfile({
--   theme_preference: pref }) call.
--   Included per explicit decision, not currently grep-confirmed as
--   written anywhere in src/ (no pause/delete/discoverability UI exists
--   yet — this is pure database-layer support ahead of that frontend
--   work): paused_at, deletion_requested_at, discoverable,
--   show_this_corner.
--   id is ALSO included, despite the with_check below already blocking
--   any actual identity change. Found by testing the exact SQL shape
--   PostgREST's merge-duplicates upsert generates for
--   AuthContext.tsx's signup call
--   (.from("profiles").upsert({ id, display_name }, { onConflict: "id" })):
--   it produces
--     insert ... on conflict (id) do update set id = excluded.id, display_name = excluded.display_name
--   — every payload column appears in the DO UPDATE SET clause, including
--   the conflict target itself, even though its value never changes.
--   Postgres requires UPDATE privilege on every column named in a SET
--   clause regardless of whether the value actually changes, so without
--   id in this grant that signup upsert would fail outright with
--   "permission denied for table profiles" the moment a profile row
--   already exists (i.e. every real signup, since handle_new_user's
--   trigger creates the row first). Confirmed by reproducing that exact
--   statement in a rolled-back transaction before adding id here. Safe
--   to grant: the with_check below still requires the new row's id equal
--   auth.uid(), so granting UPDATE on the column doesn't reopen the
--   ability to actually change it to a different value.
--   Deliberately excluded: is_admin (the vulnerability this migration
--   closes), username (no editing flow anywhere —
--   profile_settings.username_changed_at exists but nothing reads or
--   writes it, matching grep finding no username-change call at all),
--   created_at (system-managed).
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
  id,
  display_name,
  avatar_url,
  tagline,
  bio,
  cover_title,
  cover_tagline,
  cover_post_id,
  onboarding_completed,
  onboarding_completed_at,
  theme_preference,
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
