-- Soosh profile: role-aware reads, Pursuit targets, planning and plans.
--
-- Run AFTER 20261108000000_require_birthdate.sql.
--
-- Decisions (the repo already had most of this, so it is extended, not copied):
--   * Friend = two accepted rows in public.profile_follows (one each way). The
--     accept-based follow flow is unchanged.
--   * A Pursuit's category is its Corner name (pursuits.sub_hobby, else
--     pursuits.interest), its goal is pursuits.title, and its status is
--     pursuits.finished_at (null = active). Only target_moments is new.
--   * A Stub is a public.stubs row of kind 'session' (one per Moment that
--     counts toward a Pursuit). Stub counts are derived, never stored.
--   * A Moment's exact time (occurred_at) and exact place (place_name) live in
--     public.post_private: no grants for anyone, no policy, reachable only through
--     get_my_post_private() / set_post_private() (the owner) and the profile
--     functions below. posts.starts_at and posts.location_name belong to the
--     separate Activity feature and are not read by the profile at all.
--     neighborhood (public, coarse) and visible_at are new columns on posts.
--   * Non-owners see only Pursuits the owner shared (pursuits.shared), as the
--     old public profile did.
--   * The profile reads are security definer functions that build a different
--     jsonb shape per role, so a field a viewer may not see is never sent.
--   * planning_prefs, plans and plan_suggestions have RLS on and no policy for
--     anyone but the owner. Friends only ever see output of suggest_plan().
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261109000000_profile_roles_and_planning.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column neighborhood text check (char_length(neighborhood) <= 80),
  add column is_private boolean not null default false,
  add column planning_paused boolean not null default false;
-- Existing bios may be longer; only new writes are held to 120.
alter table public.profiles
  add constraint profiles_bio_120 check (char_length(bio) <= 120) not valid;
-- New profile columns stay private to direct reads (see profiles_column_privacy):
-- everyone else gets them through get_profile() below.

alter table public.pursuits
  add column target_moments integer check (target_moments is null or target_moments between 1 and 1000),
  -- Archive hides a Pursuit from everyone but its owner and keeps its Stubs; deleting removes the Stubs too.
  add column archived_at timestamptz;

alter table public.posts
  add column neighborhood text check (char_length(neighborhood) <= 80),
  add column visible_at timestamptz;

create function private.posts_set_visible_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visible_at is null then
    new.visible_at := coalesce(new.created_at, now()) + interval '2 hours';
  end if;
  return new;
end;
$$;
revoke all on function private.posts_set_visible_at() from public, anon, authenticated;
create trigger posts_set_visible_at
  before insert on public.posts
  for each row execute function private.posts_set_visible_at();

-- Moments made before this migration get visible_at and occurred_at from the
-- backfill migration (20261109010000); until then a null visible_at counts as
-- visible, so no old Moment disappears in between.

create table public.post_private (
  post_id bigint primary key references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  place_name text check (char_length(place_name) <= 80)
);
create index post_private_user_idx on public.post_private (user_id);
alter table public.post_private enable row level security;
revoke all on public.post_private from anon, authenticated;
-- No grant and no policy: a direct select fails for every signed-in role.

create function private.posts_seed_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.post_private (post_id, user_id, occurred_at)
  values (new.id, new.user_id, coalesce(new.created_at, now()))
  on conflict (post_id) do nothing;
  return new;
end;
$$;
revoke all on function private.posts_seed_private() from public, anon, authenticated;
create trigger posts_seed_private
  after insert on public.posts
  for each row execute function private.posts_seed_private();

