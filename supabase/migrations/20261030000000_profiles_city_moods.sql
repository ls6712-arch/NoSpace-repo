-- Soosh core loop v1, PR 2: what a person wants more of, and where they are.
--
--   profiles.moods          the ids of the moods (src/app/data/moods.ts) a person
--                           picked on onboarding: make, move, people, alone,
--                           outside, learn, play, haveIt. Never null; empty until
--                           they pick. Public like the rest of a profile.
--   profile_private.city    free text, 1 to 80 characters. Discover reads it for
--                           "This week in {city}". PRIVATE: only its owner can
--                           read or write it (row-level security below).
--
-- Run AFTER 20261029000000_corner_affinity.sql.
--
-- Why a table and not a column: public.profiles is readable by anyone who can see
-- the profile (its SELECT grant covers every column, and there is no per-column
-- read control), so a city stored there would be public. A separate table with
-- its own policies is private by construction, and a later private field has a
-- home too.
--
-- profiles has no table-level UPDATE grant for authenticated, only a list of
-- columns, so moods is read-only to the app until it is granted here. The existing
-- "You can update your own profile" policy limits the write to the caller's row.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261030000000_profiles_city_moods.sql.

alter table public.profiles
  add column moods text[] not null default '{}';

alter table public.profiles
  add constraint profiles_moods_known check (
    cardinality(moods) <= 8
    and moods <@ array['make', 'move', 'people', 'alone', 'outside', 'learn', 'play', 'haveIt']::text[]
  );

grant update (moods) on public.profiles to authenticated;

create table public.profile_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  city text check (city is null or char_length(city) between 1 and 80),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

revoke all on public.profile_private from public, anon, authenticated;
grant select, insert, update on public.profile_private to authenticated;

create policy "you read your own private profile" on public.profile_private
  for select to authenticated
  using ((select auth.uid()) = profile_private.user_id);

create policy "you create your own private profile" on public.profile_private
  for insert to authenticated
  with check ((select auth.uid()) = profile_private.user_id);

create policy "you edit your own private profile" on public.profile_private
  for update to authenticated
  using ((select auth.uid()) = profile_private.user_id)
  with check ((select auth.uid()) = profile_private.user_id);
