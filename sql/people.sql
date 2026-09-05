-- NoSpace: make people findable.
--
-- Nothing in the app could list a person, and the profiles table may also be
-- locked to its owner — between them, someone who signed up simply did not
-- exist as far as anyone else was concerned.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run sql/social.sql first if you haven't.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Profiles are public, because finding people is the point
--
--    A profile holds a display name, a handle and a picture — all of it
--    chosen to be seen. Nothing private lives on this table: email and
--    password stay in auth.users, which is not reachable from the browser.
--
--    Reading is open to everyone, signed in or not, so a shared profile
--    link works for someone who hasn't made an account yet. Writing stays
--    restricted to the owner.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "profiles are viewable by owner" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "profiles are readable"
  on public.profiles for select using (true);

drop policy if exists "you edit your own profile" on public.profiles;
create policy "you edit your own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "you create your own profile" on public.profiles;
create policy "you create your own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Searching by name
--
--    Name search is a case-insensitive contains, which cannot use an
--    ordinary b-tree index. A trigram index makes it fast; if the extension
--    isn't available on your plan the search still works, just linearly —
--    which is fine until there are thousands of people.
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

create index if not exists profiles_display_name_trgm
  on public.profiles using gin (display_name gin_trgm_ops);

create index if not exists profiles_username_trgm
  on public.profiles using gin (username gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Backfill: anyone whose profile row never got created
--
--    If signup ever failed between creating the account and creating the
--    profile, that person has no row at all and cannot be found by anything.
--    This gives them one, using the display name they signed up with.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.profiles (id, username, display_name)
select
  u.id,
  -- A handle from their email local part, made unique with a short suffix.
  regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
    || '-' || substr(u.id::text, 1, 4),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Anyone with a row but no display name would show as blank everywhere.
update public.profiles p
set display_name = coalesce(
  nullif(p.display_name, ''),
  split_part(u.email, '@', 1)
)
from auth.users u
where u.id = p.id and coalesce(p.display_name, '') = '';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Check what you've got
--
--    Run these two on their own afterwards to see the state of things.
-- ─────────────────────────────────────────────────────────────────────────
-- select count(*) as accounts from auth.users;
-- select id, username, display_name, avatar_url from public.profiles order by display_name;
