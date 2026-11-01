-- Rollback for 20261031000000_profiles_column_privacy.sql. Puts back the
-- table-wide grants and the invoker version of private.is_admin exactly as
-- they were live on Oct 28, 2026, and drops my_profile_private(). The client
-- falls back to reading the columns from profiles when the function is missing.

grant select, truncate, trigger, references on public.profiles to anon, authenticated;

create or replace function private.is_admin(u uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = u), false);
$$;
alter function private.is_admin(uuid) security invoker;

drop function if exists public.my_profile_private();
