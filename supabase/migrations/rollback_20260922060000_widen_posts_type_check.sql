-- Rollback for 20260922060000_widen_posts_type_check.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the exact prior constraint body from
-- docs/schema-baseline-20260920.sql:428 (its real, live definition before
-- this migration touched it).
--
-- Not safe to run blind: if any row has type = 'written' by the time this
-- runs, re-adding the narrower CHECK will fail (existing rows are
-- validated against a constraint added via ALTER TABLE unless NOT VALID is
-- used, which this deliberately doesn't — a rollback that silently skips
-- validation could leave the column claiming a guarantee live data already
-- violates). Delete or retype those rows first if you actually mean to
-- undo this.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check
  check (type = any (array['photo'::text, 'video'::text]));
