-- NoSpace: Moment drafts — a best-effort cross-device mirror of the one
-- in-progress composer draft someone hasn't published or discarded yet.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- The composer's local draft (src/app/lib/draftStore.ts, localStorage) is
-- what makes a draft survive a full browser close on the same device, with
-- or without an account — that's the source of truth, and works instantly.
-- This table exists only so a signed-in person's caption/audience/Corner/
-- event fields can also be recovered from a different device. It does NOT
-- hold the attached photo/video: that only ever lives in the capturing
-- device's IndexedDB (src/app/lib/draftMedia.ts) — recovering a draft
-- elsewhere recovers the words, not the picture, and media_type below is
-- just a marker so the resume prompt can say so honestly.
--
-- One row per person, upserted on every autosave and deleted the moment the
-- draft is published or explicitly discarded — this is scratch space for
-- one in-progress Moment, never a permanent record.
create table if not exists public.moment_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  thought text not null default '',
  hobby_slug text,
  sub_hobby text,
  interest text not null default '',
  space_set boolean not null default false,
  audience text not null default 'private',
  circle_id bigint,
  is_activity boolean not null default false,
  starts_at text not null default '',
  location_name text not null default '',
  location_privacy text not null default 'neighborhood',
  project_id text not null default '',
  project_title text not null default '',
  media_type text check (media_type in ('photo', 'video')),
  updated_at timestamptz not null default now()
);

alter table public.moment_drafts enable row level security;

-- Entirely private — an in-progress draft is nobody's business but the
-- person writing it, unlike Pursuits or profile links which are partly
-- public by design.
drop policy if exists "you see only your own draft" on public.moment_drafts;
create policy "you see only your own draft"
  on public.moment_drafts for select
  using (auth.uid() = user_id);

drop policy if exists "you save your own draft" on public.moment_drafts;
create policy "you save your own draft"
  on public.moment_drafts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you update your own draft" on public.moment_drafts;
create policy "you update your own draft"
  on public.moment_drafts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "you clear your own draft" on public.moment_drafts;
create policy "you clear your own draft"
  on public.moment_drafts for delete
  using (auth.uid() = user_id);
