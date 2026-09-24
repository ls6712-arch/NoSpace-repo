-- Rollback for 20260925020000_communication_phase1_safety.sql.
--
-- Restores every policy and function this migration touched to its exact
-- pre-migration definition (captured live, 2026-09-24, before any of this
-- was applied), then drops everything this migration added outright.
--
-- Run this top-to-bottom in one go. Safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- 8. notifications — restore the original (unhardened) INSERT policy and
--    drop everything added.
-- ═══════════════════════════════════════════════════════════════════════

drop trigger if exists notifications_enforce_insert on public.notifications;
drop function if exists public.enforce_notification_insert();
alter table public.notifications drop column if exists actor_id;

drop policy if exists "signed-in users can notify" on public.notifications;
create policy "signed-in users can notify"
  on public.notifications for insert
  with check (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. reports — drop entirely (nothing pre-existing to restore)
-- ═══════════════════════════════════════════════════════════════════════

drop trigger if exists rl_reports_insert on public.reports;
drop function if exists public.rl_reports();
drop trigger if exists reports_set_reviewed_meta on public.reports;
drop function if exists public.set_report_reviewed_meta();
drop table if exists public.reports;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. messages / participations — restore pre-migration policies exactly
--    (from 20260923000000_widen_participations_kind_for_dm.sql, the last
--    migration to touch either).
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "messages need an accepted participation" on public.messages;
create policy "messages need an accepted participation"
  on public.messages for select
  using (
    exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together', 'explore_together', 'direct_message')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

drop policy if exists "you can write in an accepted thread" on public.messages;
create policy "you can write in an accepted thread"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together', 'explore_together', 'direct_message')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

drop index if exists public.participations_one_direct_message_per_pair;

drop policy if exists "you can withdraw" on public.participations;
create policy "you can withdraw"
  on public.participations for delete
  using (auth.uid() = from_user);

drop trigger if exists participations_enforce_status_transition on public.participations;
drop function if exists public.enforce_participation_status_transition();

drop trigger if exists participations_set_insert_status on public.participations;
drop function if exists public.set_participation_insert_status();
-- (older draft names, in case a partial apply of an earlier version of
-- this migration ever ran)
drop trigger if exists participations_set_direct_message_status on public.participations;
drop function if exists public.set_direct_message_status();

drop policy if exists "the recipient answers" on public.participations;
create policy "the recipient answers"
  on public.participations for update
  using (auth.uid() = to_user or auth.uid() = from_user)
  with check (auth.uid() = to_user or auth.uid() = from_user);

drop policy if exists "you can ask" on public.participations;
create policy "you can ask"
  on public.participations for insert to authenticated
  with check (auth.uid() = from_user);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Write-side block checks — restore the pre-migration policies.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "anyone signed in can add a thought" on public.thoughts;
create policy "anyone signed in can add a thought"
  on public.thoughts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
  );

drop policy if exists "you react as yourself" on public.reactions;
create policy "you react as yourself"
  on public.reactions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "you follow people as yourself" on public.profile_follows;
create policy "you follow people as yourself"
  on public.profile_follows for insert to authenticated
  with check (auth.uid() = follower_id and status = 'pending');

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Read-side visibility — restore is_visible_profile() and profiles'
--    own SELECT policy to their pre-migration definitions.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "profiles are visible unless paused or deleting" on public.profiles;
create policy "profiles are visible unless paused or deleting"
  on public.profiles for select
  using (
    ((paused_at is null) and (deletion_requested_at is null))
    or ((select auth.uid()) = id)
  );

create or replace function public.is_visible_profile(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select uid = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = uid
          and p.paused_at is null
          and p.deletion_requested_at is null
      );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3 & 2 & 1. Drop everything net-new: the follow-removal trigger,
--    is_blocked_between() (in whichever schema it ended up in), and the
--    blocks table itself.
-- ═══════════════════════════════════════════════════════════════════════

drop trigger if exists blocks_remove_follows on public.blocks;
drop function if exists public.on_block_remove_follows();
drop function if exists private.is_blocked_between(uuid, uuid);
-- (older draft location, in case a partial apply of an earlier version of
-- this migration ever ran)
drop function if exists public.is_blocked_between(uuid, uuid);
drop table if exists public.blocks;
