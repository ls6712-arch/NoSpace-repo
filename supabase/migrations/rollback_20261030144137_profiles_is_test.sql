-- Rollback for 20261107000000_profiles_is_test.sql.
-- Test accounts show in the public feed again. Nothing else is touched.

drop trigger if exists profiles_lock_is_test on public.profiles;
drop function if exists private.lock_is_test();
drop index if exists public.profiles_is_test_idx;
alter table public.profiles drop column if exists is_test;
