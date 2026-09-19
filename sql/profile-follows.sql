-- Sushii: profile follows — one person following another's Shelf, the real
-- relationship the studio view's "N followers" count needs. Deliberately
-- separate from hobby_follows (interest-level, follows a Space/Corner).
--
-- Accept-based, same rule the old connections system enforced and PersonActions
-- has since been retired in favor of: nothing about a private relationship
-- takes effect until the other person says yes. A follow starts 'pending' and
-- only counts toward "N followers" (and appears as "Following" to the person
-- who sent it) once the followed person accepts — see respondToFollow in
-- src/app/lib/profileFollows.ts, the same pattern connections.sql's
-- respondToConnection used, just pointed at this table.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (follower_id, followed_id),
  constraint profile_follows_no_self_follow check (follower_id <> followed_id)
);

-- Upgrading an install from before status existed: add the column without a
-- default so only genuinely-new rows land on the default below, backfill
-- every existing row (which only ever existed because the old, immediate
-- one-directional version let them through with nothing to accept) to
-- 'accepted' rather than silently un-confirming a follow that was already
-- real, then apply the default and constraint for everything after. Each
-- step only touches rows it hasn't already touched, so this is safe to run
-- against a fresh install (where it's all no-ops after the create table
-- above) or an existing one.
alter table public.profile_follows add column if not exists status text;
alter table public.profile_follows add column if not exists responded_at timestamptz;
update public.profile_follows set status = 'accepted' where status is null;
alter table public.profile_follows alter column status set default 'pending';
alter table public.profile_follows alter column status set not null;
alter table public.profile_follows drop constraint if exists profile_follows_status_check;
alter table public.profile_follows add constraint profile_follows_status_check
  check (status in ('pending', 'accepted', 'declined'));

alter table public.profile_follows enable row level security;

-- Readable by anyone signed in — a follower count and "who follows this
-- person" are public facts about a public Shelf, same as a post's like
-- count already is. The app itself only ever counts or lists status =
-- 'accepted' rows as real followers; a pending or declined row is visible
-- here (so the two sides of a pending request can each see it) but isn't a
-- follower yet.
drop policy if exists "profile follows are readable when signed in" on public.profile_follows;
create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (auth.uid() is not null);

-- You can only ever ask, never accept yourself in — every new row starts
-- pending, whatever the client sends.
drop policy if exists "you follow people as yourself" on public.profile_follows;
create policy "you follow people as yourself"
  on public.profile_follows for insert to authenticated
  with check (auth.uid() = follower_id and status = 'pending');

-- Only the person who was asked can accept or decline — the requester
-- withdrawing or unfollowing is a delete, below, not an update.
drop policy if exists "only the followed person answers" on public.profile_follows;
create policy "only the followed person answers"
  on public.profile_follows for update
  using (auth.uid() = followed_id) with check (auth.uid() = followed_id);

-- Either side can end it: the follower withdrawing a request or unfollowing
-- once accepted, or the followed person removing a follower outright.
drop policy if exists "you unfollow as yourself" on public.profile_follows;
drop policy if exists "either side can end a follow" on public.profile_follows;
create policy "either side can end a follow"
  on public.profile_follows for delete
  using (auth.uid() = follower_id or auth.uid() = followed_id);

create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id, status);
create index if not exists profile_follows_follower_idx on public.profile_follows (follower_id, status);
