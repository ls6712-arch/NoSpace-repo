-- Sushii: Spaces Rework Phase 4 — hosts and deletion.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260925010000_phase3_fix_space_moments_policy.sql.
--
-- Builds on Phase 3's space_deletion_requests/space_deletion_approvals
-- tables (schema-only until now — Phase 2 never wrote the functions that
-- actually use them) and Phase 3's leave_space/demote_host last-host rule
-- and invite_host/accept_host_invite/decline_host_invite. Not rebuilding
-- any of that here.
--
-- Every column inside every subquery below is fully qualified with its
-- table name — the Phase 3 lesson (a bare `status` inside a correlated
-- EXISTS silently bound to the wrong table's own status column, since
-- both tables had one) applies just as much to plain function bodies as
-- it does to RLS policies, so the same discipline is applied everywhere
-- in this file, not just in policies.
--
-- Safe to re-run: policy/trigger drops are idempotent, functions are
-- create-or-replace, ALTER TABLE ADD COLUMN uses IF NOT EXISTS. NOT safe
-- to re-run after real deletion requests, host handoffs, or moderation
-- queue rows exist from a first partial run in a way that matters for
-- data you want to keep — every statement here is additive/idempotent on
-- schema, but this migration doesn't re-export or back up any of that
-- data the way the Phase 2 cleanup migration did for Circles.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Deleted Spaces are unreadable to everyone but admins. Phase 2's
--    "spaces are publicly readable" policy already excluded status =
--    'deleted' from EVERYONE, admins included — this adds the admin
--    exception spec requires ("unreadable to everyone except admins").
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "spaces are publicly readable" on public.spaces;
create policy "spaces are publicly readable"
  on public.spaces for select
  using (spaces.status <> 'deleted' or private.is_admin(auth.uid()));

