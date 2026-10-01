-- Rollback for 20261013000000_step4c_invites_and_day2_ask.sql.
--
-- Drops my_invite_ask() and puts invites_per_new_member back to 0.
-- Deliberately does NOT lower anyone's invite_allowance: invites people have
-- already been given (and may have sent) stay theirs. To take unused ones
-- back too, run by hand:
--   update public.profiles set invite_allowance = 0
--   where coalesce(public.profiles.is_admin, false) = false;

drop function if exists public.my_invite_ask();

update public.app_config
set value = '0'::jsonb
where public.app_config.key = 'invites_per_new_member';
