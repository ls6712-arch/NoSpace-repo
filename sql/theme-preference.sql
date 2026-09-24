-- Sushii: theme preference, synced across devices once signed in.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark'));
