-- Rollback for 20261107000000_require_birthdate.sql.
-- Accounts with no birthdate can write again and finish onboarding without one.

drop trigger if exists profiles_require_birthdate on public.profiles;
drop function if exists private.require_birthdate_to_finish();

-- The original, as created in 20260929202136_step2_invite_only.sql.
create or replace function private.is_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.access = 'active' from public.profiles p where p.id = uid), false)
$$;
