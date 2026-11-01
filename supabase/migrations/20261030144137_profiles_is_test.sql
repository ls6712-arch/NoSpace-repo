-- Open sign-up, clean-up of the public feed: a flag for test accounts.
--
--   profiles.is_test   true for an account that exists only for testing. The app
--                      leaves these out of the public feed, Discover, People and
--                      the Shelves row. Nothing is deleted, the account still
--                      works for whoever signs in to it, and its owner still sees
--                      their own Moments. Default false.
--
-- Only the database owner or the service role can change the flag: a signed-in
-- person's own request can neither set it nor clear it (the trigger below), so
-- nobody can hide themselves or unhide a test account from the app.
--
-- Three accounts are flagged, named by the founder on Oct 30, 2026 and matched by
-- their sign-in email, not by name: ls6712@stern.nyu.edu, sushmithachowdary67@gmail.com
-- and ls6712@nyu.edu. sushmithalekkala@gmail.com is never flagged (the update below
-- also excludes it by address). Undo for one account:
-- update public.profiles set is_test = false where id = ...
--
-- Run AFTER 20261105000000_onboarding_taste.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261107000000_profiles_is_test.sql.

alter table public.profiles add column is_test boolean not null default false;

-- The profile columns are granted by name (20261031000000_profiles_column_privacy.sql),
-- so a new column is private until it is granted. The app reads this one to leave
-- test accounts out of lists. It says nothing about a person beyond "test account".
grant select (is_test) on public.profiles to anon, authenticated;

create index profiles_is_test_idx on public.profiles (id) where is_test;

create or replace function private.lock_is_test()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_test := false;
  elsif new.is_test is distinct from old.is_test then
    raise exception 'That can''t be changed.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.lock_is_test() from public;

create trigger profiles_lock_is_test
  before insert or update of is_test on public.profiles
  for each row execute function private.lock_is_test();

update public.profiles
set is_test = true
where profiles.id in (
  select u.id from auth.users u
  where lower(u.email) in ('ls6712@stern.nyu.edu', 'sushmithachowdary67@gmail.com', 'ls6712@nyu.edu')
    and lower(u.email) <> 'sushmithalekkala@gmail.com'
);
