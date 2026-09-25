-- Sushii: Spaces Rework — missing join/host-invite notifications.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260930000000_spaces_rework_set_space_corners.sql.
--
-- Found in review: request_or_join_space, approve_join_request,
-- decline_join_request and invite_host never wrote a notification at
-- all — the only Spaces flow that did was cancel_event/
-- execute_space_deletion (space_event_cancelled). A host had no signal a
-- request was waiting short of opening the Manage tab themselves; a
-- requester or invitee had no signal anything happened to them at all.
--
-- Four new kinds, each written inline in the RPC that causes it, same
-- pattern as cancel_event's own insert into notifications — no separate
-- helper, no trigger:
--
--   space_join_request  (request_or_join_space, Closed Spaces only) —
--     every active host, "[Name] asked to join [Space]",
--     /space/<slug>?tab=manage. No notification for an Open Space's
--     instant join — there's no request for a host to act on.
--   space_join_approved (approve_join_request) — the requester,
--     "You're in [Space]", /space/<slug>.
--   space_join_declined (decline_join_request) — the requester,
--     "Your request to join [Space] wasn't approved", no href (there's
--     nothing left for them to open).
--   space_host_invite   (invite_host) — the invitee,
--     "[Name] invited you to co-host [Space]", /space/<slug>.
--
-- Every body embeds a Space name with left(name, 150) — spaces.name is
-- capped at 80 chars by its own CHECK constraint today, but that's the
-- same margin-of-safety left(title, 200) added for event titles
-- (20260929000000): enforce_notification_insert's 300-char body cap is a
-- trigger-level invariant that shouldn't depend on a separate table's
-- CHECK constraint never changing out from under it.
--
-- Found in review (before this migration ever ran): request_or_join_space
-- and invite_host both embed the acting user's display name in the body
-- uncapped — profiles.display_name has no length constraint of its own,
-- so a long enough one would push the body over enforce_notification_
-- insert's 300-char cap and fail the whole RPC (a long-named person
-- literally couldn't request to join a Space). Both now wrap it in
-- left(coalesce(v_actor_name, 'Someone'), 60); the actor_name column
-- itself (separate from the body text) is left uncapped, same as
-- everywhere else — this is purely about what gets concatenated into the
-- 300-char-limited body. cancel_event has the identical shape (actor name
-- + title in one body) and gets the same fix here, redefined again from
-- its 20260929000000 body — that migration already ran live, so this is
-- a new redefinition, not an edit to it.
--
-- enforce_notification_insert gets all four kinds added to its
-- allowed-kinds list — reproduced verbatim from 20260929000000 (which
-- was itself the verbatim live definition) plus this addition, same
-- discipline as that migration used for space_event_cancelled.
--
-- Every column inside every subquery is fully qualified throughout, same
-- discipline as every migration since the Phase 3 lesson.
--
-- Safe to re-run: functions are create-or-replace throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. enforce_notification_insert — verbatim from 20260929000000, plus
--    the four new kinds on the allowed list.
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
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite'
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

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. request_or_join_space — full body reproduced from 20260928000000;
--    only the Closed-Space branch gains a notification to every active
--    host. Open-Space instant joins are untouched — no notification.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.request_or_join_space(p_space_id uuid, p_join_answers jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
  v_active_count int;
  v_post_id bigint;
  v_actor_name text;
begin
  select * into v_space from spaces where spaces.id = p_space_id and spaces.status = 'active';
  if v_space.id is null then
    raise exception 'That Space doesn''t exist.';
  end if;

  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'banned') then
    raise exception 'You can''t join this Space.';
  end if;
  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'active') then
    raise exception 'You''re already a member.';
  end if;
  if exists (select 1 from space_members where space_members.space_id = p_space_id and space_members.user_id = auth.uid() and space_members.status = 'pending') then
    raise exception 'You already have a request pending.';
  end if;

  select count(*) into v_active_count from space_members where space_members.space_id = p_space_id and space_members.status = 'active';
  if v_space.member_cap is not null and v_active_count >= v_space.member_cap then
    raise exception 'This Space is full.';
  end if;

  if p_join_answers is not null and (p_join_answers->>'post_id') is not null then
    v_post_id := (p_join_answers->>'post_id')::bigint;
    if not exists (
      select 1 from posts where posts.id = v_post_id and posts.user_id = auth.uid() and posts.visibility = 'public'
    ) then
      raise exception 'That Moment isn''t yours, or isn''t public.';
    end if;
  end if;

  if v_space.access = 'open' then
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'active');
    return 'active';
  else
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'pending');
    insert into space_join_requests (space_id, user_id, answers)
    values (p_space_id, auth.uid(), p_join_answers);

    select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
      into v_actor_name from profiles where profiles.id = auth.uid();

    insert into notifications (user_id, kind, body, href, actor_name)
    select space_members.user_id, 'space_join_request',
      left(coalesce(v_actor_name, 'Someone'), 60) || ' asked to join ' || left(v_space.name, 150) || '.',
      '/space/' || v_space.slug || '?tab=manage',
      v_actor_name
    from space_members
    where space_members.space_id = p_space_id and space_members.role = 'host' and space_members.status = 'active';

    return 'pending';
  end if;
