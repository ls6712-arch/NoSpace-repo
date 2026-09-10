-- NoSpace: Shared milestones — which of a person's Quiet Milestones they've
-- explicitly chosen to show on their public profile.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- Milestone unlock state itself lives in the app's local rewards ledger
-- (localStorage, src/app/context/RewardsContext.tsx) so it works instantly,
-- with or without an account, and is never something a stranger's browser
-- could read directly. This table exists for exactly one thing: a milestone
-- the owner explicitly shares needs to be visible on their public profile,
-- from someone else's browser. A row existing here IS the share — there's
-- no separate boolean, and no row means private. Un-sharing deletes the row.
--
-- Quiet Milestones are private by default, one at a time, on purpose: the
-- whole section is invisible to a non-owner until they see rows here for
-- that person.
create table if not exists public.shared_milestones (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null,
  shared_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.shared_milestones enable row level security;

drop policy if exists "shared milestones are public" on public.shared_milestones;
create policy "shared milestones are public"
  on public.shared_milestones for select
  using (true);

drop policy if exists "you share your own milestones" on public.shared_milestones;
create policy "you share your own milestones"
  on public.shared_milestones for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you unshare your own milestones" on public.shared_milestones;
create policy "you unshare your own milestones"
  on public.shared_milestones for delete
  using (auth.uid() = user_id);

create index if not exists shared_milestones_user_idx on public.shared_milestones (user_id);
