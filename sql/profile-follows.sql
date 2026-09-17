-- NoSpace: profile follows — one person following another's Shelf, the real
-- relationship the studio view's "N followers" count needs. Deliberately
-- separate from hobby_follows (interest-level, follows a Space/Corner) and
-- from the old Clan/connections system (mutual, since retired) — this is a
-- plain one-directional follow, like following a person's work.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_no_self_follow check (follower_id <> followed_id)
);

alter table public.profile_follows enable row level security;

-- Readable by anyone signed in — a follower count and "who follows this
-- person" are public facts about a public Shelf, same as a post's like
-- count already is.
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
