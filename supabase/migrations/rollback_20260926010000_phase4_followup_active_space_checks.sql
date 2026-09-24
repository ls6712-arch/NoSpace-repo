-- Rollback for 20260926010000_phase4_followup_active_space_checks.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores each function/policy to its exact pre-follow-up text (the
-- versions from 20260924110000/20260925000000/20260926000000) and drops
-- assert_space_active. Purely a function-body/policy rollback — no data
-- to restore.
--
-- Not a recommendation: rolling this back reopens the gap it closed
-- (read_only/deleted Spaces accepting new joins, approvals, host
-- invites/handoffs, and Moment links) and reintroduces
-- respond_to_deletion_request's dead UPDATE. There's no legitimate
-- reason to run this outside of historical reference.

drop function if exists public.assert_space_active(uuid);

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
  select member_cap into v_cap from spaces where id = p_space_id;
  select count(*) into v_active_count from space_members where space_id = p_space_id and status = 'active';
  if v_cap is not null and v_active_count >= v_cap then
    raise exception 'This Space is full.';
  end if;
  update space_members set status = 'active' where space_id = p_space_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'No pending request for that person.';
  end if;
  delete from space_join_requests where space_id = p_space_id and user_id = p_user_id;
end;
$$;

create or replace function public.unban_member(p_space_id uuid, p_user_id uuid)
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
  select member_cap into v_cap from spaces where id = p_space_id;
  select count(*) into v_active_count from space_members where space_id = p_space_id and status = 'active';
  if v_cap is not null and v_active_count >= v_cap then
    raise exception 'This Space is full.';
  end if;
  update space_members set status = 'active' where space_id = p_space_id and user_id = p_user_id and status = 'banned';
  if not found then
    raise exception 'That person isn''t banned.';
  end if;
end;
$$;

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
  if not public.is_space_member(p_space_id, p_invited_user_id) then
    raise exception 'They need to be a member of this Space first.';
  end if;
  select count(*) into v_active_hosts from space_members
  where space_id = p_space_id and role = 'host' and status = 'active';
  if v_active_hosts >= 5 then
    raise exception 'A Space can have at most 5 hosts.';
  end if;
  insert into space_host_invites (space_id, invited_user_id, invited_by)
  values (p_space_id, p_invited_user_id, auth.uid());
end;
$$;

create or replace function public.accept_host_invite(p_invite_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_active_hosts int;
begin
  select * into v_invite from space_host_invites
  where id = p_invite_id and invited_user_id = auth.uid() and status = 'invited';
  if v_invite.id is null then
    raise exception 'No pending invite found.';
  end if;
  select count(*) into v_active_hosts from space_members
  where space_id = v_invite.space_id and role = 'host' and status = 'active';
  if v_active_hosts >= 5 then
    raise exception 'A Space can have at most 5 hosts.';
  end if;
  update space_host_invites set status = 'accepted', responded_at = now() where id = p_invite_id;
  update space_members set role = 'host'
  where space_id = v_invite.space_id and user_id = auth.uid() and status = 'active';
end;
$$;

create or replace function public.accept_host_handoff(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
begin
  select * into v_space from spaces where spaces.id = p_space_id;
  if v_space.id is null then
    raise exception 'That Space doesn''t exist.';
  end if;
  if v_space.host_handoff_started_at is null then
    raise exception 'This Space isn''t waiting for a new host.';
  end if;
  if v_space.host_handoff_started_at + interval '14 days' < now() then
    raise exception 'This offer has expired.';
  end if;
  if exists (
    select 1 from space_members sm
    where sm.space_id = p_space_id and sm.role = 'host' and sm.status = 'active'
  ) then
    raise exception 'This Space already has a host.';
  end if;
  if not exists (
    select 1 from space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.joined_at < v_space.host_handoff_started_at
  ) then
    raise exception 'You aren''t eligible to claim hosting for this Space.';
  end if;

  update space_members set role = 'host'
  where space_members.space_id = p_space_id
    and space_members.user_id = auth.uid()
    and space_members.status = 'active';
  update spaces set host_handoff_started_at = null where spaces.id = p_space_id;
end;
$$;

drop policy if exists "the poster or a host links/unlinks a moment" on public.space_moments;
create policy "the poster or a host links/unlinks a moment"
  on public.space_moments for insert to authenticated
  with check (
    public.is_space_member(space_id, auth.uid())
    and exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

create or replace function public.respond_to_deletion_request(p_request_id bigint, p_decision text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_approval record;
  v_pending_count int;
begin
  if p_decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined.';
  end if;

  select * into v_request from space_deletion_requests where space_deletion_requests.id = p_request_id;
  if v_request.id is null then
    raise exception 'That deletion request doesn''t exist.';
  end if;

  if v_request.status = 'pending' and v_request.expires_at < now() then
    update space_deletion_requests set status = 'cancelled' where space_deletion_requests.id = p_request_id;
    raise exception 'This deletion request has expired.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This deletion request is no longer open.';
  end if;

  if not public.is_space_host(v_request.space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;

  select * into v_approval from space_deletion_approvals
  where space_deletion_approvals.deletion_request_id = p_request_id
    and space_deletion_approvals.host_user_id = auth.uid();
  if v_approval.deletion_request_id is null then
    raise exception 'You don''t have a pending approval for this request.';
  end if;
  if v_approval.decision <> 'pending' then
    raise exception 'You''ve already responded to this request.';
  end if;

  update space_deletion_approvals
  set decision = p_decision, responded_at = now()
  where space_deletion_approvals.deletion_request_id = p_request_id
    and space_deletion_approvals.host_user_id = auth.uid();

  if p_decision = 'declined' then
    update space_deletion_requests set status = 'cancelled' where space_deletion_requests.id = p_request_id;
    return 'cancelled';
  end if;

  delete from space_deletion_approvals sda
  where sda.deletion_request_id = p_request_id
    and sda.decision = 'pending'
    and not exists (
      select 1 from space_members sm
      where sm.space_id = v_request.space_id
        and sm.user_id = sda.host_user_id
        and sm.role = 'host'
        and sm.status = 'active'
    );

  select count(*) into v_pending_count
  from space_deletion_approvals
  where space_deletion_approvals.deletion_request_id = p_request_id
    and space_deletion_approvals.decision = 'pending';

  if v_pending_count = 0 then
    update space_deletion_requests set status = 'approved' where space_deletion_requests.id = p_request_id;
    perform public.execute_space_deletion(v_request.space_id);
    return 'deleted';
  end if;

  return 'pending';
end;
$$;
