-- Rollback for 20261109000000_home_suggestions.sql.
-- Drops the suggestion log (everything in it is lost), the functions, the nightly
-- purge job and the ranking weights row. Home falls back to its at-home rows.

do $$
begin
  if to_regclass('cron.job') is not null
     and exists (select 1 from cron.job j where j.jobname = 'purge-suggestion-events') then
    perform cron.unschedule('purge-suggestion-events');
  end if;
end
$$;

drop function if exists public.purge_suggestion_events();
drop function if exists public.home_suggestions(integer);
drop function if exists public.log_suggestion_event(text, text, text, integer, double precision, text[], text);
drop table if exists public.suggestion_events;
delete from public.app_config where app_config.key = 'home_ranking_v1';
