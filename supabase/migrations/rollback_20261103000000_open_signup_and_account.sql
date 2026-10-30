-- Rollback for 20261103000000_open_signup_and_account.sql.
-- Anything saved in the dropped columns is lost (member numbers, birthdates,
-- neighborhoods, saved onboarding steps). New sign-ups go back to 'pending'.
-- Accounts that were activated stay active.

alter table public.profiles alter column access set default 'pending';

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
