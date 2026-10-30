-- Rollback for 20261111000000_discover_v2.sql.
-- Drops the three Discover functions and the Discover logger, deletes any Discover rows
-- from the suggestion log, and puts the log's checks back as Home v2 made them.

drop function if exists public.discover_moments(text, timestamptz, integer);
drop function if exists public.discover_corners(integer, text[]);
drop function if exists public.discover_spaces(integer);
drop function if exists public.log_discover_event(text, text, text, integer, text);

delete from public.suggestion_events where suggestion_events.surface = 'discover';

alter table public.suggestion_events drop constraint suggestion_events_surface_check;
alter table public.suggestion_events add constraint suggestion_events_surface_check check (surface in ('home'));

alter table public.suggestion_events drop constraint suggestion_events_kind_check;
alter table public.suggestion_events add constraint suggestion_events_kind_check
  check (kind in ('event', 'open_pursuit', 'friend_pursuit', 'at_home'));

alter table public.suggestion_events drop constraint suggestion_events_action_check;
alter table public.suggestion_events add constraint suggestion_events_action_check
  check (action in ('shown', 'opened', 'going', 'invite', 'dismissed'));

-- Drops every Moment's city (it is not kept anywhere else).
alter table public.posts drop column if exists city;
