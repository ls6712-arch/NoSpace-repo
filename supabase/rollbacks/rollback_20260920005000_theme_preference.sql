-- Reverses supabase/migrations/20260920005000_theme_preference.sql.
-- Destructive: drops the column and any theme preferences users have
-- already saved since this was applied. Dropping the column also drops
-- its own CHECK constraint automatically.
--
-- Only roll this back together with (before, in reverse-apply order)
-- 20260920010000_profiles_is_admin_lock.sql's own rollback, since that
-- migration's UPDATE grant names this column explicitly.

alter table public.profiles
  drop column if exists theme_preference;
