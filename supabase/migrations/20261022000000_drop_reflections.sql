-- R2 (round 2): private reflections are dropped from the product.
--
-- Checked read-only on the live project before writing this: post_reflections
-- has 0 rows and posts.reflection has 0 non-empty values, so nothing is lost.
-- No function, view, policy or trigger references either one.
--
-- Merge this only AFTER PR #163 is live in production. The client that is live
-- before #163 always sends `reflection` when a Moment is edited, so if this ran
-- first, editing a Moment would save but report a failure, and a reflection
-- typed into a new Moment would be silently lost.
--
-- Its own version (20261022...) is newer than every migration in #163 (the newest is 20261021) on purpose: a version
-- older than one already applied is an out-of-order migration that the
-- Supabase tooling refuses or skips.
-- NOT YET RUN on the live project.
drop table if exists public.post_reflections;
alter table public.posts drop column if exists reflection;
