-- Privacy audit (round 6): the owner-only columns of profiles stop being
-- readable by anyone else.
--
-- Until now any visitor, logged in or not, could read every column of every
-- visible profile: who is an admin, who invited whom, invite allowance, theme,
-- onboarding state and two privacy settings. Only the account's owner should.
-- Column privileges can't tell owner from visitor, so the owner reads those
-- columns through public.my_profile_private(), which returns only the caller's
-- own row, and the readable columns are listed explicitly.
--
-- MERGE ONLY AFTER the code that calls my_profile_private() is live in
-- production (PR #163). The client that is live before that reads these columns
-- straight from profiles, and would fail to load a profile for every account
-- once this runs. The new code works with or without this migration.
--
-- Not covered here, on purpose: UPDATE grants (unchanged), service_role (keeps
-- everything), the columns that stay public (a public Shelf shows them), and
-- paused_at / deletion_requested_at, which stay readable because the row policy
-- already hides any profile where either is set (they are empty for everyone
-- else's profile).
--
-- NOT YET RUN on the live project.

-- 1. The owner's own view of the owner-only columns.
create or replace function public.my_profile_private()
returns table (
  access text,
  invited_by uuid,
  invite_allowance integer,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz,
  theme_preference text,
  is_admin boolean,
  discoverable boolean,
  show_this_corner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.access, p.invited_by, p.invite_allowance, p.onboarding_completed,
         p.onboarding_completed_at, p.theme_preference, p.is_admin,
         p.discoverable, p.show_this_corner
    from public.profiles p
   where p.id = auth.uid();
$$;

revoke all on function public.my_profile_private() from public;
revoke all on function public.my_profile_private() from anon;
grant execute on function public.my_profile_private() to authenticated;

-- 2. private.is_admin() reads profiles.is_admin as whoever is asking, and the
--    admin policies call it for everyone. Once the column is hidden it has to
--    read it as its owner instead, or every admin-only policy would error.
create or replace function private.is_admin(u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = u), false);
$$;

-- 3. Only the public columns stay readable. Revoking single columns would do
--    nothing while the table-wide SELECT grant exists, so take that back and
--    grant the public columns by name. A column added later is private until
--    someone grants it here.
revoke select on public.profiles from anon;
revoke select on public.profiles from authenticated;
grant select (id, username, display_name, created_at, avatar_url, tagline, bio,
              cover_title, cover_tagline, cover_post_id, paused_at, deletion_requested_at)
  on public.profiles to anon, authenticated;
