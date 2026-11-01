-- Profile column privacy: the owner-only columns of profiles stop being
-- readable by anyone else.
--
-- Until now any visitor, logged in or not, could read every column of every
-- visible profile: who is an admin, who invited whom, invite allowance, theme,
-- onboarding state and a privacy setting. Confirmed on the live project on
-- Oct 28, 2026 with a read-only query (anon and authenticated hold SELECT on
-- is_admin and invited_by, and my_profile_private() does not exist).
--
-- This is draft PR #165 (round 6 privacy audit), brought up to date:
--   * #163, the client that reads these columns through my_profile_private(),
--     has been live since Oct 8, 2026, so this is now safe to run.
--   * `discoverable` stays readable: the landing page's public Shelves list
--     filters on it (src/app/lib/publicShelves.ts), and a filter needs SELECT.
--     Its value says only whether someone chose to be listed, which being
--     listed already shows. It is still returned to the owner by the function.
--   * `moods` (added by 20261030000000_profiles_city_moods.sql, PR #212) is a
--     public column: a Shelf shows what someone is into. It is granted only if
--     that migration has already run, so the two can merge in either order.
--   * TRUNCATE, TRIGGER and REFERENCES are taken back from anon and
--     authenticated. Nothing in the app uses them, and TRUNCATE ignores row
--     level security.
--
-- Not covered here, on purpose: UPDATE grants (unchanged), INSERT and DELETE
-- grants (row policies already limit them), service_role (keeps everything),
-- and paused_at / deletion_requested_at, which stay readable because the row
-- policy already hides any profile where either is set.
--
-- NOT YET RUN on the live project.

-- 1. The owner's own view of the owner-only columns. The client (ownProfile.ts)
--    already calls this and falls back to the old direct read while it is missing.
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

-- 3. Only the public columns stay readable. Revoking single columns does
--    nothing while the table-wide SELECT grant exists, so take that back and
--    grant the public columns by name. A column added later is private until
--    someone grants it.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, created_at, avatar_url, tagline, bio,
              cover_title, cover_tagline, cover_post_id, paused_at, deletion_requested_at,
              discoverable)
  on public.profiles to anon, authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'moods'
  ) then
    execute 'grant select (moods) on public.profiles to anon, authenticated';
  end if;
end $$;

-- 4. Table privileges nothing in the app uses.
revoke truncate, trigger, references on public.profiles from anon, authenticated;
