-- Rollback for 20261120000000_security_hardening.sql. Run only if that migration has to be undone.
--
-- Puts back the write grants anon had before (row level security still refused every one of them),
-- removes the five rate limits, and removes the admin action log (its rows are lost).

drop function if exists public.admin_audit_log_recent(integer);

drop trigger if exists audit_admin_app_config on public.app_config;
drop trigger if exists audit_admin_categories on public.categories;
drop trigger if exists audit_admin_corner_categories on public.corner_categories;
drop trigger if exists audit_admin_city_picks on public.city_picks;
drop trigger if exists audit_admin_moderation_queue on public.moderation_queue;
drop trigger if exists audit_admin_scout_sources on public.scout_sources;
drop trigger if exists audit_admin_spaces on public.spaces;
drop trigger if exists audit_admin_corners on public.corners;
drop trigger if exists audit_admin_standing_slots on public.standing_slots;
drop trigger if exists audit_admin_space_events on public.space_events;
drop trigger if exists audit_admin_posts on public.posts;
drop trigger if exists audit_admin_reports on public.reports;
drop function if exists private.log_admin_write();
drop table if exists private.admin_audit_log;

drop trigger if exists rl_profile_follows_insert on public.profile_follows;
drop trigger if exists rl_reactions_insert on public.reactions;
drop trigger if exists rl_pursuit_discussion_insert on public.pursuit_discussion;
drop trigger if exists rl_space_join_requests_insert on public.space_join_requests;
drop trigger if exists rl_stubby_feedback_insert on public.stubby_feedback;
drop function if exists private.rate_limit_insert();

alter default privileges for role postgres in schema public grant insert, update, delete, truncate on tables to anon;
alter default privileges for role postgres in schema public grant truncate on tables to authenticated;
-- The table grants themselves are not put back one by one: they never allowed anything (row level
-- security refused every anon write), and standing_slots and later tables never had them.
