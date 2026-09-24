-- Reverses supabase/migrations/20260919231000_pause_visibility_b2.sql,
-- restoring the exact policy text from docs/policies-before-20260919.txt.
-- The new thoughts_user_idx index is left in place — an index is inert
-- with respect to query results, only dropping it if you specifically want
-- the storage back.

drop policy if exists "post likes are readable" on public.post_likes;
create policy "post likes are readable"
  on public.post_likes for select
  using (auth.uid() is not null);

drop policy if exists "hobby follows are readable" on public.hobby_follows;
create policy "hobby follows are readable"
  on public.hobby_follows for select
  using (auth.uid() is not null);

drop policy if exists "profile links are readable when signed in" on public.profile_links;
create policy "profile links are readable when signed in"
  on public.profile_links for select
  using (auth.uid() is not null);

drop policy if exists "profile follows are readable when signed in" on public.profile_follows;
create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (auth.uid() is not null);

drop policy if exists "thoughts follow the moment's setting" on public.thoughts;
create policy "thoughts follow the moment's setting"
  on public.thoughts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.posts p
      where p.id = thoughts.post_id
        and (p.thoughts_private = false or p.user_id = auth.uid())
    )
  );

-- drop index if exists public.thoughts_user_idx;
