-- Soosh: "Start opens the activity, not the camera" (brief of Nov 1, 2026), PR 1.
--
-- Run AFTER 20261115000000_stubs_four_kinds.sql.
-- Rollback: rollback_20261116000000_suggestion_events_start_logged.sql.
-- Verification: supabase/verification/suggestion_events_start_logged_check.sql.
--
-- A tap on Start no longer counts as "going". The Start page records three
-- different things, so the suggestion log needs two more actions:
--   start    the person tapped Start and the Start page opened
--   going    (unchanged) they made a plan there
--   logged   they posted a Moment from the Start page
-- Nothing else changes: log_suggestion_event() takes p_action as text and inserts it, so
-- the CHECK below is the only place the allowed actions live. The three Discover
-- actions from 20261111000000 stay allowed.

alter table public.suggestion_events drop constraint suggestion_events_action_check;
alter table public.suggestion_events
  add constraint suggestion_events_action_check
  check (action in ('shown', 'opened', 'going', 'invite', 'dismissed', 'followed', 'joined', 'tried', 'start', 'logged'));
