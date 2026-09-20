-- Reverses supabase/migrations/20260920010000_profiles_is_admin_lock.sql:
-- restores the original table-level UPDATE grant to authenticated and
-- anon, restores the original profiles UPDATE and INSERT policies exactly
-- (no with_check on UPDATE, no is_admin check on INSERT).
--
-- Restoring the original grant/policy pair re-opens the is_admin
-- privilege-escalation path this migration closed. Only intended for a
-- full, deliberate rollback of this specific migration.

revoke update (
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
) on public.profiles from authenticated;

grant update on public.profiles to authenticated, anon;

drop policy if exists "You can update your own profile" on public.profiles;
create policy "You can update your own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "you can create your own profile" on public.profiles;
create policy "you can create your own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);
