-- Sushii: fix who can read `posts`.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- ── READ THIS FIRST ────────────────────────────────────────────────────
-- Step 1: look at what is actually live, before changing anything:
--
--   select policyname, permissive, cmd, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT';
--
-- This file fixes the situation the repo's SQL describes. If your live
-- database already differs (someone edited policies in the dashboard), the
-- two policy names below may not match and you should look before running.
--
-- Step 2 (optional but wise): see whether anyone could have been exposed:
--
--   -- owner-only posts ('friends') that were readable by anyone
--   select count(*) from public.posts where visibility = 'friends';
--   -- threads in Members-only Circles
--   select count(*) from public.posts p
--   join public.circles c on c.id = p.circle_id - 1000000
--   where p.visibility = 'circle' and c.visibility = 'Members only';
-- ────────────────────────────────────────────────────────────────────────
--
-- What was wrong (reproduced in a scratch database)
--
--   Two permissive SELECT policies exist on posts, and Postgres ORs
--   permissive policies together:
--
--     "posts are readable by their audience"   (retire-connections.sql)
--         public, or your own.
--     "circle threads follow the circle's visibility"   (circles.sql)
--         visibility <> 'circle' OR circle_id is null OR ...
--
--   The second one starts with "visibility <> 'circle'", which is true for
--   every ordinary post, so it quietly grants everyone (including a
--   signed-out visitor holding the public anon key) read access to every
--   non-Circle post, including 'friends' posts that are meant to be
--   owner-only.
--
--   Second problem: for a real Circle the app stores the thread's
--   circle_id as (circles.id + 1,000,000), but that policy compared it to the
--   raw circles.id. It never matched, so "Members only" never actually
--   restricted anything.
--
-- The fix: one policy, no loopholes.
--   * public posts: everyone, as before;
--   * your own posts: you;
--   * Circle threads: only when you're signed in AND the Circle is a demo
--     Circle (id under 1,000,000, no row, open by design) or a real Circle
--     that is 'Open to read', or you own it or belong to it.
--   * a thread whose Circle no longer exists is visible only to its author.

drop policy if exists "circle threads follow the circle's visibility" on public.posts;
drop policy if exists "posts are readable by their audience" on public.posts;

create policy "posts are readable by their audience"
  on public.posts for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'circle'
      and circle_id is not null
      and auth.uid() is not null
      and (
        -- demo Circle: lives in code, has no row, open by design
        circle_id < 1000000
        -- real Circle that anyone signed in may read
        or exists (
          select 1 from public.circles ci
          where ci.id = posts.circle_id - 1000000
            and ci.visibility = 'Open to read'
        )
        -- real Circle you own or belong to
        or public.owns_circle(posts.circle_id - 1000000, auth.uid())
        or public.is_circle_member(posts.circle_id - 1000000, auth.uid())
      )
    )
  );

-- A check for stragglers: a thread aimed at a REAL Circle but stored with the
-- raw id (no offset) would be treated as a demo Circle above and be readable
-- by any signed-in user. This should return no rows. If it returns some,
-- those threads were written by an older version of the app.
--
--   select p.id, p.circle_id, c.name
--   from public.posts p
--   join public.circles c on c.id = p.circle_id
--   where p.visibility = 'circle' and p.circle_id < 1000000
--     and c.visibility = 'Members only';
