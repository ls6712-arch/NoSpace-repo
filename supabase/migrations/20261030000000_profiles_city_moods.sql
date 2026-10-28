-- Soosh core loop v1, PR 2: what a person wants more of, and where they are.
--
--   profiles.city   free text, up to 80 characters. Discover reads it for
--                   "This week in {city}". Null until someone sets it.
--   profiles.moods  the ids of the moods (src/app/data/moods.ts) a person
--                   picked on onboarding: make, move, people, alone, outside,
--                   learn, play, haveIt. Never null; empty until they pick.
--
-- Run AFTER 20261029000000_corner_affinity.sql.
--
-- Profiles have no table-level UPDATE grant for authenticated, only a list of
-- columns, so a new column is read-only to the app until it is granted here.
-- The existing "You can update your own profile" policy already limits the
-- write to the caller's own row. Like every other profile column, both are
-- readable wherever the profile itself is visible (is_visible_profile).
--
-- Rollback: rollback_20261030000000_profiles_city_moods.sql.

alter table public.profiles
  add column city text,
  add column moods text[] not null default '{}';

alter table public.profiles
  add constraint profiles_city_length check (city is null or char_length(city) between 1 and 80),
  add constraint profiles_moods_known check (
    cardinality(moods) <= 8
    and moods <@ array['make', 'move', 'people', 'alone', 'outside', 'learn', 'play', 'haveIt']::text[]
  );

grant update (city, moods) on public.profiles to authenticated;
