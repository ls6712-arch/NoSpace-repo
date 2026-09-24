-- Sushii: Spaces Rework Phase 4 follow-up — enforce spaces.status = 'active'
-- on every write path that creates NEW active engagement in a Space, and
-- fix a dead write in respond_to_deletion_request.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260926000000_spaces_rework_phase4_hosts_and_deletion.sql.
--
-- Found in review: read_only and deleted Spaces weren't enforced anywhere
-- outside the Space row's own read policy. People could still join, get
-- approved, accept a host invite or a host handoff, or link a Moment into
-- a Space that's read_only or even deleted — none of those write paths
-- checked spaces.status at all.
--
-- Not every mutating RPC gets this check — only ones that create NEW
-- active engagement (a new member, a new host, a new linked Moment).
-- Teardown/moderation actions (leaving, cancelling or declining a
-- request, unlinking your own Moment, banning or removing a member,
-- demoting a host, deleting the Space itself) are deliberately left
-- alone: blocking those on a degraded Space would trap people in it
-- rather than let them get out or clean it up. request_or_join_space
-- already checked (`where id = p_space_id and status = 'active'` in its
-- own initial fetch) — confirmed by reading it, not touched here.
--
-- Admins are excepted throughout (private.is_admin(auth.uid())), so
-- moderation/support work isn't blocked by the same check.
--
-- Every column inside every subquery below is fully qualified, same
-- discipline as the rest of this phase.
--
-- Safe to re-run: create-or-replace throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Shared helper — raises unless the Space is active or the caller is
--    an admin. Used by every gated function below.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.assert_space_active(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin(auth.uid()) then
    return;
  end if;
  if not exists (
    select 1 from spaces where spaces.id = p_space_id and spaces.status = 'active'
  ) then
    raise exception 'This Space isn''t active.';
  end if;
end;
$$;
revoke all on function public.assert_space_active(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Gate the functions that create new active engagement.
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
  perform public.assert_space_active(p_space_id);
  select member_cap into v_cap from spaces where spaces.id = p_space_id;
  select count(*) into v_active_count from space_members
  where space_members.space_id = p_space_id and space_members.status = 'active';
  if v_cap is not null and v_active_count >= v_cap then
    raise exception 'This Space is full.';
  end if;
  update space_members set status = 'active'
  where space_members.space_id = p_space_id and space_members.user_id = p_user_id and space_members.status = 'banned';
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
  where space_host_invites.id = p_invite_id and space_host_invites.invited_user_id = auth.uid() and space_host_invites.status = 'invited';
  if v_invite.id is null then
    raise exception 'No pending invite found.';
  end if;
  perform public.assert_space_active(v_invite.space_id);
  select count(*) into v_active_hosts from space_members
  where space_members.space_id = v_invite.space_id and space_members.role = 'host' and space_members.status = 'active';
  if v_active_hosts >= 5 then
    raise exception 'A Space can have at most 5 hosts.';
  end if;
  update space_host_invites set status = 'accepted', responded_at = now()
  where space_host_invites.id = p_invite_id;
  update space_members set role = 'host'
  where space_members.space_id = v_invite.space_id and space_members.user_id = auth.uid() and space_members.status = 'active';
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
  perform public.assert_space_active(p_space_id);
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

-- Grants unchanged from Phase 3/4 — create or replace keeps the existing
-- REVOKE/GRANT in place, only the bodies above are new.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Gate linking a NEW Moment into a Space. Unlinking (unlink_my_moment)
--    and the host-only feature/remove/approve UPDATE policy are
--    deliberately untouched — removing or curating existing content
--    should still work on a degraded Space.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "the poster or a host links/unlinks a moment" on public.space_moments;
create policy "the poster or a host links/unlinks a moment"
  on public.space_moments for insert to authenticated
  with check (
    public.is_space_member(space_moments.space_id, auth.uid())
    and exists (select 1 from posts p where p.id = space_moments.post_id and p.user_id = auth.uid())
    and exists (
      select 1 from spaces s
      where s.id = space_moments.space_id and (s.status = 'active' or private.is_admin(auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. respond_to_deletion_request: the lazy-expire branch's own UPDATE was
--    dead code — it ran, then the RAISE EXCEPTION immediately after it
--    unwound the whole function call, rolling the UPDATE back with it, so
--    the expiry never actually persisted. Decision: accept that this is
--    cosmetic rather than change the function's return contract (every
--    other error path in this file signals via RAISE EXCEPTION, which
--    Supabase clients surface as a catchable error — switching just this
--    one branch to a return value would be inconsistent and more complex
--    for a caller to handle correctly). request_space_deletion's own
--    lazy-expire step independently re-checks expires_at before allowing
--    a new request, so nothing functionally depends on this row's stored
--    status between real RPC calls. The only place it matters is a UI
--    reading space_deletion_requests directly — which already has to
--    treat status = 'pending' AND expires_at < now() as effectively
--    cancelled for lazy evaluation to work at all, the same requirement
--    already true of every other lazily-evaluated timeout in this phase.
--    Removed rather than left in, since a no-op UPDATE that looks like it
--    does something is worse than no UPDATE at all.
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

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select proname from pg_proc where pronamespace = 'public'::regnamespace
--   and proname = 'assert_space_active';
-- -- expect 1 row
--
-- select policyname, cmd, with_check from pg_policies
-- where tablename = 'space_moments' and policyname = 'the poster or a host links/unlinks a moment';
-- -- eyeball it: with_check should now include a spaces status/admin clause
--
-- See supabase/verification/phase4_followup_active_space_check.sql for
-- the two new checks this asked for (join and link-a-Moment attempts
-- against a read_only Space).
