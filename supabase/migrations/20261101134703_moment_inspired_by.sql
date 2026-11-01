-- Soosh: "Inspired by" (brief of Nov 1, 2026, PR 3 of 3: Start opens the activity, not the camera).
--
-- Run AFTER 20261115000000_stubs_four_kinds.sql (the enforce_notification_insert below starts from
-- that file's version, which adds 'stub_earned'; run before it, this would drop that kind) and
-- after 20261116000000_suggestion_events_start_logged.sql. Staging first.
-- Rollback: rollback_20261117000000_moment_inspired_by.sql.
-- Verification: supabase/verification/moment_inspired_by_check.sql.
--
-- A Moment logged from a Start page that was opened from someone else's Moment ("Do this", or
-- "Make this too") remembers which Moment inspired it. The author of that Moment gets one
-- notification, only if the new Moment's audience includes them. One per new Moment, never a
-- count, never "your Moment inspired 12 people".
--
--   1. posts.inspired_by (nullable post id, set once, on delete set null)
--   2. a before-insert guard: anything the poster could not see, their own Moment, or a Moment of
--      someone blocked either way, is quietly stored as null (posting never fails because of it)
--   3. private.notify_inspired(post_id), called from apply_release_effects() when the 2 hour hold
--      ends, so a Moment still held back tells nobody
--   4. the new notification kind 'inspired' in enforce_notification_insert()
--
-- Who is told ("the new Moment's audience includes them"): visibility 'public', or 'followers' when
-- the author follows the poster (accepted). Never for 'just_me' or a Pursuit group Moment, and not
-- for 'space' Moments (who sees those depends on Space links made after posting).
-- No client can write a notification directly: it is written here, by a security definer function.
-- Body: left(name, 60) and left(corner, 150) keep it far under the 300 character cap.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. The column
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts add column inspired_by bigint references public.posts (id) on delete set null;
create index posts_inspired_by_idx on public.posts (inspired_by) where inspired_by is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The guard
-- ─────────────────────────────────────────────────────────────────────────
create function private.posts_check_inspired_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Set once, when the Moment is posted. It can be cleared (the source was deleted), never changed.
    if new.inspired_by is not null and new.inspired_by is distinct from old.inspired_by then
      new.inspired_by := old.inspired_by;
    end if;
    return new;
  end if;
  if new.inspired_by is null then
    return new;
  end if;
  if not exists (
    select 1 from public.posts src
     where src.id = new.inspired_by
       and src.user_id <> new.user_id
       and coalesce(src.visible_at, src.created_at) <= now()
       and not private.is_blocked_between(src.user_id, new.user_id)
       and (
         src.visibility = 'public'
         or (
           src.visibility = 'followers'
           and exists (
             select 1 from public.profile_follows pf
              where pf.followed_id = src.user_id and pf.follower_id = new.user_id and pf.status = 'accepted'
           )
         )
       )
  ) then
    new.inspired_by := null;
  end if;
  return new;
end;
$$;
revoke all on function private.posts_check_inspired_by() from public, anon, authenticated;

create trigger posts_check_inspired_by
  before insert or update of inspired_by on public.posts
  for each row execute function private.posts_check_inspired_by();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The notice