-- The owner reads their own exact time and place.
create function public.get_my_post_private(p_ids bigint[])
returns table (post_id bigint, occurred_at timestamptz, place_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.post_id, pp.occurred_at, pp.place_name
    from public.post_private pp
   where pp.user_id = auth.uid() and pp.post_id = any (p_ids);
$$;

create function public.set_post_private(p_post_id bigint, p_occurred_at timestamptz, p_place_name text, p_neighborhood text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts po where po.id = p_post_id and po.user_id = auth.uid()) then
    raise exception 'That Moment isn’t yours.' using errcode = '42501';
  end if;
  insert into public.post_private (post_id, user_id, occurred_at, place_name)
  values (p_post_id, auth.uid(), coalesce(p_occurred_at, now()), nullif(btrim(left(p_place_name, 80)), ''))
  on conflict (post_id) do update
    set occurred_at = coalesce(p_occurred_at, public.post_private.occurred_at),
        place_name = nullif(btrim(left(p_place_name, 80)), '');
  update public.posts po set neighborhood = nullif(btrim(left(p_neighborhood, 80)), '')
   where po.id = p_post_id;
end;
$$;
revoke all on function public.get_my_post_private(bigint[]), public.set_post_private(bigint, timestamptz, text, text) from public, anon;
grant execute on function public.get_my_post_private(bigint[]), public.set_post_private(bigint, timestamptz, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. A Pursuit with a target finishes itself when its last Moment lands
-- ─────────────────────────────────────────────────────────────────────────
create function private.pursuit_auto_finish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target integer;
  v_count integer;
begin
  if new.pursuit_id is null then
    return new;
  end if;
  v_target := (select pu.target_moments from public.pursuits pu
                where pu.id = new.pursuit_id and pu.finished_at is null);
  if v_target is null then
    return new;
  end if;
  v_count := (select count(*) from public.posts po where po.pursuit_id = new.pursuit_id);
  if v_count >= v_target then
    update public.pursuits pu set finished_at = coalesce(new.created_at, now())
     where pu.id = new.pursuit_id and pu.finished_at is null;
  end if;
  return new;
end;
$$;
revoke all on function private.pursuit_auto_finish() from public, anon, authenticated;
create trigger posts_pursuit_auto_finish
  after insert on public.posts
  for each row execute function private.pursuit_auto_finish();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Planning (owner only) and plans
-- ─────────────────────────────────────────────────────────────────────────
create table public.planning_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  availability jsonb not null default '[]'::jsonb,
  free_hours_per_week integer check (free_hours_per_week is null or free_hours_per_week between 0 and 168),
  monthly_budget_cents integer check (monthly_budget_cents is null or monthly_budget_cents >= 0),
  memberships jsonb not null default '[]'::jsonb,
  share_memberships_with_friends boolean not null default true,
  calendar_connected boolean not null default false,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(availability) = 'array' and jsonb_array_length(availability) <= 21),
  check (jsonb_typeof(memberships) = 'array' and jsonb_array_length(memberships) <= 30)
);
alter table public.planning_prefs enable row level security;
revoke all on public.planning_prefs from anon, authenticated;
-- No policy and no grant: only the security definer functions below touch it.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  category text check (char_length(category) <= 60),
  plan_date date,
  part text check (part in ('morning', 'afternoon', 'evening')),
  place_name text check (char_length(place_name) <= 80),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (creator_id <> invitee_id),
  check ((plan_date is null) = (part is null))
);
create index plans_invitee_idx on public.plans (invitee_id, created_at desc);
alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;
-- The invitee sees the plan, not who suggested which time; the creator sees theirs.
create policy "plan parties read plans" on public.plans for select to authenticated
  using (plans.creator_id = (select auth.uid()) or plans.invitee_id = (select auth.uid()));

-- Cache and rate limit for suggest_plan, one row per ordered pair per call.
create table public.plan_suggestions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index plan_suggestions_pair_idx on public.plan_suggestions (user_id, friend_id, created_at desc);
alter table public.plan_suggestions enable row level security;
revoke all on public.plan_suggestions from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Levels and roles
-- ─────────────────────────────────────────────────────────────────────────
create function private.level_for(p_stubs integer)
returns table (idx integer, name text)
language sql
immutable
set search_path = ''
as $$
  select l.idx, l.name
    from (values
      (1, 'Just Getting Started', 0), (2, 'First Step', 1), (3, 'Out & About', 3),
      (4, 'Weekend Regular', 7), (5, 'Plan Maker', 10), (6, 'Good Company', 20),
      (7, 'Neighborhood Regular', 35), (8, 'Local Legend', 50)
    ) as l (idx, name, min_stubs)
   where l.min_stubs <= greatest(p_stubs, 0)
   order by l.idx desc
   limit 1;
$$;

create function private.is_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profile_follows f
                  where f.follower_id = a and f.followed_id = b and f.status = 'accepted')
     and exists (select 1 from public.profile_follows f
                  where f.follower_id = b and f.followed_id = a and f.status = 'accepted');
$$;

