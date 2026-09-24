-- Reverses supabase/migrations/20260919230200_posts_visibility_private.sql.
--
-- The constraint revert is unconditionally safe. The data revert is NOT:
-- once 'private' has been live for a while, new posts may have been
-- legitimately created with visibility = 'private' through normal use
-- (that's the whole point of the migration), and this script has no way to
-- tell those apart from rows that got there via the original friends ->
-- private conversion. Converting every 'private' row back to 'friends'
-- would silently change the audience of posts nobody asked to change.
--
-- Only run the data revert (commented out below) if this is being rolled
-- back immediately after applying, before any real 'private' post could
-- exist yet — confirm with a count first.

-- NOT VALID: if any row already has visibility = 'private' by the time this
-- runs, a validated constraint here would fail the whole statement. NOT
-- VALID still blocks any new write that isn't public/friends/circle from
-- this point on; it just doesn't retroactively check rows that already
-- exist. Run VALIDATE CONSTRAINT once you've confirmed (below) that no
-- 'private' row needs to keep that value.
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility = any (array['public', 'friends', 'circle'])) not valid;

-- select count(*) from public.posts where visibility = 'private';
-- -- only if that count is exactly the number converted by the forward
-- -- migration (0, at the time it was drafted) and nothing else has used
-- -- 'private' since:
-- -- update public.posts set visibility = 'friends' where visibility = 'private';
-- -- alter table public.posts validate constraint posts_visibility_check;
