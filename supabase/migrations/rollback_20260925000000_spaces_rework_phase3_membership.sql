-- Rollback for 20260925000000_spaces_rework_phase3_membership.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the exact Phase 2 policies this file replaced, drops every RPC
-- and the space_moments status column/trigger it added, drops
-- space_join_requests and restores space_members.join_answers. Purely a
-- schema/policy/function rollback — no archived row data to restore (this
-- phase never deleted anything, only tightened who can write and see).
--
-- Not safe to run once real join requests, bans, or pending Moment links
-- exist under the new model: restoring the old self-service UPDATE policy
-- re-opens the self-approval/self-unban gaps this migration closed, and
-- restoring the old broad roster SELECT policy re-exposes pending/banned
-- rows and join answers to every member again. Any space_join_requests row
-- has no home under the old schema once the table is dropped — read it
-- back out first if it matters. Any space_moments row with
-- status = 'pending' silently becomes a normal, fully-visible link once
-- the column is dropped.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. space_moments — restore the Phase 2 shape.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.unlink_my_moment(uuid, bigint);

drop policy if exists "hosts delete the link" on public.space_moments;
create policy "hosts or the poster delete the link"
  on public.space_moments for delete to authenticated
  using (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "hosts feature, remove, or approve pending links" on public.space_moments;
create policy "hosts feature or remove, the poster unlinks their own"
  on public.space_moments for update to authenticated
  using (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  )
  with check (
    public.is_space_host(space_id, auth.uid())
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "space moments follow the space's access" on public.space_moments;
create policy "space moments follow the space's access"
  on public.space_moments for select
  using (
    removed_by_host = false
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (s.access = 'open' or public.is_space_member(s.id, auth.uid()))
    )
  );

drop trigger if exists space_moments_set_status on public.space_moments;
drop function if exists public.set_space_moment_status();
alter table public.space_moments drop column if exists status;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Drop every RPC this migration added.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.request_or_join_space(uuid, jsonb);
drop function if exists public.cancel_join_request(uuid);
drop function if exists public.approve_join_request(uuid, uuid);
drop function if exists public.decline_join_request(uuid, uuid);
drop function if exists public.ban_member(uuid, uuid);
drop function if exists public.unban_member(uuid, uuid);
drop function if exists public.remove_member(uuid, uuid);
drop function if exists public.leave_space(uuid);
drop function if exists public.demote_host(uuid, uuid);
drop function if exists public.invite_host(uuid, uuid);
drop function if exists public.accept_host_invite(bigint);
drop function if exists public.decline_host_invite(bigint);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. space_join_requests — drop it, restore space_members.join_answers.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "hosts and the requester read the join request" on public.space_join_requests;
drop table if exists public.space_join_requests;

alter table public.space_members add column if not exists join_answers jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. space_members / space_host_invites — restore the Phase 2 policies.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "roster visibility follows status and the space's access" on public.space_members;
create policy "members see the roster"
  on public.space_members for select to authenticated
  using (user_id = auth.uid() or public.is_space_member(space_id, auth.uid()));

drop policy if exists "join or request to join" on public.space_members;
create policy "join or request to join"
  on public.space_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (
      select 1 from spaces s
      where s.id = space_id
        and s.status = 'active'
        and (
          (s.access = 'open' and status = 'active')
          or (s.access = 'closed' and status = 'pending')
        )
    )
  );

drop policy if exists "hosts manage members, members manage themselves" on public.space_members;
create policy "hosts manage members, members manage themselves"
  on public.space_members for update to authenticated
  using (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));

drop policy if exists "leave or be removed" on public.space_members;
create policy "leave or be removed"
  on public.space_members for delete to authenticated
  using (user_id = auth.uid() or public.is_space_host(space_id, auth.uid()));

drop policy if exists "hosts invite co-hosts" on public.space_host_invites;
create policy "hosts invite co-hosts"
  on public.space_host_invites for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_space_host(space_id, auth.uid())
    and public.is_space_member(space_id, invited_user_id)
    and public.space_host_count(space_id) < 5
  );

drop policy if exists "the invitee answers" on public.space_host_invites;
create policy "the invitee answers"
  on public.space_host_invites for update to authenticated
  using (invited_user_id = auth.uid())
  with check (invited_user_id = auth.uid());
