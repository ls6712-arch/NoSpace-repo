-- NoSpace: retire the connections / user-made-Spaces / connections-messaging
-- system that backed PersonActions' Explore/Connect/Invite, now that
-- PersonActions.tsx is deleted and ConnectionsContext.tsx no longer
-- references any of it (see that file's own updated docstring). Circle
-- invites (sql/circle-invites.sql) and participation-based messaging
-- (sql/social.sql's messages table, keyed by participation_id) are NOT
-- touched — both are real, independent features ConnectionsContext and
-- SocialContext still serve.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- NOT safe to blindly re-run after the tables are gone — the drops below
-- no-op fine on a second run (IF EXISTS), but there is no undo once run
-- once. Confirmed before running: as of this writing the live project has
-- 3 real rows in connections, 1 in spaces, 1 in space_members, and 1
-- direct (to_user) row in messages — real history, not just test rows.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. messages: drop only what connections.sql added, restore the original
--    participation-only shape from social.sql. The 1 real to_user row is
--    lost — there is no feature left that could ever read it once the
--    policy below is gone, so keeping it around would just be an orphan.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "you read messages meant for you" on public.messages;
drop policy if exists "you write to connections and your spaces" on public.messages;

delete from public.messages where participation_id is null;

alter table public.messages drop column if exists to_user;
alter table public.messages drop column if exists space_id;
alter table public.messages alter column participation_id set not null;

drop index if exists messages_pair_idx;
drop index if exists messages_space_idx;

create policy "messages need an accepted participation"
  on public.messages for select
  using (
    exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together','explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

create policy "you can write in an accepted thread"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together','explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. posts: connections.sql's are_connected-based 'friends' visibility
--    policy has no connections table left to read once step 3 drops it —
--    restore the plain, pre-connections policy (public + your own only;
--    'friends' visibility posts become owner-only until/unless a future
--    feature reintroduces a real mutual relationship to gate them on).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience"
  on public.posts for select
  using (visibility = 'public' or user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. connections, spaces, space_members: nothing left references any of
--    these (PersonActions.tsx deleted, ConnectionsContext.tsx trimmed to
--    circle invites only) — drop outright. Cascades take are_connected()
--    and is_space_member() with them.
-- ─────────────────────────────────────────────────────────────────────────
drop table if exists public.connections cascade;
drop table if exists public.spaces cascade;
drop table if exists public.space_members cascade;
drop function if exists public.are_connected(uuid, uuid);
drop function if exists public.is_space_member(bigint, uuid);
