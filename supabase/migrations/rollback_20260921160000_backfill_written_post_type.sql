-- Rollback for 20260921160000_backfill_written_post_type.sql.
--
-- Draft only — staged for review, not run.
--
-- Not fully lossless, and can't be: the up migration's whole point was
-- correcting a pre-existing mislabeling (every no-media post was typed
-- 'photo' by a composer bug, whether or not it was ever actually a photo).
-- Once corrected to 'written', the original 'photo'/'video' guess is gone —
-- there's no snapshot of it to restore. This puts every row the up
-- migration flipped to 'written' back to 'photo', matching what the
-- pre-migration composer bug always produced for a no-media post; a row
-- that happened to be 'video' with a failed upload (the one case the bug
-- could produce something other than 'photo') will come back as 'photo'
-- instead of its original 'video' — flagged rather than silently guessed.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
update public.posts
set type = 'photo'
where type = 'written';
