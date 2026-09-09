-- NoSpace: Pursuits — the things someone is bringing to life.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- Pursuits already live in the app's local journal (client-side, per
-- browser) so a Pursuit works the moment it's created, with or without an
-- account. This table exists for exactly one reason: a Pursuit marked
-- shared needs to be visible on the owner's public profile, from someone
-- else's browser — and nothing client-side can do that. The owner's own
-- view of their Pursuits always reads the local journal first; this table
-- is a write-through mirror, kept only for accounts, used only so a
-- stranger's browser can see what's been explicitly shared.
--
-- `id` is `text`, not a generated identity, because it has to be the exact
-- same id the local journal already gave the Pursuit — there's no id
-- translation layer anywhere in the app for this.
create table if not exists public.pursuits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  hobby_slug text,
  sub_hobby text,
  interest text,
  custom_space text,
  inspired_by_post_id bigint,
  -- Private by default. Set true only when the owner explicitly shares
  -- this one Pursuit — never inferred from anything account-wide.
  shared boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Goal columns mirror lib/journal.ts's Goal type. Nullable and additive:
  -- a Pursuit with no goal set just leaves all of these null. Only the
  -- active goal is mirrored here — archived (`pastGoals`) goals stay
  -- local-only, since nothing outside the owner's own browser needs them
  -- yet. Goal visibility currently follows the Pursuit's own `shared` flag,
  -- same as every other column here — see the open question in the Set
  -- Goals flow spec about whether a Goal needs its own, narrower audience.
  goal_shape text check (goal_shape in ('number', 'date', 'feeling')),
  goal_label text,
  goal_target_number numeric,
  goal_unit text,
  goal_current numeric,
  goal_target_date timestamptz,
  goal_reached_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.pursuits enable row level security;

drop policy if exists "you see your own pursuits, others see only shared ones" on public.pursuits;
create policy "you see your own pursuits, others see only shared ones"
  on public.pursuits for select
  using (auth.uid() = user_id or shared = true);

drop policy if exists "you create your own pursuits" on public.pursuits;
create policy "you create your own pursuits"
  on public.pursuits for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you edit your own pursuits" on public.pursuits;
create policy "you edit your own pursuits"
  on public.pursuits for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "you delete your own pursuits" on public.pursuits;
create policy "you delete your own pursuits"
  on public.pursuits for delete
  using (auth.uid() = user_id);

create index if not exists pursuits_shared_user_idx on public.pursuits (user_id, shared);
