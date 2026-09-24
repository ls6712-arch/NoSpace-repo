-- Reverses supabase/migrations/20260920020000_admin_function_and_grant_hardening.sql:
-- restores the five admin/usage functions to their original (buggy)
-- public.is_admin(auth.uid()) reference, re-grants anon EXECUTE on the
-- three functions revoked from it, and clears the pinned search_path on
-- reject_test_display_names. Does not touch profiles.is_admin grants or
-- policies — those are Migration 1's own rollback
-- (rollback_20260920010000_profiles_is_admin_lock.sql).

create or replace function public.admin_delete_circle(p_id bigint, p_threads text default 'keep_private'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_threads int;
  n_invites int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_threads not in ('keep_private', 'delete') then
    raise exception 'Choose what happens to the threads: keep_private or delete.';
  end if;

  if not exists (select 1 from public.circles where id = p_id) then
    raise exception 'That Circle doesn''t exist. (Demo Circles are built into the app and can''t be deleted here.)';
  end if;

  if p_threads = 'keep_private' then
    update public.posts
       set circle_id = null,
           circle_tab = null,
           hidden_from_moments = false
     where circle_id = p_id + 1000000;
  else
    delete from public.posts where circle_id = p_id + 1000000;
  end if;
  get diagnostics n_threads = row_count;

  delete from public.circle_invites where circle_id = p_id;
  get diagnostics n_invites = row_count;

  delete from public.circles where id = p_id;

  return jsonb_build_object('threads', n_threads, 'invites', n_invites, 'mode', p_threads);
end;
$function$;

create or replace function public.admin_delete_space(p_slug text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  usage jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_slug = any (array[
    'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
    'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
    'music', 'photography-film', 'health-wellness', 'fashion-beauty',
    'tech-building', 'collecting-fandom', 'travel-adventure'
  ]) then
    raise exception 'Built-in Spaces can be hidden but not deleted.';
  end if;

  if not exists (select 1 from public.categories where slug = p_slug) then
    raise exception 'That Space doesn''t exist.';
  end if;

  delete from public.corners where space_slug = p_slug and moment_count = 0;

  usage := public.space_usage(p_slug);
  if (usage->>'posts')::int > 0
     or (usage->>'pursuits')::int > 0
     or (usage->>'circles')::int > 0
     or (usage->>'corners')::int > 0 then
    raise exception 'Still in use: % Moments, % Pursuits, % Circles. Move them to another Space first, or hide this one instead.',
      usage->>'posts', usage->>'pursuits', usage->>'circles';
  end if;

  delete from public.categories where slug = p_slug;
end;
$function$;

create or replace function public.admin_move_space_content(p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_posts int;
  n_pursuits int;
  n_circles int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Pick two different Spaces.';
  end if;

  update public.posts set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_posts = row_count;

  update public.pursuits set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_pursuits = row_count;

  update public.circles set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_circles = row_count;

  return jsonb_build_object('posts', n_posts, 'pursuits', n_pursuits, 'circles', n_circles);
end;
$function$;

create or replace function public.circle_usage(p_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'members', (select count(*) from public.circle_members where circle_id = p_id),
    'invites', (select count(*) from public.circle_invites where circle_id = p_id),
    'threads', (select count(*) from public.posts          where circle_id = p_id + 1000000)
  );
end;
$function$;

create or replace function public.space_usage(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'posts',    (select count(*) from public.posts    where hobby_slug = p_slug),
    'pursuits', (select count(*) from public.pursuits where hobby_slug = p_slug),
    'circles',  (select count(*) from public.circles  where hobby_slug = p_slug),
    'corners',  (select count(*) from public.corners  where space_slug = p_slug and moment_count > 0)
  );
end;
$function$;

grant execute on function public.rl_post_likes() to anon;
grant execute on function public.sync_post_likes_count() to anon;
grant execute on function public.set_thread_answered(bigint, boolean) to anon;

alter function public.reject_test_display_names() reset search_path;
