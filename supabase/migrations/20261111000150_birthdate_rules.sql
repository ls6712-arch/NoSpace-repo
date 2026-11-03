-- Birthday rules (founder, Nov 3, 2026), for the "Add your birthday to see 21+ picks" sheet.
--
--   1. A birthday, once set, is locked. Nobody changes their own; support does (as the database
--      owner, from the dashboard). Enforced by a trigger on profile_private for every client write,
--      whatever path it takes.
--   2. A member who gives an under-18 date is NOT deleted. They lose member access and drop to a
--      Stubby account with no 21+ picks: profiles.access becomes 'under_18', which private.is_active()
--      already treats as not a member (it needs 'active'), so the RPC gate and every members-only
--      policy apply at once. The under-18 date itself is not stored (profile_private's own check
--      refuses it, and it isn't needed). The answer is locked too: they can't try another date.
--      Onboarding's own under-18 stop for brand-new sign-ups (remove_underage_account) is unchanged.
--   3. set_my_birthdate(date): the one way the app sets a birthday after onboarding. Answers 'ok',
--      'under_18', 'locked' or 'invalid'. A Stubby account may call it (it's how they become members).
--
-- Checked against live on Nov 3, 2026 (read-only): profiles_access_check allows 'active' and
-- 'pending'; profile_private has trigger profile_private_check_birthdate (private.check_birthdate:
-- not in the future, not before 1900, at least 18 years ago); 1 of 11 users has a birthdate.
--
-- Run AFTER 20261111000100_stubby_guests.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Verification: supabase/verification/birthdate_rules_check.sql.
-- Rollback: rollback_20261111000150_birthdate_rules.sql.

-- 1. The under-18 state ------------------------------------------------------

alter table public.profiles drop constraint profiles_access_check;
alter table public.profiles add constraint profiles_access_check check (access in ('active', 'pending', 'under_18'));

-- 2. Locked once set ----------------------------------------------------------

-- Fires after profile_private_check_birthdate (triggers run in name order). Client roles only: the
-- owner (support, and set_my_birthdate, which runs as the owner) is not stopped.
create or replace function private.lock_birthdate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.birthdate is not null and new.birthdate is distinct from old.birthdate then
    raise exception 'birthdate_locked' using errcode = '42501';
  end if;
  if new.birthdate is not null and exists (
    select 1 from public.profiles p where p.id = new.user_id and p.access = 'under_18'
  ) then
    raise exception 'birthdate_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.lock_birthdate() from public, anon, authenticated;

create trigger profile_private_lock_birthdate
  before insert or update of birthdate on public.profile_private
  for each row execute function private.lock_birthdate();

-- 3. Setting it ---------------------------------------------------------------

create or replace function public.set_my_birthdate(p_birthdate date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or private.is_anonymous()
     or not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.access = 'under_18')
     or exists (select 1 from public.profile_private pp where pp.user_id = v_uid and pp.birthdate is not null) then
    return 'locked';
  end if;
  if p_birthdate is null or p_birthdate > current_date or p_birthdate < date '1900-01-01' then
    return 'invalid';
  end if;
  if p_birthdate > (current_date - interval '18 years')::date then
    -- Not deleted: no longer a member (is_active needs 'active'), Stubby only, no 21+.
    update public.profiles set access = 'under_18' where profiles.id = v_uid;
    return 'under_18';
  end if;
  insert into public.profile_private (user_id, birthdate) values (v_uid, p_birthdate)
    on conflict (user_id) do update set birthdate = excluded.birthdate;
  return 'ok';
end;
$$;

revoke all on function public.set_my_birthdate(date) from public, anon;
grant execute on function public.set_my_birthdate(date) to authenticated;

-- A Stubby account adds its birthday through it (members pass the gate anyway).
insert into private.access_allowlist (kind, name, reason) values
  ('rpc_account', 'set_my_birthdate', 'add a birthday once: 21+ picks, or membership');
