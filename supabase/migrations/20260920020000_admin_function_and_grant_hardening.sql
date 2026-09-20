-- Security hardening, draft only — NOT APPLIED. Apply AFTER
-- 20260920010000_profiles_is_admin_lock.sql (Migration 1), which closes
-- the profiles.is_admin privilege escalation separately — that section
-- has been split out of this file, not duplicated here.
--
-- Three independent fixes:
--
-- (1) admin_delete_circle, admin_delete_space, admin_move_space_content,
--     circle_usage, and space_usage all call `public.is_admin(auth.uid())`
--     — a function that does not exist. Only `private.is_admin(uuid)`
--     exists. Confirmed live (2026-09-20): only `private.is_admin` shows
--     up anywhere in pg_proc; PL/pgSQL doesn't validate object references
--     until runtime, so all five compiled fine and error for EVERY caller
--     the moment they're invoked — tested with a non-admin throwaway
--     account, in a rolled-back transaction:
--       42883: function public.is_admin(uuid) does not exist
--     Not a privilege-escalation risk (fails closed for everyone, not just
--     non-admins) but a real correctness bug — right now these five don't
--     work for actual admins either. Fixed here by re-pointing the call at
--     `private.is_admin`; nothing else in any of the five bodies changes.
--
--     EXECUTE on all five is already `authenticated` only (never granted
--     to anon or public — confirmed via information_schema.routine_
--     privileges), and grep of src/ confirms `authenticated` is exactly
--     what the admin UI needs:
--       CategoriesContext.tsx -> space_usage, admin_delete_space, admin_move_space_content
--       CirclesContext.tsx    -> circle_usage, admin_delete_circle
--     So there is nothing to revoke or re-grant for these five — only the
--     body fix applies.
--
-- (2) EXECUTE revocations from anon, per review, after grepping src/ for
--     any logged-out caller:
--       - rl_post_likes, sync_post_likes_count: trigger functions only
--         (post_likes_sync_count, rl_post_likes_insert triggers on
--         public.post_likes) — no `.rpc(...)` call anywhere in src/, and a
--         trigger fires regardless of the invoking role's own EXECUTE
--         privilege on the trigger function. Safe to revoke from anon.
--       - set_thread_answered: called only from
--         ContentContext.tsx's setThreadAnswered, which opens with
--         `if (!supabase || !user) return false;` before ever calling the
--         RPC — confirmed never reachable while logged out. Safe to
--         revoke from anon.
--       - real_circle_member_counts: EXCLUDED from this migration, per
--         decision. CirclesContext.tsx's refresh() calls
--         `supabase.rpc("real_circle_member_counts")` unconditionally, in
--         the same Promise.all as the unauthenticated-safe circles list —
--         it is NOT gated behind `if (user)` the way the circle_members
--         "mine" fetch two lines below it is. Revoking anon's EXECUTE here
--         would degrade circle member counts to empty for logged-out
--         visitors, so it stays anon-callable.
--
-- is_visible_profile is untouched — already anon + authenticated, as
-- intended.
--
-- (3) reject_test_display_names has a mutable search_path (advisor WARN).
--     Trigger function body has no schema-qualified calls, so this is a
--     plain ALTER, no body change needed.
--
-- (4) Drift note: circle_usage (and admin_delete_circle) query
--     public.circle_invites, a table that does not show up anywhere in
--     the public-schema introspection this baseline was built from —
--     same drift already flagged in docs/backend-state-20260920.md
--     ("circle_invites / shared_milestones / is_admin drift"). Until that
--     table is accounted for, circle_usage(p_id) and the invites branch
--     of admin_delete_circle(p_id, ...) will fail with
--     "relation public.circle_invites does not exist" for an actual
--     admin, on top of (now fixed) the is_admin reference. Not fixed
--     here — tracked as the existing drift follow-up, not new scope for
--     this migration.
--
-- (1) fix the broken admin-check reference -----------------------------

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
  if not private.is_admin(auth.uid()) then
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
  if not private.is_admin(auth.uid()) then
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
  if not private.is_admin(auth.uid()) then
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
  if not private.is_admin(auth.uid()) then
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
  if not private.is_admin(auth.uid()) then
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

-- (2) tighten anon EXECUTE on trigger-only / login-gated functions ------

revoke execute on function public.rl_post_likes() from anon;
revoke execute on function public.sync_post_likes_count() from anon;
revoke execute on function public.set_thread_answered(bigint, boolean) from anon;

-- real_circle_member_counts deliberately NOT touched — see note above.

-- (3) pin search_path on reject_test_display_names ----------------------

alter function public.reject_test_display_names() set search_path = public;
