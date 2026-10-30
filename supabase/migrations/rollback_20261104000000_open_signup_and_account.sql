-- Rollback for 20261104000000_open_signup_and_account.sql.
-- Anything saved in the dropped columns is lost (member numbers, birthdates,
-- neighborhoods, saved onboarding steps). New sign-ups go back to 'pending'.
-- Accounts that were activated stay active.

alter table public.profiles alter column access set default 'pending';

-- Removes the has_password marker from every account (including ones set since by the app).
update auth.users u set raw_user_meta_data = u.raw_user_meta_data - 'has_password' where u.raw_user_meta_data ? 'has_password';

drop trigger if exists profiles_guard_deletion_cancel on public.profiles;
drop function if exists private.guard_deletion_cancel();
drop function if exists public.remove_underage_account();

-- The original claim_invite, as it was live on Oct 30, 2026.
create or replace function public.claim_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invites%rowtype;
  grant_n integer;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  if private.is_active(uid) then
    return 'already_active';
  end if;

  select * into inv from public.invites i
  where replace(i.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;

  if not found or inv.status <> 'open' or inv.expires_at <= now() or inv.inviter_id = uid then
    return 'invalid';
  end if;

  select coalesce((c.value #>> '{}')::integer, 0) into grant_n
  from public.app_config c where c.key = 'invites_per_new_member';

  update public.invites
  set status = 'claimed', claimed_by = uid, claimed_at = now()
  where code = inv.code;

  update public.profiles
  set access = 'active', invited_by = inv.inviter_id, invite_allowance = coalesce(grant_n, 0)
  where id = uid;

  insert into public.profile_follows (follower_id, followed_id, status, responded_at)
  values (uid, inv.inviter_id, 'accepted', now()),
         (inv.inviter_id, uid, 'accepted', now())
  on conflict (follower_id, followed_id)
  do update set status = 'accepted', responded_at = now();

  return 'claimed';
end
$$;

drop function if exists public.set_username_during_onboarding(text);
drop function if exists public.username_suggestion(text);
drop function if exists private.username_is_free(text, uuid);
drop index if exists public.profiles_username_lower_key;

-- The original handle_new_user, as it was live on Oct 30, 2026.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'creator'),
    coalesce(split_part(new.email, '@', 1), 'creator')
  );
  return new;
end;
$$;

drop trigger if exists profile_private_check_birthdate on public.profile_private;
drop function if exists private.check_birthdate();
alter table public.profile_private
  drop column if exists birthdate,
  drop column if exists area,
  drop column if exists onboarding_step;

drop function if exists public.my_member_no();
drop trigger if exists profiles_lock_member_no on public.profiles;
drop trigger if exists profiles_assign_member_no on public.profiles;
drop function if exists private.lock_member_no();
drop function if exists private.assign_member_no();
alter table public.profiles drop column if exists member_no;
drop sequence if exists public.profiles_member_no_seq;
