-- Soosh: Corner activities, PR A (brief of Nov 7, 2026). A Moment logged from an activity ("Try this" on its card)
-- remembers which one.
--
-- Run after 20261121000000_thought_photos_private.sql (its first version, 20261120000000, was already taken by security_hardening,
-- which is applied; this one has never run, so it moved to the next free version). Staging first.
-- Rollback: rollback_20261122000000_post_activity_id.sql.
-- Verification: supabase/verification/post_activity_id_check.sql.
--
-- posts.activity_id is a nullable id: "origami-1" from data/corner_activities.csv now, and later the id of an
-- approved user-added activity. It is plain text, not a foreign key, because the founder's activities live in the app's
-- data file, not in a table. It is not private (it says what the Moment was made from, like its Corner does), so it is a
-- column on posts and follows the row's own policies: no policy, grant or trigger changes. The Stub is the normal one.
-- No function reads it yet.

alter table public.posts
  add column activity_id text check (activity_id is null or char_length(activity_id) between 1 and 80);
