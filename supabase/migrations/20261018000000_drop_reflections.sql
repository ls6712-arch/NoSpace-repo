-- R2 (round 2): private reflections are dropped from the product.
--
-- Checked read-only on the live project before writing this: post_reflections
-- has 0 rows and posts.reflection has 0 non-empty values, so nothing is lost.
-- No function, view, policy or trigger references either one.
--
-- Run this only AFTER the client that no longer reads or writes them is
-- deployed (PR #163), or the old client's post_reflections query would error.
-- NOT YET RUN on the live project.
drop table if exists public.post_reflections;
alter table public.posts drop column if exists reflection;