-- owner | friend | follower | public | blocked.
-- "follower" is a viewer who follows the profile without being followed back.
create function private.viewer_role(p_viewer uuid, p_profile uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_viewer is not null and p_viewer = p_profile then 'owner'
    when p_viewer is not null and private.is_blocked_between(p_viewer, p_profile) then 'blocked'
    when p_viewer is not null and private.is_friend(p_viewer, p_profile) then 'friend'
    when p_viewer is not null and exists (
      select 1 from public.profile_follows f
       where f.follower_id = p_viewer and f.followed_id = p_profile and f.status = 'accepted'
    ) then 'follower'
    else 'public'
  end;
$$;
revoke all on function private.level_for(integer), private.is_friend(uuid, uuid), private.viewer_role(uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. get_profile(username): identity, counts, level, follow state, per role
--    Returns null when the profile does not exist or either side blocked.
-- ─────────────────────────────────────────────────────────────────────────
create function public.get_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_id uuid;
  v_role text;
  v_p record;
  v_stubs integer;
  v_pursuits integer;
  v_friends integer;
  v_lvl record;
  v_next_min integer;
  v_follow text;
  v_followed_by boolean;
  v_closed boolean;
  v_out jsonb;
  v_mutual jsonb;
  v_paused boolean;
begin
  v_id := (select p.id from public.profiles p
            where (p.id::text = p_username or lower(p.username) = lower(p_username))
              and p.paused_at is null and p.deletion_requested_at is null);
  if v_id is null then
    return null;
  end if;
  v_role := private.viewer_role(v_viewer, v_id);
  if v_role = 'blocked' then
    return null;
  end if;

  select p.username, p.display_name, p.avatar_url, p.neighborhood, p.bio, p.is_private, p.planning_paused
    into v_p from public.profiles p where p.id = v_id;
  v_closed := v_p.is_private and v_role in ('public');

  v_stubs := (select count(*) from public.stubs s where s.user_id = v_id and s.kind = 'session');
  select l.idx, l.name into v_lvl from private.level_for(v_stubs) l;

  v_follow := coalesce((select f.status from public.profile_follows f
                         where f.follower_id = v_viewer and f.followed_id = v_id), 'none');

  v_out := jsonb_build_object(
    'role', v_role,
    'id', v_id,
    'username', v_p.username,
    'displayName', v_p.display_name,
    'avatarUrl', v_p.avatar_url,
    'followState', v_follow
  );

  if v_closed then
    return v_out || jsonb_build_object('private', true, 'levelName', v_lvl.name);
  end if;

  v_pursuits := (select count(*) from public.pursuits pu
                  where pu.user_id = v_id and pu.archived_at is null
                    and (v_role = 'owner' or pu.shared));
  v_friends := (select count(*) from public.profile_follows f
                 where f.followed_id = v_id and f.status = 'accepted'
                   and exists (select 1 from public.profile_follows g
                                where g.follower_id = v_id and g.followed_id = f.follower_id
                                  and g.status = 'accepted'));

  v_out := v_out || jsonb_build_object(
    'private', false,
    'neighborhood', v_p.neighborhood,
    'bio', v_p.bio,
    'stubCount', v_stubs,
    'pursuitCount', v_pursuits,
    'friendCount', v_friends,
    'level', jsonb_build_object('index', v_lvl.idx, 'name', v_lvl.name)
  );

  if v_role = 'owner' then
    v_next_min := (select l.min_stubs from (values (2, 1), (3, 3), (4, 7), (5, 10), (6, 20), (7, 35), (8, 50)) as l (idx, min_stubs)
                    where l.idx = v_lvl.idx + 1);
    v_out := v_out || jsonb_build_object(
      'stubsToNext', case when v_next_min is null then null else v_next_min - v_stubs end,
      'planningPaused', v_p.planning_paused,
      'isPrivate', v_p.is_private
    );
  end if;

  if v_role in ('friend', 'follower', 'public') then
    v_followed_by := exists (select 1 from public.profile_follows f
                              where f.follower_id = v_id and f.followed_id = v_viewer and f.status = 'accepted');
    v_out := v_out || jsonb_build_object('followsYou', v_followed_by);
  end if;

  if v_role = 'friend' then
    v_out := v_out || jsonb_build_object('planningPaused', v_p.planning_paused);
  end if;

  if v_role in ('friend', 'follower') then
    -- Mutual friends: people who are friends with both of you.
    v_mutual := coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', left(m.display_name, 60), 'avatarUrl', m.avatar_url) order by m.display_name)
        from public.profiles m
       where m.id <> v_viewer and m.id <> v_id
         and private.is_friend(m.id, v_viewer) and private.is_friend(m.id, v_id)
         and not private.is_blocked_between(m.id, v_viewer)
    ), '[]'::jsonb);
    if v_role = 'friend' then
      v_out := v_out || jsonb_build_object('mutualFriends', v_mutual, 'mutualFriendCount', jsonb_array_length(v_mutual));
    else
      v_out := v_out || jsonb_build_object('mutualFriendCount', jsonb_array_length(v_mutual));
    end if;
  end if;

  if v_role = 'friend' then
    -- Categories both of you have a Pursuit in, as plain names.
    v_out := v_out || jsonb_build_object('sharedCategories', coalesce((
      select jsonb_agg(distinct a.cat order by a.cat) from (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_id and pu.archived_at is null
      ) a
      join (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_viewer and pu.archived_at is null
      ) b on lower(b.cat) = lower(a.cat)
      where a.cat is not null
    ), '[]'::jsonb));
  end if;

  return v_out;
