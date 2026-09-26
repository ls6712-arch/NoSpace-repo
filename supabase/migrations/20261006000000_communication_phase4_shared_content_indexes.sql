-- Sushii: Communication Phase 4 follow-up — covering indexes for the two
-- foreign keys the phase 4 migration (20261005000000) added to messages:
-- shared_post_id -> posts(id) and shared_pursuit_id -> pursuits(id).
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Postgres never auto-indexes a foreign-key column itself (only the side
-- the FK points at gets one, from that table's own primary key) — a
-- non-blocking note from the security/performance advisors run during
-- Part A flagged both of these. Without them, two things stay slower than
-- they need to be as messages grows:
--   1. Deleting a Moment or a Pursuit that's been shared into any chat has
--      to seq-scan messages to find every row whose shared_post_id /
--      shared_pursuit_id points at it, to enforce the "on delete set
--      null" behavior these columns already declare.
--   2. Any future "everywhere this Moment/Pursuit was shared" query (there
--      isn't one yet) would otherwise have no index to use.
-- Neither is urgent today — messages is still small — but both are free to
-- add now rather than as an emergency later. Partial indexes, since the
-- large majority of rows are plain text/photo messages with both columns
-- null; a partial index only stores the rows that are actually shares,
-- keeping it small and cheap to maintain on every message insert.

create index if not exists messages_shared_post_id_idx
  on public.messages (shared_post_id)
  where shared_post_id is not null;

create index if not exists messages_shared_pursuit_id_idx
  on public.messages (shared_pursuit_id)
  where shared_pursuit_id is not null;
