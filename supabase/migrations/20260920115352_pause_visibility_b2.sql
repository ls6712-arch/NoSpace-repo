-- Pause/deletion, migration (b2): extends is_visible_profile() to the
-- tables from the full cross-table audit that broadly expose a specific
-- user's activity to any signed-in stranger. Draft only.
--
-- Per-table decision (from the audit, confirmed before drafting):
--   post_likes, hobby_follows, profile_links -> add is_visible_profile(user_id)
--   profile_follows -> hide the row if EITHER party is not visible
--   thoughts -> hide a comment by a non-visible commenter, everywhere,
--               not just on posts whose own visibility already hides it
--   circle_members -> NO change (membership row stays; UI shows a
--                      name-less placeholder instead of hiding the row)
--   connections / messages -> NO change (retired feature)
--
-- auth.uid() is wrapped in `(select auth.uid())` in every policy below —
-- as a scalar subquery it's planned once per statement (an InitPlan)
-- instead of re-evaluated per row, which matters once these tables have
-- more than a handful of rows.

-- thoughts.user_id had no index at all before this — every other column
-- these policies filter on already did (checked via pg_indexes).
create index if not exists thoughts_user_idx on public.thoughts (user_id);

drop policy if exists "post likes are readable" on public.post_likes;
create policy "post likes are readable"
  on public.post_likes for select
  using (
    (select auth.uid()) is not null
    and public.is_visible_profile(user_id)
  );

drop policy if exists "hobby follows are readable" on public.hobby_follows;
create policy "hobby follows are readable"
  on public.hobby_follows for select
  using (
    (select auth.uid()) is not null
    and public.is_visible_profile(user_id)
  );

drop policy if exists "profile links are readable when signed in" on public.profile_links;
create policy "profile links are readable when signed in"
  on public.profile_links for select
  using (
    (select auth.uid()) is not null
    and public.is_visible_profile(user_id)
  );

-- is_visible_profile(uid) already returns true when uid = auth.uid(), so
-- "unless the viewer is that party" needs no separate clause here — a
-- paused person still sees their own follow/follower rows either way.
drop policy if exists "profile follows are readable when signed in" on public.profile_follows;
create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (
    (select auth.uid()) is not null
    and public.is_visible_profile(follower_id)
    and public.is_visible_profile(followed_id)
  );

-- "It's my own comment" stays visible to me regardless of my own pause
-- state (same owner-always-sees-own pattern as posts/pursuits); everyone
-- else loses it the moment I'm not visible, independent of whether the
-- post I commented on is itself still visible.
drop policy if exists "thoughts follow the moment's setting" on public.thoughts;
create policy "thoughts follow the moment's setting"
  on public.thoughts for select
  using (
    (select auth.uid()) = user_id
    or (
      public.is_visible_profile(user_id)
      and exists (
        select 1 from public.posts p
        where p.id = thoughts.post_id
          and (p.thoughts_private = false or p.user_id = (select auth.uid()))
      )
    )
  );
