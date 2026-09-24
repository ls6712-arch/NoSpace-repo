-- Rollback for 20260926020000_fix_deletion_expiry.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores respond_to_deletion_request's expired branch to the
-- 20260926010000 version (a bare RAISE EXCEPTION, no UPDATE) — the
-- Option-B fix this migration superseded. Not a recommendation: rolling
-- this back reintroduces the "expired request stays pending forever
-- unless something else re-sweeps it" gap.
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
