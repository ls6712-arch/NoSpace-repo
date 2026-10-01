-- Step 4a · The first response (in-app)
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261011000000_pending_cannot_join_pursuit_link.sql.
--
-- What this adds
--   1. 'first_moment' — when an invited person adds their first moment
--      that their inviter can see (public or followers; invite claim
--      already makes the two follow each other both ways), the inviter
--      gets one notification: "Maya added their first moment." The bell
--      shows a "Welcome to Soosh" button on it that opens the moment with
--      the reply box ready. Once per invitee, ever.
--   2. 'love' — Love this on your moment now notifies you, at most one
--      notification per moment per 24 hours. Later loves inside that
--      window update the same row ("Maya and 2 others loved your
--      moment.") and mark it unread again, rather than adding rows.
--   3. admin_first_moments_waiting() — the team's backup queue: every
--      new person's first moment from the last 14 days that has no written
--      thought from anyone else yet, oldest first.
--
-- Definitions match the Step 0 metrics ("first response = the first
-- WRITTEN thought by someone else; reactions don't count"), computed
-- directly from posts/thoughts here rather than through the metrics views,
-- so this doesn't depend on those views' live shape.
--
-- Neither trigger can block the insert that fires it: a notification
-- failure raises a warning and the moment / reaction is saved anyway.
--
-- enforce_notification_insert is reproduced verbatim from 20261009000000
-- (the latest live definition) plus the two new kinds. Every column inside
-- every subquery is fully qualified.
--
-- Safe to re-run: create-or-replace / drop-trigger-if-exists throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. enforce_notification_insert — verbatim from 20261009000000, plus
--    'first_moment' and 'love' on the allowed list.
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
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love'
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

-- ─────────────────────────────────────────────────────────────────────────
-- 2. first_moment — after insert on posts.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_first_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter uuid;
  v_name text;
begin
  -- Only a moment the inviter can actually open.
  if new.visibility not in ('public', 'followers') then
    return new;
  end if;

  select profiles.invited_by into v_inviter
  from profiles where profiles.id = new.user_id;
  if v_inviter is null or v_inviter = new.user_id then
    return new;
  end if;

  -- Their first such moment, and only ever once per invitee.
  if exists (
    select 1 from posts
    where posts.user_id = new.user_id
      and posts.id <> new.id
      and posts.visibility in ('public', 'followers')
  ) then
    return new;
  end if;
  if exists (
    select 1 from notifications
    where notifications.user_id = v_inviter
      and notifications.kind = 'first_moment'
      and notifications.actor_id = new.user_id
  ) then
    return new;
  end if;

  v_name := coalesce(public.pursuit_person_name(new.user_id), 'Someone');

  begin
    insert into notifications (user_id, kind, body, href, actor_name)
    values (
      v_inviter, 'first_moment',
      left(v_name, 60) || ' added their first moment.',
      '/moment/' || new.id,
      v_name
    );
  exception when others then
    raise warning 'notify_first_moment skipped: % %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function public.notify_first_moment() from public, anon, authenticated;

drop trigger if exists posts_notify_first_moment on public.posts;
create trigger posts_notify_first_moment
  after insert on public.posts
  for each row execute function public.notify_first_moment();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. love — after insert on reactions, one row per moment per 24 hours.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_love()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_href text;
  v_name text;
  v_existing_id bigint;
  v_since timestamptz;
  v_others int;
begin
  if new.type <> 'love' then
    return new;
  end if;

  select posts.user_id into v_owner from posts where posts.id = new.post_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  v_href := '/moment/' || new.post_id;
  v_name := coalesce(public.pursuit_person_name(new.user_id), 'Someone');

  select notifications.id, notifications.created_at
    into v_existing_id, v_since
  from notifications
  where notifications.user_id = v_owner
    and notifications.kind = 'love'
    and notifications.href = v_href
    and notifications.created_at > now() - interval '24 hours'
  order by notifications.created_at desc
  limit 1;

  begin
    if v_existing_id is null then
      -- enforce_notification_insert handles blocks and the body cap.
      insert into notifications (user_id, kind, body, href, actor_name)
      values (v_owner, 'love', left(v_name, 60) || ' loved your moment.', v_href, v_name);
    else
      -- The update path skips enforce_notification_insert, so the block
      -- rule is checked here.
      if private.is_blocked_between(new.user_id, v_owner) then
        return new;
      end if;
      select count(distinct reactions.user_id) into v_others
      from reactions
      where reactions.post_id = new.post_id
        and reactions.type = 'love'
        and reactions.created_at >= v_since
        and reactions.user_id <> v_owner
        and reactions.user_id <> new.user_id;
      update notifications
      set actor_name = v_name,
          body = left(v_name, 60) || case
            when v_others = 0 then ' loved your moment.'
            when v_others = 1 then ' and 1 other loved your moment.'
            else ' and ' || v_others || ' others loved your moment.'
          end,
          read = false
      where notifications.id = v_existing_id;
    end if;
  exception when others then
    raise warning 'notify_love skipped: % %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function public.notify_love() from public, anon, authenticated;

drop trigger if exists reactions_notify_love on public.reactions;
create trigger reactions_notify_love
  after insert on public.reactions
  for each row execute function public.notify_love();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. admin_first_moments_waiting — the team's backup queue.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_first_moments_waiting()
returns table (
  post_id bigint,
  author_id uuid,
  author_name text,
  inviter_name text,
  caption text,
  visibility text,
  posted_at timestamptz,
  hours_waiting int,
  admin_can_view boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not coalesce(private.is_admin(auth.uid()), false) then
    raise exception 'Only an admin can see this.' using errcode = '42501';
  end if;

  return query
  with firsts as (
    select distinct on (posts.user_id)
      posts.id as first_id,
      posts.user_id as first_user,
      posts.caption as first_caption,
      posts.visibility as first_visibility,
      posts.created_at as first_at
    from posts
    where posts.visibility in ('public', 'followers')
    order by posts.user_id, posts.created_at, posts.id
  )
  select
    f.first_id,
    f.first_user,
    public.pursuit_person_name(f.first_user),
    case when pr.invited_by is null then null
         else public.pursuit_person_name(pr.invited_by) end,
    left(coalesce(f.first_caption, ''), 140),
    f.first_visibility,
    f.first_at,
    floor(extract(epoch from now() - f.first_at) / 3600)::int,
    (f.first_visibility = 'public'
      or exists (
        select 1 from profile_follows
        where profile_follows.follower_id = auth.uid()
          and profile_follows.followed_id = f.first_user
          and profile_follows.status = 'accepted'
      ))
  from firsts f
  join profiles pr on pr.id = f.first_user
  where f.first_at > now() - interval '14 days'
    and coalesce(pr.is_admin, false) = false
    and not exists (
      select 1 from thoughts
      where thoughts.post_id = f.first_id
        and thoughts.user_id <> f.first_user
        and nullif(btrim(thoughts.body), '') is not null
    )
  order by f.first_at;
end;
$$;
revoke all on function public.admin_first_moments_waiting() from public, anon;
grant execute on function public.admin_first_moments_waiting() to authenticated;
