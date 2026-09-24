-- Sushii: Pursuits can rest, set their own check-in cadence, and keep an
-- ending note ("What would you tell yourself on day one?").
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Purely additive: three nullable columns, no data touched,
-- no policy changed (the table's existing owner/shared RLS already covers
-- them). The app works without this — the local journal holds these fields
-- either way — but until it runs they don't follow a Pursuit to another
-- device or onto a shared Pursuit's page.

alter table public.pursuits add column if not exists paused_at timestamptz;

-- Days between check-ins, chosen by the maker. 0 = never ask. Null = not
-- chosen yet (the app falls back to 14).
alter table public.pursuits add column if not exists check_in_days integer
  check (check_in_days is null or (check_in_days >= 0 and check_in_days <= 365));

alter table public.pursuits add column if not exists ending_note text
  check (ending_note is null or char_length(ending_note) <= 1000);
