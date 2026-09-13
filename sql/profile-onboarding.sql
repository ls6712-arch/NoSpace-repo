-- NoSpace: profile onboarding — a short tagline, and the flag that marks the
-- first-run guided setup as done.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- tagline: the same short quote shown near your name — optional, skippable
-- during onboarding, editable any time after.
--
-- onboarding_completed_at: set once, the first time someone finishes or
-- skips the 3-step setup on /you. Its only job is "never show this again" —
-- nothing reads the timestamp itself, just whether it's set.
alter table public.profiles add column if not exists tagline text;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
