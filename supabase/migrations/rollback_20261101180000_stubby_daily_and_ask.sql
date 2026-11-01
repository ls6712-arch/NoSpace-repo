-- Rollback for 20261101180000_stubby_daily_and_ask.sql.
-- Stops the morning restock and the clean up, and removes sources, personal picks and the ask
-- log. City picks the restock already added stay as they are. pg_net is left installed (other
-- things may come to use it); drop it by hand if nothing does.

select cron.unschedule('stubby-restock') where exists (select 1 from cron.job j where j.jobname = 'stubby-restock');
select cron.unschedule('purge-stubby-rows') where exists (select 1 from cron.job j where j.jobname = 'purge-stubby-rows');

drop function if exists private.purge_stubby_rows();
drop function if exists public.claim_stubby_ask(uuid, integer, integer);
drop function if exists public.claim_scout_source();

drop table if exists public.stubby_asks;
drop table if exists public.personal_picks;

drop index if exists public.scout_runs_source_once_a_day_idx;
alter table public.scout_runs
  drop constraint if exists scout_runs_scheduled_has_day,
  drop column if exists run_day,
  drop column if exists source_id,
  drop column if exists kind;

drop table if exists public.scout_sources;
