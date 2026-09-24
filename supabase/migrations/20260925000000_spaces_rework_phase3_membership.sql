-- Sushii: Spaces Rework Phase 3 — membership and access.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924110000_spaces_rework_schema.sql.
--
-- Audit finding, found while planning this file (not yet run anywhere):
-- the Phase 2 schema migration's space_members policies have two real
-- gaps that would defeat the guarantees this phase is supposed to
-- provide, if left as-is:
--
--   1. "hosts manage members, members manage themselves" (UPDATE) let a
--      member update ANY column on their own row — including status and
--      role. A pending request-to-join could UPDATE their own row to
--      status = 'active' and be in, no host approval needed.
--   2. "leave or be removed" (DELETE) let a banned member delete their
--      own row unconditionally, then immediately re-INSERT a fresh
--      pending/active row via the join policy — nothing checked ban
--      history. A ban was trivially reversible by the banned user.
--
-- This migration closes both by removing every direct INSERT/UPDATE/
-- DELETE policy on space_members and space_host_invites entirely — every
-- write goes through a SECURITY DEFINER RPC below that checks the
-- specific transition it allows. There is no raw-table path left to join,
-- approve, promote, ban, or unban.
--
-- A second round of review (before this ever ran) found the roster SELECT
-- policy itself was too broad — any active member could see every OTHER
-- row too, including who else was pending or banned, and their join
-- answers. That's closed here as well: pending/banned rows are visible
-- only to hosts and the row's own user; join_answers moves out of
-- space_members into its own space_join_requests table for the same
-- reason (a request's answers are between the requester and the hosts,
-- not the whole membership).
--
-- Safe to re-run: policy drops are idempotent, functions are
-- create-or-replace, the space_moments column/trigger additions are
-- IF NOT EXISTS / idempotent. NOT safe to re-run after real join_answers
-- data exists on space_members from a first partial run — the column
-- drop below is a one-way move to space_join_requests.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. space_members / space_host_invites — drop every direct write policy,
--    and tighten the roster's own SELECT policy.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "join or request to join" on public.space_members;
drop policy if exists "hosts manage members, members manage themselves" on public.space_members;
drop policy if exists "leave or be removed" on public.space_members;

drop policy if exists "hosts invite co-hosts" on public.space_host_invites;
drop policy if exists "the invitee answers" on public.space_host_invites;
-- "hosts and the invitee see the invite" (SELECT) is untouched.