end;
$$;
revoke all on function public.request_or_join_space(uuid, jsonb) from public, anon;
grant execute on function public.request_or_join_space(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. approve_join_request — full body reproduced from
--    20260926010000_phase4_followup_active_space_checks.sql, plus a
--    notification to the now-approved requester.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.approve_join_request(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int;
  v_active_count int;
  v_space_name text;
  v_space_slug text;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);
  select spaces.member_cap, spaces.name, spaces.slug into v_cap, v_space_name, v_space_slug
  from spaces where spaces.id = p_space_id;
  select count(*) into v_active_count from space_members
  where space_members.space_id = p_space_id and space_members.status = 'active';
  if v_cap is not null and v_active_count >= v_cap then
    raise exception 'This Space is full.';
  end if;
  update space_members set status = 'active'
  where space_members.space_id = p_space_id and space_members.user_id = p_user_id and space_members.status = 'pending';
  if not found then
    raise exception 'No pending request for that person.';
  end if;
  delete from space_join_requests
  where space_join_requests.space_id = p_space_id and space_join_requests.user_id = p_user_id;

  insert into notifications (user_id, kind, body, href)
  values (p_user_id, 'space_join_approved', 'You''re in ' || left(v_space_name, 150) || '.', '/space/' || v_space_slug);
end;
$$;
revoke all on function public.approve_join_request(uuid, uuid) from public, anon;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. decline_join_request — full body reproduced from
--    20260925000000_spaces_rework_phase3_membership.sql (never redefined
--    since), plus a notification to the declined requester. No
--    assert_space_active gate here, same as it never had one — declining
--    is teardown, deliberately not blocked on a degraded Space.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.decline_join_request(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_name text;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  select spaces.name into v_space_name from spaces where spaces.id = p_space_id;
  delete from space_members where space_id = p_space_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'No pending request for that person.';
  end if;
  delete from space_join_requests where space_id = p_space_id and user_id = p_user_id;

  insert into notifications (user_id, kind, body)
  values (p_user_id, 'space_join_declined', 'Your request to join ' || left(v_space_name, 150) || ' wasn''t approved.');
end;
$$;
revoke all on function public.decline_join_request(uuid, uuid) from public, anon;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. invite_host — full body reproduced from
--    20260926010000_phase4_followup_active_space_checks.sql, plus a
--    notification to the invitee.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.invite_host(p_space_id uuid, p_invited_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_hosts int;
  v_space_name text;
  v_space_slug text;
  v_actor_name text;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);
  if not public.is_space_member(p_space_id, p_invited_user_id) then
    raise exception 'They need to be a member of this Space first.';
  end if;
  select count(*) into v_active_hosts from space_members
  where space_members.space_id = p_space_id and space_members.role = 'host' and space_members.status = 'active';
  if v_active_hosts >= 5 then
    raise exception 'A Space can have at most 5 hosts.';
  end if;
  insert into space_host_invites (space_id, invited_user_id, invited_by)
  values (p_space_id, p_invited_user_id, auth.uid());

  select spaces.name, spaces.slug into v_space_name, v_space_slug from spaces where spaces.id = p_space_id;
  select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
    into v_actor_name from profiles where profiles.id = auth.uid();

  insert into notifications (user_id, kind, body, href, actor_name)
  values (
    p_invited_user_id, 'space_host_invite',
    left(coalesce(v_actor_name, 'Someone'), 60) || ' invited you to co-host ' || left(v_space_name, 150) || '.',
    '/space/' || v_space_slug, v_actor_name
  );
end;
$$;
revoke all on function public.invite_host(uuid, uuid) from public, anon;
grant execute on function public.invite_host(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. cancel_event — full body reproduced from 20260929000000 (already
--    live), with the same left(actor name, 60) cap applied to its body
--    (actor name + event title, the same two-uncapped-strings shape as
--    request_or_join_space/invite_host above). execute_space_deletion's
--    own notification never embeds an actor name (href/actor_name are
--    both null there) so it's untouched and not redefined here.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_actor_name text;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not (
    public.is_space_host(v_event.space_id, auth.uid())
    or (v_event.created_by = auth.uid() and public.is_space_member(v_event.space_id, auth.uid()))
  ) then
    raise exception 'Only a host or this event''s creator can cancel it.';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'This event is already cancelled.';
  end if;

  update space_events set status = 'cancelled', featured = false where space_events.id = p_event_id;

  select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
    into v_actor_name from profiles where profiles.id = auth.uid();

  insert into notifications (user_id, kind, body, href, actor_name)
  select event_rsvps.user_id, 'space_event_cancelled',
    left(coalesce(v_actor_name, 'Someone'), 60) || ' cancelled ' || left(v_event.title, 200) || '.',
    '/space/' || (select spaces.slug from spaces where spaces.id = v_event.space_id) || '?tab=events',
    v_actor_name
  from event_rsvps
  where event_rsvps.event_id = p_event_id;
end;
$$;
revoke all on function public.cancel_event(bigint) from public, anon;
grant execute on function public.cancel_event(bigint) to authenticated;
