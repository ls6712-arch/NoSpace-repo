-- Rollback for 20260926000000_spaces_rework_phase4_hosts_and_deletion.sql.
--
-- Draft only — staged for review, not run.
--
-- Not safe to run once a real deletion has happened (spaces.status =
-- 'deleted' rows exist, or space_moments/space_private_details/
-- space_join_requests/host invites were cleaned up for one) — this
-- migration never deleted underlying data on its own, only removed the
-- functions/policies that let anyone reach that state going forward, so
-- there's nothing to restore for already-deleted Spaces. Also not safe
-- once a real host handoff or moderation_queue row exists that matters —
-- dropping their tables/columns below is a one-way move.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unschedule and drop the sweep.
-- ─────────────────────────────────────────────────────────────────────────
select cron.unschedule('sweep-expired-host-handoffs')
where exists (select 1 from cron.job where jobname = 'sweep-expired-host-handoffs');

drop function if exists public.sweep_expired_host_handoffs();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. moderation_queue.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "admins manage the moderation queue" on public.moderation_queue;
drop table if exists public.moderation_queue;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Account-deletion handoff.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.accept_host_handoff(uuid);
drop trigger if exists space_members_start_handoff on public.space_members;
drop function if exists public.start_host_handoff_if_last_host();
alter table public.spaces drop column if exists host_handoff_started_at;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Deletion request/approval/cancel and the shared execute helper.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.respond_to_deletion_request(bigint, text);
drop function if exists public.cancel_deletion_request(bigint);
drop function if exists public.request_space_deletion(uuid);
drop function if exists public.execute_space_deletion(uuid);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Restore the Phase 3 roster policy and the pre-admin-exception
--    "spaces are publicly readable" policy.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "roster visibility follows status and the space's access" on public.space_members;
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

drop policy if exists "spaces are publicly readable" on public.spaces;
create policy "spaces are publicly readable"
  on public.spaces for select using (status <> 'deleted');
