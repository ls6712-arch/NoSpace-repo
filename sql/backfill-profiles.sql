-- Sushii: make sure every account has a profile.
--
--   Supabase → SQL Editor → New query → paste ONE PART at a time → Run
--
-- Why: two accounts (ls6712@nyu.edu, bharathdoitnow@gmail.com) exist in
-- auth.users with no row in public.profiles. The app creates a profile only
-- when signup returns a session, which it doesn't while "Confirm email" is
-- on, and its own comments say a database trigger is meant to cover the rest.
-- That trigger isn't in this repo, so nobody can see whether it exists or why
-- it sometimes doesn't work.
--
-- Nothing here touches an account that already has a profile.

-- ─────────────────────────────────────────────────────────────────────────
-- PART 1: DIAGNOSTIC (read-only; run this first and read the result)
--
--   "trigger on auth.users"   a row here means the database already tries to
--                             create profiles. If it's listed, DON'T run
--                             part 3; tell me its name and I'll look at it.
--   "username default"        what fills the required `username` column.
--   "account with NO profile" who is affected, whether they confirmed their
--                             email, and whether they've ever signed in. An
--                             account that never confirmed or signed in is
--                             not actually broken; it just hasn't started.
-- ─────────────────────────────────────────────────────────────────────────
select 'trigger on auth.users' as what, tgname::text as detail
from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal
union all
select 'trigger on profiles', tgname::text
from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal
union all
select 'username default', coalesce(column_default, '(none)')
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
union all
select 'account with NO profile',
       u.email || ' | confirmed: ' || coalesce(u.email_confirmed_at::text, 'NO')
                || ' | last sign-in: ' || coalesce(u.last_sign_in_at::text, 'never')
from auth.users u left join public.profiles p on p.id = u.id
where p.id is null;

-- ─────────────────────────────────────────────────────────────────────────
-- PART 2: BACKFILL (always safe; run it any time an account is missing a
-- profile; running it twice changes nothing)
--
--   Uses the same recipe as sql/people.sql section 3: a handle from the
--   email plus a short id suffix so it's unique, and the display name they
--   typed at signup if there is one.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.profiles (id, username, display_name)
select
  u.id,
  coalesce(nullif(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'user')
    || '-' || substr(u.id::text, 1, 4),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- PART 3: TRIGGER (run ONLY if part 1 showed no trigger on auth.users)
--
--   Creates the profile in the database at the moment the account is
--   created, so it no longer depends on the browser finishing the job.
--   The app's own upsert afterwards still overwrites the name with whatever
--   the person typed; that keeps working and still leaves one row.
--
--   A profile problem must never stop someone from signing up, so the
--   function catches its own errors and logs a warning instead of failing.
--   The trade-off: a failure is quiet. Re-run part 1 now and then, and part
--   2 to repair anyone it lists.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'user')
      || '-' || substr(new.id::text, 1, 4),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'create_profile_for_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
