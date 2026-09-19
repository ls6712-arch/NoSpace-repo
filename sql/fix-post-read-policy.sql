-- NoSpace: close the loophole that lets anyone read posts they shouldn't.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- This file was written against the policies that are ACTUALLY live on the
-- project (checked with the query below), not against what the repo's older
-- SQL files describe. The two differ: live keeps its helper functions in a
-- `private` schema and still uses the Connections rule for 'friends' posts.
--
-- Check first (optional, this is how the problem was found):
--
--   select policyname, permissive, cmd, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT';
--
-- What was wrong
--   Four permissive SELECT policies apply to posts, and Postgres ORs
--   permissive policies together. One of them, "circle threads follow the
--   circle's visibility", begins with
--
--       visibility <> 'circle' OR circle_id IS NULL OR ...
--
--   which is true for every ordinary post. So it quietly lets anyone read
--   every non-Circle post, including 'friends' posts that are meant for the
--   author's connections only, and it does so no matter what the other
--   policies say. It also compares posts.circle_id to the raw circles.id,
--   although the app stores the id offset by 1,000,000, so it never actually
--   protected a Members-only Circle either.
--
-- What this does
--   1. Drops that one policy. The rest already do the right thing:
--        "posts are readable by their audience"  public, your own, or
--                                                'friends' + connected
--        "circle posts follow the circle's own visibility"  Circle threads,
--                                                offset-aware
--   2. Recreates the Circle policy so it accepts both spellings of "open"
--      ('open_to_read' as it was written, and 'Open to read' as the circles
--      table's own check constraint spells it), and requires a signed-in
--      reader. Everything else about it is unchanged.
--
-- It changes nothing about who can see PUBLIC posts or your own posts, and
-- it leaves the "Public posts are visible to everyone..." policy alone.
-- One transaction, so it either fully applies or not at all.

begin;

-- 1. The loophole.
drop policy if exists "circle threads follow the circle's visibility" on public.posts;

-- 2. The Circle-thread policy, same shape as before, both spellings, sign-in required.
drop policy if exists "circle posts follow the circle's own visibility" on public.posts;
create policy "circle posts follow the circle's own visibility"
  on public.posts for select
  using (
    visibility = 'circle'
    and circle_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.circles c
      where c.id = posts.circle_id - 1000000
        and (
          c.visibility in ('open_to_read', 'Open to read')
          or c.owner = auth.uid()
          or private.is_circle_member(c.id, auth.uid())
        )
    )
  );

commit;

-- Afterwards, this should list three policies, not four:
--   select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT';
