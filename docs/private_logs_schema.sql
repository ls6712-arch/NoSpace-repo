-- Captures public.private_logs as it already exists in the database.
-- Correction: this table WAS applied as a real, tracked Supabase migration
-- (20260911001014_create_private_logs, confirmed via list_migrations) — it
-- was never missing from the database's own migration history. What's
-- missing is a corresponding file in this repo's sql/ folder, the
-- convention every other table in this codebase follows. This migration
-- exists only to close that repo-parity gap; it is idempotent (IF NOT
-- EXISTS / OR REPLACE throughout) and a no-op on the database that already
-- has this table — applying it here does not create a duplicate migration
-- entry for the same table, it just makes the file exist where the rest of
-- the schema expects to find one.
--
-- Audited 2026-09-19: all four policies (SELECT/INSERT/UPDATE/DELETE) are
-- owner-only (auth.uid() = user_id), with no wider sibling policy on any
-- command — confirmed by querying every cmd, not just SELECT. Nobody but
-- the owner can read a private log today.
create table if not exists public.private_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  hobby_slug text,
  project_id text references public.pursuits(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.private_logs enable row level security;

drop policy if exists "you see only your own private logs" on public.private_logs;
create policy "you see only your own private logs"
  on public.private_logs for select
  using (auth.uid() = user_id);

drop policy if exists "you create your own private logs" on public.private_logs;
create policy "you create your own private logs"
  on public.private_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you edit your own private logs" on public.private_logs;
create policy "you edit your own private logs"
  on public.private_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "you delete your own private logs" on public.private_logs;
create policy "you delete your own private logs"
  on public.private_logs for delete
  using (auth.uid() = user_id);
