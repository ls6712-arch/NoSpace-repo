-- Rollback for 20261028000000_stubs.sql.
-- Drops the three functions, then the table (which takes its policy, indexes
-- and every issued Stub with it). Nothing else was touched by the migration.

drop function if exists public.corner_stub_leaders(bigint, integer);
drop function if exists public.stubs_for_profile(uuid);
drop function if exists public.confirm_event_attendance(bigint, uuid[]);
drop table if exists public.stubs;
