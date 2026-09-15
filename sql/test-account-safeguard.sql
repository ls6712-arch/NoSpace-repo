-- NoSpace: block obviously-test display names before they land in
-- `profiles`, so a throwaway QA account never has to be hunted down and
-- purged from the public feed after the fact again.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- Deliberately a database trigger rather than a check duplicated in each of
-- the three places the app writes display_name (AuthContext.tsx's signUp
-- and updateProfile, AccountSettings.tsx's saveName) — one enforcement
-- point that every current and future write path goes through, and zero
-- changes needed to any read query in ContentContext.tsx or
-- PublicProfile.tsx (an is_test column filtered at read time would have
-- needed both).
--
-- The list is generic placeholder-style names, not any specific person's —
-- the two names in this repo's original purge request ("Sush", "Sushmitha")
-- turned out to be real accounts (1 and 16 real posts respectively) once
-- checked, not test data, so they're deliberately not on this list. Add a
-- specific real name to a blocklist and you've just locked that person out
-- of their own name.
create or replace function public.reject_test_display_names() returns trigger
language plpgsql
as $$
begin
  if new.display_name is not null and lower(trim(new.display_name)) = any (array[
    'test', 'testing', 'test account', 'test user', 'test profile',
    'qa', 'qa test', 'qa account', 'qa user',
    'alex tester', 'bailey qa',
    'dummy', 'dummy account', 'sample account', 'do not use', 'placeholder'
  ]) then
    raise exception 'That display name is reserved for testing and can''t be used.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_test_display_names on public.profiles;
create trigger reject_test_display_names
  before insert or update of display_name on public.profiles
  for each row execute function public.reject_test_display_names();
