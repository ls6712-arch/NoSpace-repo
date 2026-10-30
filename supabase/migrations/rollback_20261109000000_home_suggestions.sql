-- Rollback for 20261109000000_home_suggestions.sql.
-- Drops the suggestion log (everything in it is lost), the two functions and the
-- ranking weights row. Home falls back to its at-home rows.

drop function if exists public.home_suggestions(integer);
drop function if exists public.log_suggestion_event(text, text, text, integer, double precision, text[], text);
drop table if exists public.suggestion_events;
delete from public.app_config where app_config.key = 'home_ranking_v1';
