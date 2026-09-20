-- Adds profiles.theme_preference, synced across devices once signed in.
-- Repo-parity migration for sql/theme-preference.sql, which predates the
-- supabase/migrations/ convention this session's work follows — same
-- idempotent shape (IF NOT EXISTS / safe to re-run), just given a real
-- migration file so `list_migrations` and this repo agree on it.
--
-- Must apply BEFORE 20260920010000_profiles_is_admin_lock.sql: that
-- migration's UPDATE column grant includes theme_preference, which would
-- fail outright (GRANT UPDATE on a column that doesn't exist errors
-- immediately) if this hasn't run first.

alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark'));
