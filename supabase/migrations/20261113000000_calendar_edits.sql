-- Calendar, PR 2: calendar_entries, the one-off and weekly changes to a person's free time, and their private blocks.
--
-- Run AFTER 20261112000000_city_picks.sql. Applied only with the founder's written approval naming
-- this file (CLAUDE.md). The calendar brief names this file 20261101000000, but that version is
-- already taken by 20261101000000_moment_audience_and_stubs.sql, so it is the next free one.
--
-- The usual week stays in profile_private.free_windows. This table holds what changes it:
--   free   an extra stretch of free time ("I'm free then"), once or every week
--   busy   "not free this time", once (it takes time out of the usual week or of a free entry)
--   block  a private block; an optional note of up to 80 characters; once or every week
-- Every row is private to its owner: nobody else can read it, not a friend and not a host, and nothing
-- else (a profile, a Stub, a feed) reads it. An entry lasts at most 24 hours, so one that crosses
-- midnight is fine and one that never ends is not.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261113000000_calendar_edits.sql.

create table public.calendar_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('free', 'busy', 'block')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  repeat text not null default 'none' check (repeat in ('none', 'weekly')),
  -- Blocks only.
  note text check (note is null or char_length(note) between 1 and 80),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '24 hours'),
  check (note is null or kind = 'block'),
  check (kind <> 'busy' or repeat = 'none')
);

-- The calendar asks for one person's entries by time.
create index calendar_entries_user_starts_idx on public.calendar_entries (user_id, starts_at);

alter table public.calendar_entries enable row level security;

revoke all on public.calendar_entries from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_entries to authenticated;

create policy "you read your own entries"
  on public.calendar_entries for select to authenticated
  using (calendar_entries.user_id = (select auth.uid()));

create policy "you add your own entries"
  on public.calendar_entries for insert to authenticated
  with check (calendar_entries.user_id = (select auth.uid()));

create policy "you change your own entries"
  on public.calendar_entries for update to authenticated
  using (calendar_entries.user_id = (select auth.uid()))
  with check (calendar_entries.user_id = (select auth.uid()));

create policy "you remove your own entries"
  on public.calendar_entries for delete to authenticated
  using (calendar_entries.user_id = (select auth.uid()));
