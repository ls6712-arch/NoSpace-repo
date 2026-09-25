-- Rollback for 20261001000000_spaces_rework_join_notifications.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores enforce_notification_insert to its pre-fix allowed-kinds list
-- (verbatim 20260929000000, without the four new kinds) and
-- request_or_join_space/approve_join_request/decline_join_request/
-- invite_host to their bodies before this migration — no notification
-- writes.
--
-- Not a recommendation: rolling this back reintroduces the gap this
-- migration closes (a host never finds out a Closed-Space request is
-- waiting short of checking the Manage tab themselves; a requester or
-- invitee never finds out what happened to them at all).

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
    'space_event_cancelled'
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
    return 'pending';
  end if;
end;
$$;
revoke all on function public.request_or_join_space(uuid, jsonb) from public, anon;
grant execute on function public.request_or_join_space(uuid, jsonb) to authenticated;

create or replace function public.approve_join_request(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int;
  v_active_count int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);
  select member_cap into v_cap from spaces where spaces.id = p_space_id;
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
end;
$$;
revoke all on function public.approve_join_request(uuid, uuid) from public, anon;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

create or replace function public.decline_join_request(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  delete from space_members where space_id = p_space_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'No pending request for that person.';
  end if;
  delete from space_join_requests where space_id = p_space_id and user_id = p_user_id;
end;
$$;
revoke all on function public.decline_join_request(uuid, uuid) from public, anon;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;

create or replace function public.invite_host(p_space_id uuid, p_invited_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_hosts int;
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
end;
$$;
revoke all on function public.invite_host(uuid, uuid) from public, anon;
grant execute on function public.invite_host(uuid, uuid) to authenticated;
