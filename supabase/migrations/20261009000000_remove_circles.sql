-- Sushii: Phase 6 — remove Circles from the database completely.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- The frontend feature (Circle pages, CirclesContext, ConnectionsContext,
-- Circle-posting in Log.tsx/MomentCard.tsx, the Circle invitations
-- notification toggle) is already deleted from src/. This migration drops
-- every piece of schema that only existed to back it: the circles,
-- circle_members and circle_invites tables; the circle_id/circle_tab/
-- answered/hidden_from_moments columns on posts (all four were introduced
-- together by sql/circle-threads.sql specifically for Circle threads, and
-- have no caller left outside that feature — confirmed by grep across
-- src/ before writing this); and every function, trigger and policy that
-- exists only to serve those tables/columns.
--
-- Every DROP below is a plain DROP, never CASCADE — each dependency is
-- listed and dropped explicitly, in dependency order, so nothing here can
-- silently take an unrelated object down with it. The dependency map,
-- gathered from sql/circles.sql, sql/circles-admin.sql,
-- sql/circle-invites.sql and sql/circle-threads.sql, corrected against the
-- actual live `pg_policies` dump where the two disagreed (see section 1):
--
--   circles                     <- circle_members.circle_id (FK, cascade)
--                                <- circle_invites.circle_id (no FK, plain int)
--                                <- posts.circle_id (no FK, plain bigint)
--                                <- owns_circle(), is_circle_member()
--                                <- 3 policies on circles itself
--                                <- the circle branch of "posts are
--                                   readable by their audience" on posts
--                                <- real_circle_member_counts()
--                                <- rl_circles() + its trigger
--                                <- circle_usage(), admin_delete_circle()
--                                <- space_usage(), admin_move_space_content()
--   circle_members               <- 3 policies on circle_members itself
--                                <- rl_circle_members() + its trigger
--                                <- real_circle_member_counts()
--   circle_invites                <- 4 policies on circle_invites itself
--                                <- rl_circle_invites() + its trigger
--                                <- circle_member_counts()
--                                <- circle_usage(), admin_delete_circle()
--   posts.circle_id/circle_tab   <- posts_circle_idx (index)
--                                <- posts_circle_tab_check (constraint)
--                                <- set_thread_answered() (also reads answered)
--                                <- the circle branch of "posts are
--                                   readable by their audience"
--   posts.answered               <- set_thread_answered()
--   posts.hidden_from_moments    <- admin_delete_circle() (resets it)
--
-- "posts are readable by their audience" — the one live SELECT policy on
-- posts — is re-created first, before any other Circle drop, with its
-- circle branch removed and its own/public/followers branches kept
-- byte-for-byte. Confirmed against a live `select policyname, cmd, qual
-- from pg_policies where schemaname = 'public' and tablename = 'posts';`
-- run against the actual database, not against sql/circles.sql or
-- sql/fix-post-read-policy.sql — both turned out to describe a shape
-- (a standalone "circle threads follow..."/"circle posts follow..."
-- policy, owns_circle/is_circle_member possibly still in `public`) that
-- isn't what's actually live. Space visibility (a 'space' branch) is
-- deliberately NOT added here — out of scope for this PR, tracked
-- separately.
--
-- space_usage()/admin_delete_space()/admin_move_space_content() are
-- re-created below verbatim minus their circles references — none of them
-- are dropped, since Spaces themselves aren't going anywhere.
--
-- posts_visibility_check is narrowed to drop 'circle' — guarded by a
-- read-only count check right at the top of this transaction, which
-- aborts the whole migration (nothing below it runs) if any live row
-- still has visibility = 'circle'. Run this yourself first if you want to
-- see the number before running the migration:
--
--   select count(*) from public.posts where visibility = 'circle';
--
-- enforce_notification_insert is re-created verbatim from its current live
-- body (20261008000000_spaces_rework_moment_notifications.sql) minus
-- 'circle_invite' from the allowed-kinds list.
--
-- Not run: this repo's SQL isn't executed by this session. Review, then
-- run it yourself.

-- ─────────────────────────────────────────────────────────────────────────
-- 0. Safety gate — refuses to continue if any live post still uses the
--    visibility this migration is about to make illegal.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_circle_posts int;
begin
  select count(*) into v_circle_posts from public.posts where posts.visibility = 'circle';
  if v_circle_posts > 0 then
    raise exception 'Refusing to continue: % post(s) still have visibility = ''circle''. Resolve them before running this migration.', v_circle_posts;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. "posts are readable by their audience" — re-created first, own/
