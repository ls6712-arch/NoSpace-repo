-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded. Evolves the previous day's
-- profile_follows into accept/decline (status, responded_at); the
-- `create table if not exists` at the top is a no-op here since the table
-- already exists from 20260917224324_profile_follows.sql, left in as
-- recorded rather than trimmed.

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (follower_id, followed_id),
  constraint profile_follows_no_self_follow check (follower_id <> followed_id)
);

alter table public.profile_follows add column if not exists status text;
alter table public.profile_follows add column if not exists responded_at timestamptz;
update public.profile_follows set status = 'accepted' where status is null;
alter table public.profile_follows alter column status set default 'pending';
alter table public.profile_follows alter column status set not null;
alter table public.profile_follows drop constraint if exists profile_follows_status_check;
alter table public.profile_follows add constraint profile_follows_status_check
  check (status in ('pending', 'accepted', 'declined'));

alter table public.profile_follows enable row level security;

drop policy if exists "profile follows are readable when signed in" on public.profile_follows;
create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (auth.uid() is not null);

drop policy if exists "you follow people as yourself" on public.profile_follows;
create policy "you follow people as yourself"
  on public.profile_follows for insert to authenticated
  with check (auth.uid() = follower_id and status = 'pending');

drop policy if exists "only the followed person answers" on public.profile_follows;
create policy "only the followed person answers"
  on public.profile_follows for update
  using (auth.uid() = followed_id) with check (auth.uid() = followed_id);

drop policy if exists "you unfollow as yourself" on public.profile_follows;
drop policy if exists "either side can end a follow" on public.profile_follows;
create policy "either side can end a follow"
  on public.profile_follows for delete
  using (auth.uid() = follower_id or auth.uid() = followed_id);

create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id, status);
create index if not exists profile_follows_follower_idx on public.profile_follows (follower_id, status);