-- ─────────────────────────────────────────────────────────────────────────
create function private.notify_inspired(p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
  v_to uuid;
  v_name text;
  v_corner text;
  v_label text;
begin
  select po.id, po.user_id, po.visibility, po.audience, po.inspired_by, po.hobby_slug,
         coalesce(po.corner, po.sub_hobby) as corner_slug
    into v_post from public.posts po where po.id = p_post_id;
  if v_post.id is null or v_post.inspired_by is null then
    return;
  end if;
  -- Only for a Moment people outside the Pursuit group and not just the author can see.
  if v_post.visibility not in ('public', 'followers') or v_post.audience = 'group' then
    return;
  end if;
  v_to := (select src.user_id from public.posts src where src.id = v_post.inspired_by);
  if v_to is null or v_to = v_post.user_id then
    return;
  end if;
  if private.is_blocked_between(v_to, v_post.user_id) then
    return;
  end if;
  if exists (select 1 from public.profiles pr where pr.id = v_post.user_id and pr.is_test) then
    return;
  end if;
  if v_post.visibility = 'followers' and not exists (
    select 1 from public.profile_follows pf
     where pf.followed_id = v_post.user_id and pf.follower_id = v_to and pf.status = 'accepted'
  ) then
    return;
  end if;
  -- One per new Moment.
  if exists (select 1 from public.notifications n where n.user_id = v_to and n.kind = 'inspired' and n.href = '/moment/' || v_post.id) then
    return;
  end if;
  v_name := coalesce(public.pursuit_person_name(v_post.user_id), 'Someone');
  v_corner := coalesce(
    (select c.name from public.corners c where c.space_slug = v_post.hobby_slug and c.slug = v_post.corner_slug),
    replace(v_post.corner_slug, '-', ' ')
  );
  if v_corner is null or btrim(v_corner) = '' then
    v_label := 'this';
  elsif v_corner ~ '.[A-Z]|&' then
    v_label := left(v_corner, 150);
  else
    v_label := lower(left(v_corner, 150));
  end if;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_to, 'inspired', left(v_name, 60) || ' tried ' || v_label || ' after seeing yours.', '/moment/' || v_post.id, v_name);
end;
$$;
revoke all on function private.notify_inspired(bigint) from public, anon, authenticated;

create or replace function private.apply_release_effects(p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
  v_inviter uuid;
  v_name text;
begin
  -- Claim the Moment: only one caller ever gets past this, so nothing fires twice.
  update public.posts po set notified_at = now()
   where po.id = p_post_id and po.notified_at is null
     and coalesce(po.visible_at, po.created_at) <= now();
  if not found then
    return;
  end if;
  select po.id, po.user_id, po.visibility, po.hobby_slug, po.corner, po.sub_hobby
    into v_post from public.posts po where po.id = p_post_id;
  if coalesce(v_post.corner, v_post.sub_hobby) is not null and v_post.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (v_post.hobby_slug, coalesce(v_post.corner, v_post.sub_hobby), coalesce(v_post.corner, v_post.sub_hobby), 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  perform private.notify_space_moment_pending(sm.space_id, sm.post_id)
     from public.space_moments sm
    where sm.post_id = p_post_id and sm.status = 'pending' and sm.removed_by_host = false;
  -- "Priya tried cooking after seeing yours": one notice for the Moment that was inspired, never a count.
  -- It can never stop a Moment from being released.
  begin
    perform private.notify_inspired(p_post_id);
  exception when others then
    raise warning 'inspired notice skipped: % %', sqlstate, sqlerrm;
  end;
  if v_post.visibility not in ('public', 'followers') then
    return;
  end if;
  v_inviter := (select pr.invited_by from public.profiles pr where pr.id = v_post.user_id);
  if v_inviter is null or v_inviter = v_post.user_id then
    return;
  end if;
  if exists (select 1 from public.posts po
              where po.user_id = v_post.user_id and po.id <> v_post.id
                and po.visibility in ('public', 'followers')) then
    return;
  end if;
  if private.is_blocked_between(v_inviter, v_post.user_id) then
    return;
  end if;
  if exists (select 1 from public.notifications n
              where n.user_id = v_inviter and n.kind = 'first_moment'
                and n.href in (select '/moment/' || po.id from public.posts po where po.user_id = v_post.user_id)) then
    return;
  end if;
  v_name := coalesce(public.pursuit_person_name(v_post.user_id), 'Someone');
  begin
    insert into public.notifications (user_id, kind, body, href, actor_name)
    values (v_inviter, 'first_moment', left(v_name, 60) || ' added their first moment.', '/moment/' || v_post.id, v_name);
  exception when others then
    raise warning 'first-moment notice skipped: % %', sqlstate, sqlerrm;
  end;
end;
$$;
revoke all on function private.apply_release_effects(bigint) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. The allowed kind
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
    'first_moment', 'love', 'save', 'plan_invite', 'stub_earned', 'inspired'
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
