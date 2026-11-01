-- Rollback for 20261116000000_suggestion_events_start_logged.sql.
-- Removes the rows the two new actions wrote (they cannot satisfy the old check), then
-- puts the previous action list back.

delete from public.suggestion_events where suggestion_events.action in ('start', 'logged');

alter table public.suggestion_events drop constraint suggestion_events_action_check;
alter table public.suggestion_events
  add constraint suggestion_events_action_check
  check (action in ('shown', 'opened', 'going', 'invite', 'dismissed', 'followed', 'joined', 'tried'));
