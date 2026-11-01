-- Open sign-up: an account with no birthdate can't do anything or finish onboarding.
--
-- Before this, only a birthdate that was written was checked (private.check_birthdate,
-- 20261104000000). An account that never wrote one, for example one made straight
-- through the Supabase auth API without the app, was never stopped. The account row
-- itself can't be refused: it is created by Supabase auth before the app asks for a
-- birthday. What the database can do, and now does:
--
--   1. private.is_active() is false until the account has a birthdate on file or has
--      already finished onboarding. Every write guarded by it (Moments, Pursuits,
--      follows, messages, reactions, saves, photo uploads, and the other tables in
--      20260929202136_step2_invite_only.sql) is refused until then. A birthdate under
--      18 can't be written at all, so an under-18 account stays inactive.
--   2. profiles.onboarding_completed can't go from false to true without a birthdate
--      on file.
--
-- Accounts that already finished onboarding (every account that exists today, and
-- any with onboarding_completed null) are left as they are: no birthdate was ever
-- asked of them, and this does not lock them out.
--
-- The onboarding order is name, birthday, where, picks, so nothing before the birthday
-- writes to a table guarded by is_active().
--
-- Run AFTER 20261107000000_profiles_is_test.sql (and 20261104000000_open_signup_and_account.sql).
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261108000000_require_birthdate.sql.

create or replace function private.is_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.access = 'active'
       and (
         p.onboarding_completed is distinct from false
         or exists (
           select 1 from public.profile_private pp
           where pp.user_id = p.id and pp.birthdate is not null
         )
       )
    from public.profiles p
    where p.id = uid
  ), false)
$$;

create or replace function private.require_birthdate_to_finish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.onboarding_completed is true
     and old.onboarding_completed is false
     and not exists (
       select 1 from public.profile_private pp
       where pp.user_id = new.id and pp.birthdate is not null
     ) then
    raise exception 'birthdate_required' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.require_birthdate_to_finish() from public;

create trigger profiles_require_birthdate
  before update of onboarding_completed on public.profiles
  for each row execute function private.require_birthdate_to_finish();
