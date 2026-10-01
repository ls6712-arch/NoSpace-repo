-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded. Superseded the next day by
-- 20260918201427_profile_follows_accept_based.sql, which adds the
-- status/responded_at columns this version doesn't have.

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_no_self_follow check (follower_id <> followed_id)
);

alter table public.profile_follows enable row level security;

drop policy if exists "profile follows are readable when signed in" on public.profile_follows;
create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (auth.uid() is not null);

drop policy if exists "you follow people as yourself" on public.profile_follows;
create policy "you follow people as yourself"
  on public.profile_follows for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "you unfollow as yourself" on public.profile_follows;
create policy "you unfollow as yourself"
  on public.profile_follows for delete
  using (auth.uid() = follower_id);

create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id);
create index if not exists profile_follows_follower_idx on public.profile_follows (follower_id);
