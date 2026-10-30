-- Rollback for 20261109000000_profile_roles_and_planning.sql.
-- The one change to enforce_notification_insert was adding 'plan_invite' to the
-- allowed kinds: after this file, re-run that function's definition from
-- 20261022000000_save_notification.sql to take it out again.
drop function if exists public.send_plan_invite(uuid, text, date, text, text);
drop function if exists public.suggest_plan(uuid, text);
drop function if exists private.shared_slots(jsonb, jsonb, date);
drop function if exists public.set_my_planning(jsonb, integer, integer, jsonb, boolean);
drop function if exists public.get_my_planning();
drop function if exists public.set_pursuit_finished(text, boolean);
drop function if exists public.set_pursuit_archived(text, boolean);
drop function if exists public.delete_profile_pursuit(text);
drop function if exists public.get_my_post_private(bigint[]);
drop function if exists public.set_post_private(bigint, timestamptz, text, text);
drop function if exists public.create_profile_pursuit(text, text, integer);
drop function if exists public.update_profile_details(text, text, boolean);
drop function if exists public.set_planning_paused(boolean);
drop function if exists public.get_profile_pursuits(uuid);
drop function if exists public.get_profile_stubs(uuid);
drop function if exists public.get_profile_moments(uuid, integer, integer, text);
drop function if exists public.get_profile(text);
drop function if exists public.resolve_profile_handle(text);
drop function if exists private.can_read_lists(uuid, uuid);
drop function if exists private.viewer_role(uuid, uuid);
drop function if exists private.is_friend(uuid, uuid);
drop function if exists private.level_for(integer);
drop trigger if exists posts_seed_private on public.posts;
drop function if exists private.posts_seed_private();
drop table if exists public.post_private;
drop table if exists public.plan_suggestions;
drop table if exists public.plans;
drop table if exists public.planning_prefs;
drop trigger if exists posts_pursuit_auto_finish on public.posts;
drop function if exists private.pursuit_auto_finish();
drop trigger if exists posts_set_visible_at on public.posts;
drop function if exists private.posts_set_visible_at();
alter table public.posts drop column if exists visible_at, drop column if exists neighborhood;
alter table public.pursuits drop column if exists target_moments, drop column if exists archived_at;
alter table public.profiles drop constraint if exists profiles_bio_120;
alter table public.profiles drop column if exists planning_paused, drop column if exists is_private, drop column if exists neighborhood;

-- Put the two posts SELECT policies back as they were before this migration.
drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience" on public.posts
  for select
  using (
    ((select auth.uid()) = user_id)
    or (visibility = 'public' and public.is_visible_profile(user_id))
    or (
      visibility = 'followers'
      and (select auth.uid()) is not null
      and public.is_visible_profile(user_id)
      and exists (
        select 1 from public.profile_follows pf
         where pf.followed_id = posts.user_id
           and pf.follower_id = (select auth.uid())
           and pf.status = 'accepted'
      )
    )
  );
drop policy if exists "group posts are readable by the group" on public.posts;
create policy "group posts are readable by the group" on public.posts
  for select to authenticated
  using (
    audience = 'group'
    and pursuit_id is not null
    and public.is_pursuit_participant(pursuit_id, (select auth.uid()))
    and public.is_visible_profile(user_id)
  );
