-- Adds a fifth participation kind — direct_message — for the new "Message"
-- button on a profile (src/app/pages/PublicProfile.tsx), which opens a
-- thread with no request or acceptance step first. See
-- src/app/data/participation.ts's own updated comment for why this is the
-- one deliberate exception to "no cold DMs": it isn't mutual the way
-- make_together/explore_together are, so it's inserted already
-- status = 'accepted' rather than 'pending'.
--
-- Two things need widening for a direct_message row to actually work:
--
-- 1. participations_kind_check (docs/schema-baseline-20260920.sql:414) only
--    allows 'join_in', 'make_together', 'explore_together' — a
--    direct_message insert would violate it exactly the way an unwidened
--    posts_type_check once rejected 'written' rows.
--
-- 2. Both public.messages RLS policies (sql/social.sql section 7) require
--    the owning participation's kind to be in ('make_together',
--    'explore_together') before a message can be read or written — a
--    direct_message thread's messages would be invisible and unwritable
--    without this.
--
-- Nothing else needs to change: the participations table's own INSERT
-- policy ("you can ask") only checks auth.uid() = from_user, not kind or
-- status, so inserting a pre-accepted direct_message row is already
-- allowed by it. The one-pending-ask unique index
-- (participations_one_pending_ask) is scoped to status = 'pending' and
-- kind in ('make_together','explore_together') — a direct_message row,
-- always inserted 'accepted', never touches it.
--
-- Safe to re-run: DROP CONSTRAINT/POLICY IF EXISTS, then re-add.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved.
--
-- ── UP ──────────────────────────────────────────────────────────────────
alter table public.participations drop constraint if exists participations_kind_check;
alter table public.participations add constraint participations_kind_check
  check (kind = any (array['join_in'::text, 'make_together'::text, 'explore_together'::text, 'direct_message'::text]));

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
