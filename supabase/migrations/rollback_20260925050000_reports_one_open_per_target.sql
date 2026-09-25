-- Rollback for 20260925050000_reports_one_open_per_target.sql.
--
--   Supabase → SQL Editor → New query → paste → Run

drop index if exists public.reports_one_open_per_target;
