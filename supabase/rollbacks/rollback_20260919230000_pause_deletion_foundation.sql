-- Reverses supabase/migrations/20260919230000_pause_deletion_foundation.sql.
-- Safe to run any time after that migration — nothing else depends on
-- profile_settings or is_visible_profile once migration (b) is also rolled
-- back first (run rollback (b) before this one if both are applying).

drop function if exists public.is_visible_profile(uuid);
drop table if exists public.profile_settings;

alter table public.profiles
  drop column if exists paused_at,
  drop column if exists deletion_requested_at,
  drop column if exists discoverable,
  drop column if exists show_this_corner;
