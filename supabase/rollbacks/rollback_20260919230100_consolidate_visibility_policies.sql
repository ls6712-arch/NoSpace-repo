-- Reverses supabase/migrations/20260919230100_consolidate_visibility_policies.sql,
-- restoring the exact policy text captured in
-- docs/policies-before-20260919.txt. Run this BEFORE rolling back
-- migration (a), since it removes every call to is_visible_profile().

drop policy if exists "profiles are visible unless paused or deleting" on public.profiles;

create policy "Profiles are visible to everyone"
  on public.profiles for select
  using (true);

create policy "profiles are readable when signed in"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy if exists "posts are readable by their audience" on public.posts;

create policy "Public posts are visible to everyone, private ones only to you"
  on public.posts for select
  using (visibility = 'public' or auth.uid() = user_id);

create policy "circle posts follow the circle's own visibility"
  on public.posts for select
  using (
    visibility = 'circle'
    and circle_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.circles c
      where c.id = (posts.circle_id - 1000000)
        and (
          c.visibility = any (array['open_to_read', 'Open to read'])
          or c.owner = auth.uid()
          or private.is_circle_member(c.id, auth.uid())
        )
    )
  );

create policy "posts are readable by their audience"
  on public.posts for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (visibility = 'friends' and private.are_connected(user_id, auth.uid()))
  );

drop policy if exists "you see your own pursuits, others see only shared ones" on public.pursuits;

create policy "you see your own pursuits"
  on public.pursuits for select
  using (auth.uid() = user_id);

create policy "you see your own pursuits, others see only shared ones"
  on public.pursuits for select
  using (auth.uid() = user_id or shared = true);