-- Roster privacy: an active host row is public (a Space's hosts are shown
-- on its page regardless of access, same as the Space row itself always
-- is) — but an active *member* row only follows the Space's open/closed
-- access rule, and a pending or banned row is never visible to anyone but
-- a host or the row's own user, no matter the Space's access.
drop policy if exists "members see the roster" on public.space_members;
create policy "roster visibility follows status and the space's access"
  on public.space_members for select
  using (
    user_id = auth.uid()
    or public.is_space_host(space_id, auth.uid())
    or (
      status = 'active'
      and (
        role = 'host'
        or exists (
          select 1 from spaces s
          where s.id = space_id and (s.access = 'open' or public.is_space_member(s.id, auth.uid()))
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. A join request's answers live here now, not on space_members —
--    readable only by that Space's hosts and the requester themselves.
--    The row is deleted the moment the request is resolved (approved,
--    declined, or cancelled) by the functions below, so this table only
--    ever holds genuinely-pending requests.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.space_join_requests (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_join_requests enable row level security;

drop policy if exists "hosts and the requester read the join request" on public.space_join_requests;
create policy "hosts and the requester read the join request"
  on public.space_join_requests for select
  using (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));
-- No direct write policy — request_or_join_space/approve_join_request/
-- decline_join_request/cancel_join_request below are the only writers.

alter table public.space_members drop column if exists join_answers;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Join / leave / approve / ban.
-- ─────────────────────────────────────────────────────────────────────────

-- Open -> active immediately. Closed -> pending, with join_answers stored
-- in space_join_requests (required if the Space has join questions).
-- Rejects a banned caller, an already-active or already-pending caller,
-- and enforces member_cap against the current active count.
create or replace function public.request_or_join_space(p_space_id uuid, p_join_answers jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
  v_active_count int;
begin
  select * into v_space from spaces where id = p_space_id and status = 'active';
  if v_space.id is null then
    raise exception 'That Space doesn''t exist.';
  end if;

  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'banned') then
    raise exception 'You can''t join this Space.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'active') then
    raise exception 'You''re already a member.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'pending') then
    raise exception 'You already have a request pending.';
  end if;

  select count(*) into v_active_count from space_members where space_id = p_space_id and status = 'active';
  if v_space.member_cap is not null and v_active_count >= v_space.member_cap then
    raise exception 'This Space is full.';
  end if;

  if v_space.access = 'open' then
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'active');
    return 'active';
  else
    if jsonb_array_length(v_space.join_questions) > 0
       and (p_join_answers is null or jsonb_array_length(p_join_answers) = 0) then
      raise exception 'Answer the join questions to request to join.';
    end if;
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

-- The pending caller withdraws their own request.
create or replace function public.cancel_join_request(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'No pending request to cancel.';
  end if;
  delete from space_join_requests where space_id = p_space_id and user_id = auth.uid();
end;
$$;
revoke all on function public.cancel_join_request(uuid) from public, anon;
grant execute on function public.cancel_join_request(uuid) to authenticated;

-- Host-only. Re-checks member_cap at approval time too, in case it filled
-- up between the request and now.
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

-- Host-only. A host must be demoted (demote_host, below) before they can
-- be banned, so a ban never leaves a phantom host on the roster. Also
-- unlinks the banned user's space_moments rows for this Space — their
-- Moments stay in their own log, they just stop showing inside this Space.
create or replace function public.ban_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = p_user_id and role = 'host') then
    raise exception 'Demote them as a host (demote_host) before banning them.';
  end if;
  update space_members set status = 'banned' where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t in this Space.';
  end if;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
end;
$$;
revoke all on function public.ban_member(uuid, uuid) from public, anon;
grant execute on function public.ban_member(uuid, uuid) to authenticated;

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
revoke all on function public.unban_member(uuid, uuid) from public, anon;
grant execute on function public.unban_member(uuid, uuid) to authenticated;

-- Host-only kick of an active member (not a ban — they could request to
-- join again). Refuses to remove the last active host, same rule as
-- leave_space/demote_host below. Also unlinks their space_moments rows.
create or replace function public.remove_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_active_hosts int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  select role into v_target_role from space_members
  where space_id = p_space_id and user_id = p_user_id and status = 'active';
  if v_target_role is null then
    raise exception 'That person isn''t an active member.';
  end if;
  if v_target_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else first.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = p_user_id;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
end;
$$;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Self-service leave. Spec Phase 4 owns the deletion-request/approval
-- flow, but the last-host rule is enforced here since this is one of the
-- places a host count can actually drop to zero (demote_host is the
-- other).
create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active_hosts int;
begin
  select role into v_role from space_members
  where space_id = p_space_id and user_id = auth.uid() and status = 'active';
  if v_role is null then
    raise exception 'You''re not a member of this Space.';
  end if;
  if v_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else before you leave.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = auth.uid();
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = auth.uid();
end;
$$;
revoke all on function public.leave_space(uuid) from public, anon;
grant execute on function public.leave_space(uuid) to authenticated;

-- Hosts have equal powers (spec) — any host can demote any other host,
-- including themselves ("step down" is just demote_host(space_id, self)).
-- Same last-host rule as leave_space.
create or replace function public.demote_host(p_space_id uuid, p_user_id uuid)
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
  if not exists (
    select 1 from space_members
    where space_id = p_space_id and user_id = p_user_id and role = 'host' and status = 'active'
  ) then
    raise exception 'That person isn''t an active host of this Space.';
  end if;
  select count(*) into v_active_hosts from space_members
  where space_id = p_space_id and role = 'host' and status = 'active';
  if v_active_hosts <= 1 then
    raise exception 'A Space needs at least one host — promote someone else first.';
  end if;
  update space_members set role = 'member' where space_id = p_space_id and user_id = p_user_id and status = 'active';
end;
$$;
revoke all on function public.demote_host(uuid, uuid) from public, anon;
grant execute on function public.demote_host(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Host invites — co-hosting an existing member, who must accept.
-- ─────────────────────────────────────────────────────────────────────────

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
revoke all on function public.invite_host(uuid, uuid) from public, anon;
grant execute on function public.invite_host(uuid, uuid) to authenticated;

-- Re-checks the 5-host cap at accept time too (not just at invite time),
-- since it could have filled up in between.
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
revoke all on function public.accept_host_invite(bigint) from public, anon;
grant execute on function public.accept_host_invite(bigint) to authenticated;

create or replace function public.decline_host_invite(p_invite_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update space_host_invites set status = 'declined', responded_at = now()
  where id = p_invite_id and invited_user_id = auth.uid() and status = 'invited';
  if not found then
    raise exception 'No pending invite found.';
  end if;
end;
$$;
revoke all on function public.decline_host_invite(bigint) from public, anon;
grant execute on function public.decline_host_invite(bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. space_moments — pending links for a Space that requires host
--    approval to post. status is trigger-set from the Space's own
--    posting_mode, server-side, never client-supplied — a member can't
--    self-approve by just inserting a different value than the default.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.space_moments add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved'));

create or replace function public.set_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select case when posting_mode = 'approval' then 'pending' else 'approved' end
  into new.status
  from spaces where id = new.space_id;
  return new;
end;
$$;
drop trigger if exists space_moments_set_status on public.space_moments;
create trigger space_moments_set_status
  before insert on public.space_moments
  for each row execute function public.set_space_moment_status();

-- A pending link is visible only to its own poster and hosts, regardless
-- of the Space's access; an approved link follows the existing open/member
-- rule as before.
drop policy if exists "space moments follow the space's access" on public.space_moments;
create policy "space moments follow the space's access"
  on public.space_moments for select
  using (
    removed_by_host = false
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (
          (status = 'approved' and (s.access = 'open' or public.is_space_member(s.id, auth.uid())))
          or (
            status = 'pending'
            and (
              public.is_space_host(s.id, auth.uid())
              or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
            )
          )
        )
    )
  );

-- Phase 3 audit finding: the previous UPDATE policy's poster-owned branch
-- also covered this statement, which meant a poster could UPDATE their own
-- pending link's status to 'approved' themselves — self-approving past the
-- host review this feature exists to provide. Featuring, removing, and
-- approving a pending link are host-only now.
drop policy if exists "hosts feature or remove, the poster unlinks their own" on public.space_moments;
drop policy if exists "hosts feature, remove, or approve pending links" on public.space_moments;
create policy "hosts feature, remove, or approve pending links"
  on public.space_moments for update to authenticated
  using (public.is_space_host(space_id, auth.uid()))
  with check (public.is_space_host(space_id, auth.uid()));

-- The DELETE policy that used to let a poster unlink their own Moment
-- directly is now host-only too — unlink_my_moment (below) is the only
-- self-service path, consistent with everything else in this file going
-- through a function rather than a raw-table policy.
drop policy if exists "hosts or the poster delete the link" on public.space_moments;
create policy "hosts delete the link"
  on public.space_moments for delete to authenticated
  using (public.is_space_host(space_id, auth.uid()));

-- Authors can unlink their own Moment from a Space — it's their Moment.
create or replace function public.unlink_my_moment(p_space_id uuid, p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from space_moments
  where space_id = p_space_id and post_id = p_post_id
    and exists (select 1 from posts p where p.id = p_post_id and p.user_id = auth.uid());
  if not found then
    raise exception 'That Moment isn''t linked to this Space, or isn''t yours.';
  end if;
end;
$$;
revoke all on function public.unlink_my_moment(uuid, bigint) from public, anon;
grant execute on function public.unlink_my_moment(uuid, bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies where tablename = 'space_members' order by policyname;
-- -- expect exactly one row: "roster visibility follows status and the space's access" (SELECT)
-- select policyname, cmd from pg_policies where tablename = 'space_host_invites' order by policyname;
-- -- expect exactly one row: "hosts and the invitee see the invite" (SELECT)
-- select policyname, cmd from pg_policies where tablename = 'space_join_requests' order by policyname;
-- -- expect exactly one row: "hosts and the requester read the join request" (SELECT)
-- select column_name from information_schema.columns where table_name = 'space_members' and column_name = 'join_answers';
-- -- expect 0 rows (moved to space_join_requests)
-- select proname from pg_proc where pronamespace = 'public'::regnamespace
--   and proname in ('request_or_join_space','cancel_join_request','approve_join_request',
--     'decline_join_request','ban_member','unban_member','remove_member','leave_space',
--     'demote_host','invite_host','accept_host_invite','decline_host_invite',
--     'unlink_my_moment','set_space_moment_status')
--   order by proname;
-- -- expect all 14
--
-- See supabase/verification/phase3_membership_access_check.sql for the
-- full simulation this phase's spec asked for — one self-contained
-- transaction, ends in RAISE EXCEPTION carrying every PASS/FAIL result in
-- its message, rolls back regardless of outcome.
