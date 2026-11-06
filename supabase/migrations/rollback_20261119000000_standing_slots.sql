-- Rollback for 20261119000000_standing_slots.sql.
-- Drops the table (and with it every slot, its policies, indexes and trigger), the two helper
-- functions and the config row. Nothing else reads these yet.

drop table if exists public.standing_slots;
drop function if exists private.standing_slots_guard();
drop function if exists private.standing_stale_days();
delete from public.app_config where public.app_config.key = 'standing_slots_v1';
