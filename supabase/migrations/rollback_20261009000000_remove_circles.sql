-- Rollback for 20261009000000_remove_circles.sql.
--
-- Draft only — staged for review, not run.
--
-- Structural rollback only: every table, column, function, policy, index
-- and trigger this recreates comes back empty. Whatever Circle data existed
-- before the forward migration ran (circles, circle_members, circle_invites
-- rows, and whatever was in posts.circle_id/circle_tab/answered/
-- hidden_from_moments) is gone for good — DROP TABLE and DROP COLUMN are
-- not reversible operations. This only restores the shape a fresh Circle
-- could be created into again, not any Circle that already existed.
--
-- Bodies below are verbatim from sql/circles.sql, sql/circles-admin.sql,
-- sql/circle-invites.sql, sql/circle-threads.sql and sql/spaces-admin.sql,
-- and from 20261008000000_spaces_rework_moment_notifications.sql for
-- enforce_notification_insert — except is_admin(), fixed to private.is_admin()
-- everywhere sql/spaces-admin.sql/sql/circles-admin.sql still say
-- public.is_admin() (see 20260920020000_admin_function_and_grant_hardening.sql
-- — that fix is carried forward here rather than silently reverted).
--
-- The posts policy ("posts are readable by their audience") is restored
-- to its confirmed-live body (a real `pg_policies` query against the
-- database, not sql/circles.sql or sql/fix-post-read-policy.sql — both
-- turned out to describe something other than what's actually live),
-- circle branch included, referencing private.is_circle_member() as it
-- live does. circles/circle_members/circle_invites' own policies below
-- are restored to the canonical sql/circles.sql/sql/circle-invites.sql
-- shape (owns_circle()/is_circle_member() in `public`) — those tables are
-- fully dropped and recreated by this pair of migrations either way, so
-- their own internal policy wording doesn't carry the same live-drift risk
-- the posts policy did.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. posts columns (sql/circle-threads.sql section 1).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists circle_id bigint;

alter table public.posts add column if not exists circle_tab text;
alter table public.posts drop constraint if exists posts_circle_tab_check;
alter table public.posts
  add constraint posts_circle_tab_check
  check (circle_tab is null or circle_tab in ('updates', 'pursuits', 'questions', 'events'));

alter table public.posts add column if not exists answered boolean not null default false;
alter table public.posts add column if not exists hidden_from_moments boolean not null default false;

create index if not exists posts_circle_idx on public.posts (circle_id, circle_tab, created_at desc);

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'followers', 'space', 'just_me', 'circle'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. circles / circle_members (sql/circles.sql).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.circles (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  hobby_slug text not null,
  name text not null,
  location text,
  description text not null,
  purpose text not null,
  prompt text not null default 'What are you working on this week?',
  rules text[] not null default array[
    'Be the kind of member you''d want to find here.',
    'Keep it about the doing, not the selling.'
  ],
  visibility text not null default 'Open to read'
    check (visibility in ('Open to read', 'Members only')),
  created_at timestamptz not null default now()
);
alter table public.circles enable row level security;

create table if not exists public.circle_members (
  circle_id bigint not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
alter table public.circle_members enable row level security;

create index if not exists circles_hobby_idx on public.circles (hobby_slug);
create index if not exists circle_members_user_idx on public.circle_members (user_id);

create or replace function public.owns_circle(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner = u);
$$;

create or replace function public.is_circle_member(c bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m where m.circle_id = c and m.user_id = u
  );
$$;

create policy "circles are readable when signed in"
  on public.circles for select
  using (auth.uid() is not null);

create policy "you create your own circle"
  on public.circles for insert to authenticated
  with check (owner = auth.uid());

create policy "the owner edits their own circle"
  on public.circles for update
  using (owner = auth.uid()) with check (owner = auth.uid());

revoke update (owner) on public.circles from authenticated;

create policy "you see the roster of a circle you're in"
  on public.circle_members for select
  using (
    user_id = auth.uid()
    or public.is_circle_member(circle_id, auth.uid())
    or public.owns_circle(circle_id, auth.uid())
  );

create policy "you can join a circle yourself"
  on public.circle_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and (role = 'member' or public.owns_circle(circle_id, auth.uid()))
  );

revoke update (circle_id, user_id, role) on public.circle_members from authenticated;

create policy "you can leave a circle"
  on public.circle_members for delete
  using (user_id = auth.uid());

-- "posts are readable by their audience" — restored to its actual live
-- body (confirmed via a live `pg_policies` query, not sql/circles.sql —
-- see this file's header), circle branch included, private.is_circle_member
-- referenced as it live does (not the public.* version sql/circles.sql
-- describes).
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
    or (
      visibility = 'circle'
      and circle_id is not null
      and (select auth.uid()) is not null
      and is_visible_profile(user_id)
      and exists (
        select 1 from public.circles c
        where c.id = (posts.circle_id - 1000000)
          and (
            c.visibility = any (array['open_to_read', 'Open to read'])
            or c.owner = (select auth.uid())
            or private.is_circle_member(c.id, (select auth.uid()))
          )
      )
    )
  );

create or replace function public.real_circle_member_counts()
returns table(circle_id bigint, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select circle_id, count(*) as member_count
  from public.circle_members
  group by circle_id;
$$;
grant execute on function public.real_circle_member_counts() to anon, authenticated;

create or replace function public.rl_circles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circles_insert', 5, interval '1 day');
  return new;
end;
$$;
drop trigger if exists rl_circles_insert on public.circles;
create trigger rl_circles_insert before insert on public.circles
  for each row execute function public.rl_circles();

create or replace function public.rl_circle_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circle_members_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_circle_members_insert on public.circle_members;
create trigger rl_circle_members_insert before insert on public.circle_members
  for each row execute function public.rl_circle_members();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. circle_invites (sql/circle-invites.sql).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.circle_invites (
  id bigint generated always as identity primary key,
  circle_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id)
);
alter table public.circle_invites enable row level security;

create policy "you see your own circle invitations"
  on public.circle_invites for select
  using (user_id = auth.uid() or invited_by = auth.uid());

create policy "anyone can invite anyone to a circle"
  on public.circle_invites for insert to authenticated
  with check (invited_by = auth.uid() and user_id <> auth.uid());

create policy "you answer your own circle invitation"
  on public.circle_invites for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update (circle_id, user_id, invited_by) on public.circle_invites from authenticated;

create policy "you can leave a circle you joined"
  on public.circle_invites for delete
  using (user_id = auth.uid());

create or replace function public.circle_member_counts()
returns table(circle_id bigint, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select circle_id, count(*) as member_count
  from public.circle_invites
  where status = 'joined'
  group by circle_id;
$$;
grant execute on function public.circle_member_counts() to anon, authenticated;

create index if not exists circle_invites_user_idx on public.circle_invites (user_id, status);
create index if not exists circle_invites_circle_idx on public.circle_invites (circle_id, status);

create or replace function public.rl_circle_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circle_invites_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_circle_invites_insert on public.circle_invites;
create trigger rl_circle_invites_insert before insert on public.circle_invites
  for each row execute function public.rl_circle_invites();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. set_thread_answered (sql/circle-threads.sql section 1) — depends on
--    owns_circle(), recreated above in section 2.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_thread_answered(p_post_id bigint, p_answered boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_circle bigint;
begin
  select user_id, circle_id into v_owner, v_circle from public.posts where id = p_post_id;
  if v_owner is null then
    return false;
  end if;
  if auth.uid() is distinct from v_owner
     and (v_circle is null or not public.owns_circle(v_circle, auth.uid())) then
    return false;
  end if;
  update public.posts set answered = p_answered where id = p_post_id;
  return true;
end;
$$;
grant execute on function public.set_thread_answered(bigint, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. circles-admin (sql/circles-admin.sql).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.circle_usage(p_id bigint)
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
    'members', (select count(*) from public.circle_members where circle_id = p_id),
    'invites', (select count(*) from public.circle_invites where circle_id = p_id),
    'threads', (select count(*) from public.posts          where circle_id = p_id + 1000000)
  );
end;
$$;
revoke all on function public.circle_usage(bigint) from public, anon;
grant execute on function public.circle_usage(bigint) to authenticated;

create or replace function public.admin_delete_circle(
  p_id bigint,
  p_threads text default 'keep_private'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;
revoke all on function public.admin_delete_circle(bigint, text) from public, anon;
grant execute on function public.admin_delete_circle(bigint, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. space_usage() / admin_delete_space() / admin_move_space_content() —
--    restored to their circles-aware bodies (sql/spaces-admin.sql).
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
    'circles',  (select count(*) from public.circles  where hobby_slug = p_slug),
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
$$;
revoke all on function public.admin_move_space_content(text, text) from public, anon;
grant execute on function public.admin_move_space_content(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. enforce_notification_insert — restored to its 20261008000000 body,
--    'circle_invite' included.
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
    'message', 'accepted', 'circle_invite', 'message_request', 'space_invite',
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
