-- Rollback for 20261126000000_moment_corner_row.sql: removes the trigger and its function. Corner rows
-- it made stay (Moments point at them through posts_corner_fkey). Without the trigger, a Moment into a
-- Corner with no row fails with 23503 again.
drop trigger if exists posts_aa_ensure_corner on public.posts;
drop function if exists private.posts_ensure_corner();
