-- Sushii: Spaces Rework — respond_to_deletion_request's expired branch
-- returns 'expired' instead of raising, so the cancellation actually
-- persists.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260926011000_fix_set_null_fk_columns.sql.
--
-- Already run directly against production, found by actually running
-- 20260924000000 20260926000000's own verification script
-- (phase4_hosts_and_deletion_check.sql): 22/23 checks passed, check 8
-- failed. This migration brings the repo's migration history back in
-- sync with that.
--
-- 20260926010000_phase4_followup_active_space_checks.sql already removed
-- the dead UPDATE from this branch (UPDATE immediately followed by
-- RAISE EXCEPTION rolls the UPDATE back with it, so the cancellation
-- never persisted) and left a bare RAISE EXCEPTION in its place —
-- correct as far as it went, but it meant the request stayed 'pending'
-- forever unless something else independently re-swept it (which nothing
-- does for THIS specific call path — only request_space_deletion's own
-- lazy-expire step does, and only when a NEW request is started).
--
-- Superseding that with a genuine fix instead: the expired branch now
-- performs the UPDATE and returns 'expired' rather than raising, so the
-- cancellation actually commits as part of a normal, successful function
-- return. This changes respond_to_deletion_request's return contract —
-- 'expired' joins 'deleted' / 'cancelled' / 'pending' as a possible
-- result, not just an exception path. The Phase 5 UI must handle an
-- 'expired' return the same way it already needs to handle the other
-- three.
--
-- Safe to re-run: create-or-replace.
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
    return 'expired';
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
-- Re-run supabase/verification/phase4_hosts_and_deletion_check.sql in
-- full — check 7 (previously expecting a raised exception) now expects
-- the request's response to equal 'expired', and check 8 (the request is
-- actually cancelled) should now genuinely pass rather than failing on
-- the rollback this migration fixes.
