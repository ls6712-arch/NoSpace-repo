-- Rollback for 20261105000000_onboarding_taste.sql.
-- Drops the passes table (with every pass saved) and the three taste columns
-- (everything saved in them is lost).

drop function if exists public.pursuit_invite_corner(text);
drop function if exists public.corners_with_activity(text, integer);

drop table if exists public.user_passes;
drop function if exists private.limit_user_passes();

alter table public.profile_private
  drop constraint if exists profile_private_picks_valid,
  drop constraint if exists profile_private_free_windows_valid,
  drop constraint if exists profile_private_monthly_budget_valid;

alter table public.profile_private
  drop column if exists picks,
  drop column if exists free_windows,
  drop column if exists monthly_budget;
