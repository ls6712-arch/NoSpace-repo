-- Rollback for 20260924099000_spaces_rework_corners.sql.
--
-- Draft only — staged for review, not run.
--
-- Merges/renames/hides already applied through the admin functions this
-- file adds are NOT undone by this rollback — those are real data changes
-- (a merged Corner's Moments now belong to the kept one) with no archive
-- table backing them, same as any other admin action taken after a
-- migration runs. This only removes the machinery itself.

drop function if exists public.admin_merge_corners(bigint, bigint);
drop function if exists public.admin_hide_corner(bigint, boolean);
drop function if exists public.admin_rename_corner(bigint, text);
drop function if exists public.corner_activity_30d();

alter table public.corners drop constraint if exists corners_name_not_blocklisted;
alter table public.corners drop column if exists hidden;
