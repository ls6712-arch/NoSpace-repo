-- Rollback for 20260924098000_spaces_rework_app_config.sql.
--
-- Draft only — staged for review, not run.
--
-- Do NOT run this after 20260924099000_spaces_rework_corners.sql or the
-- amended 20260924110000_spaces_rework_schema.sql have run — both have
-- triggers that call public.is_blocklisted_name(), which this drops.

drop function if exists public.is_blocklisted_name(text);

drop policy if exists "admins manage app_config" on public.app_config;
drop policy if exists "app_config is readable when signed in" on public.app_config;
drop table if exists public.app_config;
