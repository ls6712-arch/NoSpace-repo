-- BACKFILL: the pre-rework `spaces`/`space_members` tables (sql/connections.sql
-- section 3 — "user-made Spaces", unrelated to the 15 built-in hobby Spaces
-- and unrelated to the Phase 2 rework's uuid-keyed `spaces`/`space_members`
-- created later by 20260924110000_spaces_rework_schema.sql) were never
-- created by any tracked migration, same gap as 20260919060000's Circles
-- backfill and 20260913195100's set_thread_answered() — this repo's
-- migration history starts after these already existed live.
--
-- 20260924090000_spaces_rework_export.sql (`create table ... as table
-- public.spaces` / `table public.space_members`) and
-- 20260924095000_spaces_rework_cleanup.sql (`drop table if exists
-- public.spaces` / `public.space_members`, `drop function if exists
-- public.is_space_member(bigint, uuid)`) both assume these exist — the
-- export statements fail outright ("relation does not exist") without
-- them; the cleanup drops are all `if exists` so wouldn't themselves fail,
-- but would then leave nothing for the export step to have actually backed
-- up.
--
-- Per 20260924095000's own header, sql/connections.sql "was only ever
-- partially applied" to this database — its `messages` columns and a
-- private-schema are_connected() existed live, but not the public-schema
-- pieces that migration assumed. Given that uncertainty, this backfill is
-- deliberately narrow: just the two tables (structure verbatim from
-- sql/connections.sql section 3) plus is_space_member(), which
-- 20260924095000's cleanup explicitly drops by exact signature — strong
-- evidence that one, at least, was actually live. The six RLS policies
-- from sql/connections.sql are NOT backfilled here: nothing in tracked
-- migration history validates their existence (every reference to them is
-- a `drop policy if exists`), so recreating them would be guessing without
-- the same evidence the tables and function have.
--
-- connections.sql's other sections (public.connections, are_connected(),
-- the posts.interest column, the messages policy/column changes) are out
-- of scope here too — nothing in tracked migration history depends on
-- them for replay to succeed, and 20260924095000's header already
-- confirms are_connected() live was in `private`, not `public` per
-- connections.sql, so backfilling connections.sql's public-schema version
-- of it would misrepresent what was actually live.

create table if not exists public.spaces (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  hobby_slug text,
  interest text,
  visibility text not null default 'invite' check (visibility in ('invite', 'open')),
  created_at timestamptz not null default now()
);
alter table public.spaces enable row level security;

create table if not exists public.space_members (
  space_id bigint not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_members enable row level security;

create or replace function public.is_space_member(s bigint, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = s and m.user_id = u and m.status = 'joined'
  );
$$;