--    public/followers branches verbatim from the live qual, circle branch
--    removed. This is the ONE live SELECT policy on posts (confirmed via
--    pg_policies — there is no separate "circle threads..."/"circle
--    posts..." policy on this database). Doing this before any other
--    Circle drop means posts.circle_id and private.is_circle_member() stop
--    being referenced by anything the moment this statement runs.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience"
  on public.posts for select
  using (
    (select auth.uid()) = user_id
    or (visibility = 'public' and is_visible_profile(user_id))
    or (
      visibility = 'followers'
      and (select auth.uid()) is not null
      and is_visible_profile(user_id)
      and exists (
        select 1 from public.profile_follows pf
        where pf.followed_id = posts.user_id
          and pf.follower_id = (select auth.uid())
          and pf.status = 'accepted'
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Triggers, then the trigger functions they call.
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists rl_circles_insert on public.circles;
drop trigger if exists rl_circle_members_insert on public.circle_members;
drop trigger if exists rl_circle_invites_insert on public.circle_invites;

drop function if exists public.rl_circles();
drop function if exists public.rl_circle_members();
drop function if exists public.rl_circle_invites();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Policies — every one left that reads or writes circles/circle_members/
--    circle_invites. The posts policy is handled in section 1 above, not
--    here.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "you see the roster of a circle you're in" on public.circle_members;
drop policy if exists "you can join a circle yourself" on public.circle_members;
drop policy if exists "you can leave a circle" on public.circle_members;

drop policy if exists "circles are readable when signed in" on public.circles;
drop policy if exists "circles are visible to everyone" on public.circles;
drop policy if exists "you create your own circle" on public.circles;
drop policy if exists "the owner edits their own circle" on public.circles;

drop policy if exists "you see your own circle invitations" on public.circle_invites;
drop policy if exists "anyone can invite anyone to a circle" on public.circle_invites;
drop policy if exists "you answer your own circle invitation" on public.circle_invites;
drop policy if exists "you can leave a circle you joined" on public.circle_invites;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Functions — admin/usage functions first (they reference the tables
--    and the posts columns below), then the plain helpers.
--
--    owns_circle()/is_circle_member() are dropped from both `public` and
--    `private`: sql/circles.sql defines them in `public`, but a live
--    pg-introspected dump (docs/schema-baseline-20260920.sql) and
--    sql/fix-post-read-policy.sql both show them actually living in
--    `private` on this project — the same drift fix-post-read-policy.sql's
--    own header documents for the posts policy above. Dropping both names
--    in both schemas is harmless regardless of which is actually live.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.circle_usage(bigint);
drop function if exists public.admin_delete_circle(bigint, text);
drop function if exists public.set_thread_answered(bigint, boolean);
drop function if exists public.real_circle_member_counts();
drop function if exists public.circle_member_counts();
drop function if exists public.owns_circle(bigint, uuid);
drop function if exists public.is_circle_member(bigint, uuid);
drop function if exists private.owns_circle(bigint, uuid);
drop function if exists private.is_circle_member(bigint, uuid);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. posts: the index and check constraint that reference the columns
--    below, then the columns themselves — explicit, so the column drops
--    never need CASCADE.
-- ─────────────────────────────────────────────────────────────────────────
drop index if exists public.posts_circle_idx;
alter table public.posts drop constraint if exists posts_circle_tab_check;

alter table public.posts drop column if exists circle_id;
alter table public.posts drop column if exists circle_tab;
alter table public.posts drop column if exists answered;
alter table public.posts drop column if exists hidden_from_moments;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Indexes on circle_invites/circle_members/circles, then the tables
--    themselves — circle_invites and circle_members before circles, since
--    circle_members.circle_id is a foreign key into circles (dropping
--    circle_members first removes that FK along with it, so the circles
--    table drop below never needs CASCADE either).
-- ─────────────────────────────────────────────────────────────────────────
drop index if exists public.circle_invites_user_idx;
drop index if exists public.circle_invites_circle_idx;
drop table if exists public.circle_invites;

drop index if exists public.circle_members_user_idx;
drop table if exists public.circle_members;

drop index if exists public.circles_hobby_idx;
drop table if exists public.circles;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. space_usage() / admin_delete_space() / admin_move_space_content() —
--    re-created minus every circles reference. Based on the live bodies
--    from 20260920020000_admin_function_and_grant_hardening.sql (which
--    fixed all three to call private.is_admin(), not the nonexistent
--    public.is_admin() sql/spaces-admin.sql itself still shows — carrying
--    that fix forward here rather than silently reverting it).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.space_usage(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'posts',    (select count(*) from public.posts    where hobby_slug = p_slug),
    'pursuits', (select count(*) from public.pursuits where hobby_slug = p_slug),
    -- A Corner with no Moments left in it is just a name; only ones that
    -- still hold Moments count as in use.
    'corners',  (select count(*) from public.corners  where space_slug = p_slug and moment_count > 0)
  );
end;
$$;

revoke all on function public.space_usage(text) from public, anon;
grant execute on function public.space_usage(text) to authenticated;

create or replace function public.admin_delete_space(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usage jsonb;
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  -- The fifteen built-ins live in code and are referenced everywhere, so the
  -- server refuses to delete them no matter what the client sends.
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

  -- Empty Corners are just names; clear them so they don't block the delete.
  delete from public.corners where space_slug = p_slug and moment_count = 0;

  usage := public.space_usage(p_slug);
  if (usage->>'posts')::int > 0
     or (usage->>'pursuits')::int > 0
     or (usage->>'corners')::int > 0 then
    raise exception 'Still in use: % Moments, % Pursuits. Move them to another Space first, or hide this one instead.',
      usage->>'posts', usage->>'pursuits';
  end if;

  delete from public.categories where slug = p_slug;
end;
$$;

revoke all on function public.admin_delete_space(text) from public, anon;
grant execute on function public.admin_delete_space(text) to authenticated;

create or replace function public.admin_move_space_content(p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_posts int;
  n_pursuits int;
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

  return jsonb_build_object('posts', n_posts, 'pursuits', n_pursuits);
end;
$$;

revoke all on function public.admin_move_space_content(text, text) from public, anon;
grant execute on function public.admin_move_space_content(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. posts_visibility_check — drops 'circle', guarded by the safety gate
--    in section 0 above.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'followers', 'space', 'just_me'));

-- ─────────────────────────────────────────────────────────────────────────
-- 9. enforce_notification_insert — verbatim from 20261008000000 (the
--    latest live definition), minus 'circle_invite' from the allowed list.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_id := auth.uid();

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  if private.notification_kind_muted(new.user_id, new.kind) then
    return null;
  end if;

  return new;
end;
$$;
