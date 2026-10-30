-- Rollback for 20261110000000_profile_roles_and_planning.sql.
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
drop function if exists public.get_moment_hold(bigint);
drop function if exists public.release_moment(bigint);
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
alter table public.posts drop column if exists visible_at, drop column if exists neighborhood, drop column if exists notified_at;
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

-- Deferred release effects: put the on-insert versions back.
do $do$
begin
  perform cron.unschedule('release-held-moments');
exception when others then
  null;
end
$do$;
drop trigger if exists posts_release_on_insert on public.posts;
drop function if exists private.posts_release_on_insert();
drop function if exists public.sweep_released_moments();
drop function if exists private.apply_release_effects(bigint);
drop function if exists private.notify_space_moment_pending(uuid, bigint);

create function public.notify_first_moment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inviter uuid;
  v_name text;
begin
  if new.visibility not in ('public', 'followers') then
    return new;
  end if;
  select profiles.invited_by into v_inviter from profiles where profiles.id = new.user_id;
  if v_inviter is null or v_inviter = new.user_id then
    return new;
  end if;
  if exists (
    select 1 from posts
    where posts.user_id = new.user_id and posts.id <> new.id and posts.visibility in ('public', 'followers')
  ) then
    return new;
  end if;
  if exists (
    select 1 from notifications
    where notifications.user_id = v_inviter and notifications.kind = 'first_moment' and notifications.actor_id = new.user_id
  ) then
    return new;
  end if;
  v_name := coalesce(public.pursuit_person_name(new.user_id), 'Someone');
  begin
    insert into notifications (user_id, kind, body, href, actor_name)
    values (v_inviter, 'first_moment', left(v_name, 60) || ' added their first moment.', '/moment/' || new.id, v_name);
  exception when others then
    raise warning 'notify_first_moment skipped: % %', sqlstate, sqlerrm;
  end;
  return new;
end;
$function$;
create trigger posts_notify_first_moment after insert on public.posts
  for each row execute function public.notify_first_moment();

create or replace function public.sync_corner_moment_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (tg_op = 'DELETE') then
    if coalesce(old.corner, old.sub_hobby) is not null and old.visibility = 'public' then
      update public.corners set moment_count = greatest(moment_count - 1, 0)
        where space_slug = old.hobby_slug and slug = coalesce(old.corner, old.sub_hobby);
    end if;
    return old;
  end if;
  if (tg_op = 'UPDATE') then
    if coalesce(old.corner, old.sub_hobby) is distinct from coalesce(new.corner, new.sub_hobby)
       or old.hobby_slug is distinct from new.hobby_slug
       or old.visibility is distinct from new.visibility then
      if coalesce(old.corner, old.sub_hobby) is not null and old.visibility = 'public' then
        update public.corners set moment_count = greatest(moment_count - 1, 0)
          where space_slug = old.hobby_slug and slug = coalesce(old.corner, old.sub_hobby);
      end if;
      if coalesce(new.corner, new.sub_hobby) is not null and new.visibility = 'public' then
        insert into public.corners (space_slug, slug, name, moment_count)
        values (new.hobby_slug, coalesce(new.corner, new.sub_hobby), coalesce(new.corner, new.sub_hobby), 1)
        on conflict (space_slug, slug)
          do update set moment_count = public.corners.moment_count + 1;
      end if;
    end if;
    return new;
  end if;
  if coalesce(new.corner, new.sub_hobby) is not null and new.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (new.hobby_slug, coalesce(new.corner, new.sub_hobby), coalesce(new.corner, new.sub_hobby), 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  return new;
end;
$function$;

create or replace function public.corner_activity_30d()
returns table(space_slug text, slug text, moments_30d bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.hobby_slug as space_slug, coalesce(p.corner, p.sub_hobby) as slug, count(*) as moments_30d
  from public.posts p
  where p.visibility = 'public'
    and coalesce(p.corner, p.sub_hobby) is not null
    and p.created_at > now() - interval '30 days'
  group by 1, 2;
$function$;

create or replace function public.space_moment_count_30d(p_space_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int
  from space_moments sm
  join spaces s on s.id = sm.space_id
  where sm.space_id = p_space_id
    and sm.status = 'approved'
    and sm.removed_by_host = false
    and sm.added_at > now() - interval '30 days'
    and (s.status <> 'deleted' or private.is_admin(auth.uid()));
$function$;

create or replace function public.notify_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_author_id uuid;
  v_author_name text;
  v_space_name text;
  v_space_slug text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select posts.user_id into v_author_id from posts where posts.id = new.post_id;
    select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
      into v_author_name from profiles where profiles.id = v_author_id;
    select spaces.name, spaces.slug into v_space_name, v_space_slug
      from spaces where spaces.id = new.space_id;

    insert into notifications (user_id, kind, body, href, actor_name)
    select space_members.user_id, 'space_moment_pending',
      left(coalesce(v_author_name, 'Someone'), 60) || ' shared a Moment in ' || left(v_space_name, 150) || ' for approval.',
      '/space/' || v_space_slug || '?tab=manage',
      v_author_name
    from space_members
    where space_members.space_id = new.space_id
      and space_members.role = 'host'
      and space_members.status = 'active'
      and space_members.user_id <> v_author_id;

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    select posts.user_id into v_author_id from posts where posts.id = new.post_id;
    select spaces.name, spaces.slug into v_space_name, v_space_slug
      from spaces where spaces.id = new.space_id;

    insert into notifications (user_id, kind, body, href)
    values (
      v_author_id, 'space_moment_approved',
      'Your Moment is now on the table in ' || left(v_space_name, 150) || '.',
      '/space/' || v_space_slug
    );
  end if;
  return new;
end;
$function$;
