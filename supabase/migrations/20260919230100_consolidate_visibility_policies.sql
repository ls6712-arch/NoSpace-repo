-- Pause/deletion, migration (b): one SELECT policy per table instead of
-- several that OR together — multiple SELECT policies on the same table
-- combine with OR, so tightening one while a wider sibling policy still
-- exists changes nothing. Draft only.

-- profiles: was "Profiles are visible to everyone" (qual = true, no auth
-- check at all) OR "profiles are readable when signed in" (auth.uid() is
-- not null). Both dropped; replaced with one policy that adds the pause/
-- deletion check while keeping anonymous read for everyone else.
drop policy if exists "Profiles are visible to everyone" on public.profiles;
drop policy if exists "profiles are readable when signed in" on public.profiles;

create policy "profiles are visible unless paused or deleting"
  on public.profiles for select
  using (
    (paused_at is null and deletion_requested_at is null)
    or auth.uid() = id
  );

-- posts: three overlapping SELECT policies existed ("Public posts are
-- visible to everyone, private ones only to you", "circle posts follow the
-- circle's own visibility", "posts are readable by their audience"). The
-- first was a strict subset of the third and is just dropped. The 'friends'
-- branch is dropped too — 0 rows use it today (confirmed by query, not
-- assumption) — until the client stops writing that value (migration c
-- keeps the value legal at the DB level in the meantime). is_visible_profile
-- is added to every branch except "it's your own post," so pausing hides a
-- Moment from everyone but its author, including in an open-to-read Circle.
drop policy if exists "Public posts are visible to everyone, private ones only to you" on public.posts;
drop policy if exists "posts are readable by their audience" on public.posts;
drop policy if exists "circle posts follow the circle's own visibility" on public.posts;

create policy "posts are readable by their audience"
  on public.posts for select
  using (
    auth.uid() = user_id
    or (visibility = 'public' and public.is_visible_profile(user_id))
    or (
      visibility = 'circle'
      and circle_id is not null
      and auth.uid() is not null
      and public.is_visible_profile(user_id)
      and exists (
        select 1 from public.circles c
        where c.id = (posts.circle_id - 1000000)
          and (
            c.visibility = any (array['open_to_read', 'Open to read'])
            or c.owner = auth.uid()
            or private.is_circle_member(c.id, auth.uid())
          )
      )
    )
  );

-- pursuits: "you see your own pursuits" (own-only) was a strict subset of
-- "you see your own pursuits, others see only shared ones" and is dropped;
-- the survivor gets is_visible_profile on its "shared" branch.
drop policy if exists "you see your own pursuits" on public.pursuits;
drop policy if exists "you see your own pursuits, others see only shared ones" on public.pursuits;

create policy "you see your own pursuits, others see only shared ones"
  on public.pursuits for select
  using (
    auth.uid() = user_id
    or (shared = true and public.is_visible_profile(user_id))
  );