end;
$$;
revoke all on function public.get_profile(text) from public;
grant execute on function public.get_profile(text) to anon, authenticated;

-- A link made before usernames existed carries a display name. Returns the one
-- username it belongs to, or null when nobody or more than one person has that
-- name, or when either side blocked the other. Usernames are public already.
create function public.resolve_profile_handle(p_handle text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then max(p.username) else null end
    from public.profiles p
   where lower(p.display_name) = lower(btrim(p_handle))
     and p.paused_at is null and p.deletion_requested_at is null
     and not (auth.uid() is not null and private.is_blocked_between(auth.uid(), p.id));
$$;
revoke all on function public.resolve_profile_handle(text) from public;
grant execute on function public.resolve_profile_handle(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Moments, Stubs and Pursuits lists, per role
-- ─────────────────────────────────────────────────────────────────────────
create function private.can_read_lists(p_viewer uuid, p_profile uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.viewer_role(p_viewer, p_profile) = 'blocked' then null
    when private.viewer_role(p_viewer, p_profile) = 'owner' then 'owner'
    when (select p.is_private from public.profiles p where p.id = p_profile)
         and private.viewer_role(p_viewer, p_profile) = 'public' then null
    else private.viewer_role(p_viewer, p_profile)
  end;
$$;
revoke all on function private.can_read_lists(uuid, uuid) from public, anon, authenticated;

create function public.get_profile_moments(p_profile uuid, p_limit integer default 60, p_offset integer default 0, p_pursuit text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.can_read_lists(auth.uid(), p_profile);
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_total integer;
  v_items jsonb;
begin
  if v_role is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  v_total := (select count(*) from public.posts po
               where po.user_id = p_profile and po.visibility = 'public'
                 and (p_pursuit is null or po.pursuit_id = p_pursuit)
                 and (v_role = 'owner' or (coalesce(po.visible_at, po.created_at) <= now()
                       and (po.audience is null or po.audience = 'everyone'
                            or (po.audience = 'friends' and v_role = 'friend')))));

  if v_role = 'owner' then
    v_items := coalesce((
      select jsonb_agg(x.j order by x.occ desc) from (
        select coalesce(pp.occurred_at, po.created_at) as occ,
               jsonb_build_object(
                 'id', po.id, 'photoUrl', po.media_url, 'caption', left(po.caption, 200),
                 'category', coalesce(nullif(po.sub_hobby, ''), nullif(po.interest, '')),
                 'occurredAt', coalesce(pp.occurred_at, po.created_at),
                 'placeName', pp.place_name, 'neighborhood', po.neighborhood,
                 'visibleAt', case when po.visible_at > now() then po.visible_at else null end
               ) as j
          from public.posts po
          left join public.post_private pp on pp.post_id = po.id
         where po.user_id = p_profile and po.visibility = 'public'
           and (p_pursuit is null or po.pursuit_id = p_pursuit)
         order by coalesce(pp.occurred_at, po.created_at) desc
         limit v_limit offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb);
  else
    v_items := coalesce((
      select jsonb_agg(x.j order by x.occ desc) from (
        select coalesce(pp.occurred_at, po.created_at) as occ,
               jsonb_build_object(
                 'id', po.id, 'photoUrl', po.media_url, 'caption', left(po.caption, 200),
                 'category', coalesce(nullif(po.sub_hobby, ''), nullif(po.interest, '')),
                 'date', to_char(coalesce(pp.occurred_at, po.created_at) at time zone 'UTC', 'YYYY-MM-DD'),
                 'neighborhood', po.neighborhood
               ) as j
          from public.posts po
          left join public.post_private pp on pp.post_id = po.id
         where po.user_id = p_profile and po.visibility = 'public'
           and (p_pursuit is null or po.pursuit_id = p_pursuit)
           and coalesce(po.visible_at, po.created_at) <= now()
           and (po.audience is null or po.audience = 'everyone' or (po.audience = 'friends' and v_role = 'friend'))
         order by coalesce(pp.occurred_at, po.created_at) desc
         limit v_limit offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb);
  end if;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;
revoke all on function public.get_profile_moments(uuid, integer, integer, text) from public;
grant execute on function public.get_profile_moments(uuid, integer, integer, text) to anon, authenticated;

create function public.get_profile_stubs(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.can_read_lists(auth.uid(), p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'date', case when v_role = 'owner' then s.issued_at else null end,
             'day', to_char(coalesce(pp.occurred_at, po.created_at) at time zone 'UTC', 'YYYY-MM-DD'),
             'title', left(coalesce(nullif(po.caption, ''), nullif(po.sub_hobby, ''), nullif(po.interest, '')), 120),
             'category', coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''))
           ) order by s.issued_at desc)
      from public.stubs s
      join public.posts po on po.id = s.post_id
      left join public.post_private pp on pp.post_id = po.id
      left join public.pursuits pu on pu.id = s.pursuit_id
     where s.user_id = p_profile and s.kind = 'session'
       and (v_role = 'owner' or (coalesce(po.visible_at, po.created_at) <= now() and po.visibility = 'public'
            and (po.audience is null or po.audience = 'everyone' or (po.audience = 'friends' and v_role = 'friend'))))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_stubs(uuid) from public;
grant execute on function public.get_profile_stubs(uuid) to anon, authenticated;

create function public.get_profile_pursuits(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_role text := private.can_read_lists(v_viewer, p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.sort_at desc) from (
      select coalesce(pu.finished_at, pu.started_at) as sort_at,
             jsonb_build_object(
               'id', pu.id,
               'category', coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''), 'Something new'),
               'goal', left(pu.title, 60),
               'target', pu.target_moments,
               'momentCount', (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = p_profile
                                and (v_role = 'owner' or coalesce(po.visible_at, po.created_at) <= now())),
               'stubCount', (select count(*) from public.stubs s where s.pursuit_id = pu.id and s.kind = 'session'),
               'finished', pu.finished_at is not null,
               'archived', pu.archived_at is not null,
               'lastMomentDate', case when v_role = 'owner' then
                   (select max(coalesce(pp.occurred_at, po.created_at)) from public.posts po left join public.post_private pp on pp.post_id = po.id where po.pursuit_id = pu.id) else null end,
               'finishedAt', case when pu.finished_at is null then null
                                  when v_role = 'owner' then to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM-DD')
                                  else to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM') end,
               'sharedWithYou', v_role = 'friend' and exists (
                   select 1 from public.pursuits mine
                    where mine.user_id = v_viewer and mine.archived_at is null
                      and lower(coalesce(nullif(mine.sub_hobby, ''), nullif(mine.interest, ''))) =
                          lower(coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''))))
             ) as j
        from public.pursuits pu
       where pu.user_id = p_profile
         and (v_role = 'owner' or (pu.shared and pu.archived_at is null))
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_pursuits(uuid) from public;
grant execute on function public.get_profile_pursuits(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Owner writes: profile fields, Pursuits, planning
-- ─────────────────────────────────────────────────────────────────────────
create function public.set_planning_paused(p_paused boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set planning_paused = coalesce(p_paused, false) where p.id = auth.uid();
$$;

create function public.update_profile_details(p_neighborhood text, p_bio text, p_is_private boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You’re not logged in.';
  end if;
  update public.profiles p
     set neighborhood = nullif(btrim(left(p_neighborhood, 80)), ''),
         bio = nullif(btrim(left(p_bio, 120)), ''),
         is_private = coalesce(p_is_private, p.is_private)
   where p.id = auth.uid();
end;
$$;

create function public.create_profile_pursuit(p_category text, p_goal text, p_target integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := gen_random_uuid()::text;
begin
  if auth.uid() is null then
    raise exception 'You’re not logged in.';
  end if;
  if btrim(coalesce(p_category, '')) = '' then
    raise exception 'Pick a category.';
  end if;
  insert into public.pursuits (id, user_id, title, sub_hobby, target_moments, visibility, shared)
  values (v_id, auth.uid(), left(btrim(coalesce(nullif(p_goal, ''), p_category)), 60),
          left(btrim(p_category), 60), p_target, 'friends', true);
  return v_id;
end;
$$;

create function public.set_pursuit_finished(p_id text, p_finished boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pursuits pu
     set finished_at = case when p_finished then coalesce(pu.finished_at, now()) else null end,
         updated_at = now()
   where pu.id = p_id and pu.user_id = auth.uid();
  if not found then
    raise exception 'That Pursuit isn’t yours.';
  end if;
end;
$$;

create function public.set_pursuit_archived(p_id text, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pursuits pu
     set archived_at = case when p_archived then coalesce(pu.archived_at, now()) else null end,
         updated_at = now()
   where pu.id = p_id and pu.user_id = auth.uid();
  if not found then
    raise exception 'That Pursuit isn’t yours.';
  end if;
end;
$$;

-- Its Moments stay (posts.pursuit_id goes null); its Stubs go with it.
create function public.delete_profile_pursuit(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pursuits pu where pu.id = p_id and pu.user_id = auth.uid();
  if not found then
    raise exception 'That Pursuit isn’t yours.';
  end if;
end;
$$;

create function public.get_my_planning()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'availability', coalesce(pp.availability, '[]'::jsonb),
    'freeHoursPerWeek', pp.free_hours_per_week,
    'monthlyBudgetCents', pp.monthly_budget_cents,
    'memberships', coalesce(pp.memberships, '[]'::jsonb),
    'shareMembershipsWithFriends', coalesce(pp.share_memberships_with_friends, true),
    'calendarConnected', coalesce(pp.calendar_connected, false),
    'planningPaused', (select p.planning_paused from public.profiles p where p.id = auth.uid())
  )
  from (select auth.uid() as uid) me
  left join public.planning_prefs pp on pp.user_id = me.uid
  where me.uid is not null;
$$;

create function public.set_my_planning(
  p_availability jsonb, p_free_hours integer, p_budget_cents integer,
  p_memberships jsonb, p_share_memberships boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block jsonb;
begin
  if auth.uid() is null then
    raise exception 'You’re not logged in.';
  end if;
  for v_block in select e from jsonb_array_elements(coalesce(p_availability, '[]'::jsonb)) e loop
    if v_block ->> 'day' not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
       or v_block ->> 'part' not in ('morning', 'afternoon', 'evening') then
      raise exception 'That availability isn’t valid.';
    end if;
  end loop;
  insert into public.planning_prefs as pp
    (user_id, availability, free_hours_per_week, monthly_budget_cents, memberships, share_memberships_with_friends, updated_at)
  values (auth.uid(),
          (select coalesce(jsonb_agg(distinct jsonb_build_object('day', e ->> 'day', 'part', e ->> 'part')), '[]'::jsonb)
             from jsonb_array_elements(coalesce(p_availability, '[]'::jsonb)) e),
          p_free_hours, p_budget_cents, coalesce(p_memberships, '[]'::jsonb), coalesce(p_share_memberships, true), now())
  on conflict (user_id) do update
    set availability = excluded.availability,
        free_hours_per_week = excluded.free_hours_per_week,
        monthly_budget_cents = excluded.monthly_budget_cents,
        memberships = excluded.memberships,
        share_memberships_with_friends = excluded.share_memberships_with_friends,
        updated_at = now();
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Plan together
-- ─────────────────────────────────────────────────────────────────────────
-- Shared slots over the next 14 days, soonest first, at most 3.
create function private.shared_slots(p_a jsonb, p_b jsonb, p_from date)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('date', s.d, 'part', s.part) order by s.d, s.ord), '[]'::jsonb)
    from (
      select to_char(g.d, 'YYYY-MM-DD') as d, parts.part, parts.ord
        from generate_series(p_from, p_from + 13, interval '1 day') as g (d)
        cross join (values ('morning', 1), ('afternoon', 2), ('evening', 3)) as parts (part, ord)
       where exists (select 1 from jsonb_array_elements(p_a) x
                      where x ->> 'day' = lower(to_char(g.d, 'dy')) and x ->> 'part' = parts.part)
         and exists (select 1 from jsonb_array_elements(p_b) y
                      where y ->> 'day' = lower(to_char(g.d, 'dy')) and y ->> 'part' = parts.part)
       order by g.d, parts.ord
       limit 3
    ) s;
$$;
revoke all on function private.shared_slots(jsonb, jsonb, date) from public, anon, authenticated;

create function public.suggest_plan(p_friend_id uuid, p_category text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_mine record;
  v_theirs record;
  v_paused_me boolean;
  v_paused_them boolean;
  v_recent integer;
  v_slots jsonb;
  v_cats jsonb;
  v_place jsonb := null;
  v_name text;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'You’re not logged in.';
  end if;
  if p_friend_id is null or p_friend_id = v_me
     or private.is_blocked_between(v_me, p_friend_id)
     or not private.is_friend(v_me, p_friend_id) then
    raise exception 'You can only plan with a friend.' using errcode = '42501';
  end if;

  v_paused_me := (select p.planning_paused from public.profiles p where p.id = v_me);
  v_paused_them := (select p.planning_paused from public.profiles p where p.id = p_friend_id);
  if v_paused_me or v_paused_them then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- Pair limit: 10 calls per pair per 24 hours, either direction. Past it, the
  -- last result is returned as it was.
  v_recent := (select count(*) from public.plan_suggestions ps
                where ((ps.user_id = v_me and ps.friend_id = p_friend_id)
                    or (ps.user_id = p_friend_id and ps.friend_id = v_me))
                  and ps.created_at > now() - interval '24 hours');
  if v_recent >= 10 then
    v_result := (select ps.result from public.plan_suggestions ps
                  where (ps.user_id = v_me and ps.friend_id = p_friend_id)
                     or (ps.user_id = p_friend_id and ps.friend_id = v_me)
                  order by ps.created_at desc limit 1);
    return v_result;
  end if;

  select pp.availability, pp.memberships into v_mine from public.planning_prefs pp where pp.user_id = v_me;
  select pp.availability, pp.memberships, pp.share_memberships_with_friends
    into v_theirs from public.planning_prefs pp where pp.user_id = p_friend_id;

  v_slots := private.shared_slots(coalesce(v_mine.availability, '[]'::jsonb),
                                  coalesce(v_theirs.availability, '[]'::jsonb), current_date);

  v_cats := coalesce((
    select jsonb_agg(distinct a.cat order by a.cat) from (
      select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
        from public.pursuits pu where pu.user_id = v_me and pu.archived_at is null
    ) a
    join (
      select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
        from public.pursuits pu where pu.user_id = p_friend_id and pu.archived_at is null
    ) b on lower(b.cat) = lower(a.cat)
    where a.cat is not null
  ), '[]'::jsonb) || to_jsonb('Something new'::text);

  -- Place: a membership name both have, else the friend's (only if they share
  -- membership names) matching the chosen category.
  v_name := (select m1 ->> 'name'
               from jsonb_array_elements(coalesce(v_mine.memberships, '[]'::jsonb)) m1
               join jsonb_array_elements(case when coalesce(v_theirs.share_memberships_with_friends, true)
                                              then coalesce(v_theirs.memberships, '[]'::jsonb) else '[]'::jsonb end) m2
                 on lower(m1 ->> 'name') = lower(m2 ->> 'name')
              limit 1);
  if v_name is not null then
    v_place := jsonb_build_object('name', left(v_name, 80), 'note', 'You both have memberships here');
  elsif p_category is not null and coalesce(v_theirs.share_memberships_with_friends, true) then
    v_name := (select m ->> 'name'
                 from jsonb_array_elements(coalesce(v_theirs.memberships, '[]'::jsonb)) m
                where lower(m ->> 'name') like '%' || lower(left(p_category, 40)) || '%'
                limit 1);
    if v_name is not null then
      v_place := jsonb_build_object(
        'name', left(v_name, 80),
        'note', left((select p.display_name from public.profiles p where p.id = p_friend_id), 60) || ' is a member');
    end if;
  end if;

  v_result := jsonb_build_object('status', 'ok', 'slots', v_slots, 'categories', v_cats)
              || case when v_place is null then '{}'::jsonb else jsonb_build_object('place', v_place) end;

  insert into public.plan_suggestions (user_id, friend_id, result) values (v_me, p_friend_id, v_result);
  return v_result;
end;
$$;

-- A plan the creator sends. Notification body names only the creator and place.
create function public.send_plan_invite(
  p_friend_id uuid, p_category text, p_date date, p_part text, p_place text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_when text;
begin
  if v_me is null then
    raise exception 'You’re not logged in.';
  end if;
  if p_friend_id is null or p_friend_id = v_me
     or private.is_blocked_between(v_me, p_friend_id)
     or not private.is_friend(v_me, p_friend_id) then
    raise exception 'You can only plan with a friend.' using errcode = '42501';
  end if;
  if (select p.planning_paused from public.profiles p where p.id in (v_me, p_friend_id) and p.planning_paused limit 1) then
    raise exception 'Planning is paused.' using errcode = '42501';
  end if;
  insert into public.plans (id, creator_id, invitee_id, category, plan_date, part, place_name)
  values (v_id, v_me, p_friend_id, left(p_category, 60), p_date, p_part, left(p_place, 80));

  v_when := case when p_date is null then 'an open invite'
                 else to_char(p_date, 'Mon FMDD') || ' ' || p_part end;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (p_friend_id, 'plan_invite',
          left(left((select p.display_name from public.profiles p where p.id = v_me), 60)
               || ' sent you a plan: ' || coalesce(nullif(left(p_category, 60), ''), 'Something new')
               || ', ' || v_when || '.', 300),
          '/inbox', null);
  return v_id;
end;
$$;

revoke all on function
  public.set_planning_paused(boolean), public.update_profile_details(text, text, boolean),
  public.create_profile_pursuit(text, text, integer), public.set_pursuit_finished(text, boolean),
  public.set_pursuit_archived(text, boolean), public.delete_profile_pursuit(text),
  public.get_my_planning(), public.set_my_planning(jsonb, integer, integer, jsonb, boolean),
  public.suggest_plan(uuid, text), public.send_plan_invite(uuid, text, date, text, text)
  from public, anon;
grant execute on function
  public.set_planning_paused(boolean), public.update_profile_details(text, text, boolean),
  public.create_profile_pursuit(text, text, integer), public.set_pursuit_finished(text, boolean),
  public.set_pursuit_archived(text, boolean), public.delete_profile_pursuit(text),
  public.get_my_planning(), public.set_my_planning(jsonb, integer, integer, jsonb, boolean),
  public.suggest_plan(uuid, text), public.send_plan_invite(uuid, text, date, text, text)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. New notification kind: plan_invite (new migration, never an edit)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kind = 'save' then
    if coalesce(current_setting('soosh.save_notice', true), '') <> 'on' then
      raise exception 'Not a recognized notification kind: %', new.kind;
    end if;
    new.actor_id := null;
    new.actor_name := null;
  else
    new.actor_id := auth.uid();
  end if;

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love', 'save', 'plan_invite'
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

  new.target_post_id := null;
  new.target_pursuit_id := null;

  declare
    v_post_text text;
    v_post_id bigint;
    v_pursuit_id text;
  begin
    v_post_text := substring(new.href from '^/moment/(\d+)');
    if v_post_text is not null and char_length(v_post_text) <= 18 then
      v_post_id := v_post_text::bigint;
      if exists (select 1 from public.posts where public.posts.id = v_post_id) then
        new.target_post_id := v_post_id;
      end if;
    end if;

    v_pursuit_id := substring(new.href from '^/pursuit/([^/?]+)');
    if v_pursuit_id is not null
       and exists (select 1 from public.pursuits where public.pursuits.id = v_pursuit_id) then
      new.target_pursuit_id := v_pursuit_id;
    end if;
  end;

  return new;
end;
$function$;
