-- Rollback for 20261111000150_birthdate_rules.sql.
-- Anyone marked 'under_18' goes back to 'active' (the state they were in before); support should
-- review those accounts by hand before running this.

delete from private.access_allowlist where kind = 'rpc_account' and name = 'set_my_birthdate';
drop function if exists public.set_my_birthdate(date);
drop trigger if exists profile_private_lock_birthdate on public.profile_private;
drop function if exists private.lock_birthdate();

update public.profiles set access = 'active' where profiles.access = 'under_18';
alter table public.profiles drop constraint profiles_access_check;
alter table public.profiles add constraint profiles_access_check check (access in ('active', 'pending'));
