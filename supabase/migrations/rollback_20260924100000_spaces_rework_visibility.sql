-- Rollback for 20260924100000_spaces_rework_visibility.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the prior constraint. Does NOT reverse the backfill (private ->
-- just_me, friends -> followers): those are renames of the same meaning,
-- not a real data change, and reversing them risks colliding with any
-- genuinely-new 'just_me'/'followers' rows written after this migration ran
-- (there would be no way to tell which just_me rows used to be 'private').
-- If you need the old spelling back, do it by hand after checking what
-- else has written 'just_me'/'followers' in the meantime.

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility = any (array['public', 'circle', 'private', 'friends']));
