-- Rollback for 20260922040000_you_inspired_rpc.sql.
--
-- Draft only — staged for review, not run.
--
-- Fully reversible: this function reads existing tables and creates no
-- data of its own, so dropping it removes everything the up migration
-- added, with nothing left behind.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
drop function if exists public.you_inspired_this_month();