-- The roster (space_members) has the same gap, for a different reason:
-- rows are kept after deletion ("for history" — see section 2), and
-- Phase 3's roster policy never checked whether the parent Space itself
-- was deleted. Without this, an Open Space's kept membership rows would
-- stay visible to anyone forever, even after deletion. Own-row visibility
-- (a former member reading their own old row) is folded into the same
-- admin-or-not-deleted gate — nobody but an admin can read anything about
-- a deleted Space, full stop, matching the spec's own wording.
drop policy if exists "roster visibility follows status and the space's access" on public.space_members;
create policy "roster visibility follows status and the space's access"
  on public.space_members for select
  using (
    private.is_admin(auth.uid())
    or (
      exists (select 1 from spaces s where s.id = space_members.space_id and s.status <> 'deleted')
      and (
        space_members.user_id = auth.uid()
        or public.is_space_host(space_members.space_id, auth.uid())
        or (
          space_members.status = 'active'
          and (
            space_members.role = 'host'
            or exists (
              select 1 from spaces s2
              where s2.id = space_members.space_id
                and (s2.access = 'open' or public.is_space_member(s2.id, auth.uid()))
            )
          )
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Deletion — request / approve / decline / cancel, and the actual
--    soft-delete + cleanup once it's resolved.
-- ─────────────────────────────────────────────────────────────────────────

-- Shared by both deletion paths below (sole-host direct delete, and the
-- last approval landing on a multi-host request). Not exposed to
-- authenticated users directly — both callers have already done their own
-- authorization check before reaching this.
--
-- Soft delete: spaces.status = 'deleted', not a hard DROP — the schema
-- already anticipated this (status already has a 'deleted' value, and the
-- public SELECT policy already excluded it before this migration even
-- touched it). A hard delete would cascade away space_members/
-- space_corners too, losing exactly the history the spec asks to keep.
--
-- Cleanup, per spec: space_moments links, space_private_details, and
-- space_join_requests are deleted outright (nothing left to read even for
-- an admin — there's no "history" value in a stale exact address or a
-- resolved join request). Pending (not yet accepted/declined) host
-- invites are deleted too, so nobody can accept an invite to host a Space
-- that no longer exists. space_members rows are deliberately NOT touched
-- here — kept for history, per spec, and already hidden by section 1's
-- policy change.
create or replace function public.execute_space_deletion(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;
  delete from space_moments where space_moments.space_id = p_space_id;
  delete from space_private_details where space_private_details.space_id = p_space_id;
  delete from space_join_requests where space_join_requests.space_id = p_space_id;
  delete from space_host_invites
  where space_host_invites.space_id = p_space_id and space_host_invites.status = 'invited';
end;
$$;
revoke all on function public.execute_space_deletion(uuid) from public, anon, authenticated;

-- A sole host deletes directly (typing the Space name to confirm is a
-- client-side gate, not something this function checks). With more than
-- one active host, this opens a request and creates one pending approval
-- row per OTHER active host — the requester's own intent is already
-- expressed by calling this, so they don't get an approval row of their
-- own to answer. Only one open request per Space at a time.
create or replace function public.request_space_deletion(p_space_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_hosts int;
  v_new_request_id bigint;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;

  -- Lazy-expire: a stale pending request past its own 7-day window is
  -- treated as cancelled the moment anything here looks at it, rather
  -- than needing a scheduled job — see this file's header note and the
  -- PR description for why that's sufficient for this specific timeout.
  update space_deletion_requests
  set status = 'cancelled'
  where space_deletion_requests.space_id = p_space_id
    and space_deletion_requests.status = 'pending'
    and space_deletion_requests.expires_at < now();

  select count(*) into v_active_hosts from space_members
  where space_members.space_id = p_space_id
    and space_members.role = 'host'
    and space_members.status = 'active';

  if v_active_hosts <= 1 then
    -- Nothing left to ask anyone else — cancel any request that's still
    -- open only because a second host who has since departed never
    -- responded (see change 3's departed-host handling below for the
    -- more common case; this is the same idea for the sole-host case),
    -- then delete directly.
    update space_deletion_requests
    set status = 'cancelled'
    where space_deletion_requests.space_id = p_space_id and space_deletion_requests.status = 'pending';
    perform public.execute_space_deletion(p_space_id);
    return 'deleted';
  end if;

  if exists (
    select 1 from space_deletion_requests
    where space_deletion_requests.space_id = p_space_id and space_deletion_requests.status = 'pending'
  ) then
    raise exception 'This Space already has an open deletion request.';
  end if;

  insert into space_deletion_requests (space_id, requested_by)
  values (p_space_id, auth.uid())
  returning id into v_new_request_id;

  insert into space_deletion_approvals (deletion_request_id, host_user_id)
  select v_new_request_id, space_members.user_id
  from space_members
  where space_members.space_id = p_space_id
    and space_members.role = 'host'
    and space_members.status = 'active'
    and space_members.user_id <> auth.uid();

  return 'pending';
end;
$$;
revoke all on function public.request_space_deletion(uuid) from public, anon;
grant execute on function public.request_space_deletion(uuid) to authenticated;

-- The original requester withdraws their own still-open request. Not
-- explicitly in the spec, added for symmetry with cancel_join_request —
-- flagged as an addition, not a requirement.
create or replace function public.cancel_deletion_request(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
begin
  select * into v_request from space_deletion_requests where space_deletion_requests.id = p_request_id;
  if v_request.id is null then
    raise exception 'That deletion request doesn''t exist.';
  end if;
  if v_request.requested_by <> auth.uid() then
    raise exception 'Only the person who requested this can cancel it.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This deletion request is no longer open.';
  end if;
  update space_deletion_requests set status = 'cancelled' where space_deletion_requests.id = p_request_id;
end;
$$;
revoke all on function public.cancel_deletion_request(bigint) from public, anon;
grant execute on function public.cancel_deletion_request(bigint) to authenticated;

-- A host answers a deletion request they were asked about. Any decline
-- cancels the whole request immediately. On an approval, any snapshotted
-- host who is no longer an active host of this Space (left, demoted, or
-- their account was deleted) has their still-pending approval dropped
-- before checking whether the request is now fully resolved — a departed
-- host can never block completion just by having gone silent.
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

  -- p_decision = 'approved' from here — change 3: drop stale approvals
  -- for anyone who stopped being an active host of this Space since the
  -- request was opened.
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
revoke all on function public.respond_to_deletion_request(bigint, text) from public, anon;
grant execute on function public.respond_to_deletion_request(bigint, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Account-deletion handoff. auth.users cascades into space_members on
--    delete, so this trigger is the only path that can fire it: every
--    RPC that removes a host (leave_space, demote_host, remove_member)
--    already refuses to remove the last one.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.spaces add column if not exists host_handoff_started_at timestamptz;

create or replace function public.start_host_handoff_if_last_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'host' and old.status = 'active' then
    if not exists (
      select 1 from space_members sm
      where sm.space_id = old.space_id and sm.role = 'host' and sm.status = 'active'
    ) then
      update spaces
      set host_handoff_started_at = coalesce(spaces.host_handoff_started_at, now())
      where spaces.id = old.space_id and spaces.status = 'active';
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists space_members_start_handoff on public.space_members;
create trigger space_members_start_handoff
  after delete on public.space_members
  for each row execute function public.start_host_handoff_if_last_host();

-- Any active member can claim hosting during the 14-day window — shown to
-- the longest-standing member first is a display/notification concern
-- (Phase 5), not a backend turn-order constraint enforced here. Change 1:
-- only a member who was already active BEFORE the window started is
-- eligible; someone who joins during the search can't claim it.
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
revoke all on function public.accept_host_handoff(uuid) from public, anon;
grant execute on function public.accept_host_handoff(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. moderation_queue — general-purpose, not Phase-4-specific: target_type
--    covers spaces/moments/members so the (future) Report feature can
--    reuse this same table rather than building a parallel one. Phase 4
--    only ever writes target_type = 'space'. No FK on target_id since the
--    target table varies by target_type (Postgres can't express a
--    conditional FK) — stored as text, cast to the real type by whatever
--    reads it. reported_by is null for a system-generated row (the sweep
--    below); a real value once the Report feature starts writing here.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.moderation_queue (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('space', 'moment', 'member')),
  target_id text not null,
  reason text not null,
  reported_by uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
alter table public.moderation_queue enable row level security;

drop policy if exists "admins manage the moderation queue" on public.moderation_queue;
create policy "admins manage the moderation queue"
  on public.moderation_queue for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));
-- No policy needed for the system write below — sweep_expired_host_
-- handoffs is SECURITY DEFINER and bypasses RLS on its own inserts, the
-- same as every other function in this file.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. The 14-day handoff sweep — not lazily evaluated, on purpose (see
--    this migration's PR description): "flag it for the Sushii team"
--    should happen even if literally nobody ever revisits an abandoned
--    Space. Not gated on is_admin — there's no meaningful auth.uid() in a
--    cron context, so EXECUTE is revoked from every real role instead;
--    only the extension's own scheduled invocation (running as the
--    function owner) can call it.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.sweep_expired_host_handoffs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
begin
  for v_space in
    select spaces.id from spaces
    where spaces.host_handoff_started_at is not null
      and spaces.host_handoff_started_at + interval '14 days' < now()
      and spaces.status = 'active'
      and not exists (
        select 1 from space_members sm
        where sm.space_id = spaces.id and sm.role = 'host' and sm.status = 'active'
      )
  loop
    update spaces
    set status = 'read_only', host_handoff_started_at = null
    where spaces.id = v_space.id;

    insert into moderation_queue (target_type, target_id, reason, reported_by, status)
    values (
      'space',
      v_space.id::text,
      'Host handoff window expired with no active host and nobody accepted hosting.',
      null,
      'open'
    );
  end loop;
end;
$$;
revoke all on function public.sweep_expired_host_handoffs() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Schedule the sweep. pg_cron's job-management functions live in the
--    `cron` schema regardless of where the extension's other objects are
--    installed; Supabase's managed postgres role already has the grants
--    needed to schedule jobs from the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'sweep-expired-host-handoffs',
  '0 3 * * *',
  $$select public.sweep_expired_host_handoffs();$$
);

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select jobname, schedule, command, active from cron.job
-- where jobname = 'sweep-expired-host-handoffs';
-- -- expect 1 row, active = true, schedule = '0 3 * * *'
--
-- select policyname, cmd from pg_policies where tablename = 'spaces' and policyname = 'spaces are publicly readable';
-- select policyname, cmd from pg_policies
-- where tablename = 'space_members' and policyname = 'roster visibility follows status and the space''s access';
-- select policyname, cmd from pg_policies where tablename = 'moderation_queue';
--
-- select column_name from information_schema.columns
-- where table_name = 'spaces' and column_name = 'host_handoff_started_at';
--
-- select proname from pg_proc where pronamespace = 'public'::regnamespace
--   and proname in ('execute_space_deletion', 'request_space_deletion', 'cancel_deletion_request',
--     'respond_to_deletion_request', 'start_host_handoff_if_last_host', 'accept_host_handoff',
--     'sweep_expired_host_handoffs')
--   order by proname;
-- -- expect all 7
--
-- See supabase/verification/phase4_hosts_and_deletion_check.sql for the
-- full simulation.
