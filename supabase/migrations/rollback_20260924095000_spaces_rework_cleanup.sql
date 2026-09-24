-- Rollback for 20260924095000_spaces_rework_cleanup.sql.
--
-- Draft only — staged for review, not run.
--
-- Only usable if 20260924090000_spaces_rework_export.sql ran first and its
-- archive tables still exist. Also only meaningful if run BEFORE
-- 20260924110000_spaces_rework_schema.sql — that migration creates its
-- own `spaces`/`space_members`/`is_space_member(uuid, uuid)`, which would
-- collide with the bigint-keyed originals this file recreates. Roll that
-- migration back first if it has already run.
--
-- Circles: the cleanup migration only ever DELETEd rows (schema stayed in
-- place — see that file's header), so rolling it back is just restoring
-- the archived rows, no CREATE TABLE/FUNCTION needed.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Circles — restore the deleted rows.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.circles overriding system value
  select * from archive.circles_20260924
  on conflict (id) do nothing;
insert into public.circle_members
  select * from archive.circle_members_20260924
  on conflict (circle_id, user_id) do nothing;
select setval(pg_get_serial_sequence('public.circles', 'id'), coalesce((select max(id) from public.circles), 1));

-- Restore circle_id/circle_tab/hidden_from_moments for posts that were
-- only unlinked (still exist, per the cleanup migration's "kept" branch)...
update public.posts p
set circle_id = a.circle_id,
    circle_tab = a.circle_tab,
    hidden_from_moments = a.hidden_from_moments
from archive.circle_linked_posts_20260924 a
where p.id = a.id;

-- ...and re-insert the ones that were hard-deleted (the cleanup
-- migration's "Circle-only thread/Update" branch) — these ids no longer
-- exist in public.posts at all.
insert into public.posts
select a.* from archive.circle_linked_posts_20260924 a
where not exists (select 1 from public.posts p where p.id = a.id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. sql/connections.sql's spaces/space_members, and the messages.space_id
--    column — these WERE schema-dropped, so recreate them. NOT
--    is_space_member(bigint, uuid) or any messages policy — live-database
--    correction (found while actually running the forward migration,
--    2026-09-24): neither ever existed in `public` to begin with
--    (is_space_member(bigint, uuid) turned out to live in a `private`
--    schema, untouched by the forward migration either way, and the live
--    messages policies were never connections-based — still the original
--    participations-based ones, never dropped), so there's nothing to
--    restore for either. See the forward migration's own corrected notes.
--
--    The `spaces` columns below include cover_image_url, which
--    sql/connections.sql's own CREATE TABLE doesn't mention — the live
--    table had it anyway (found the same way, comparing against the real
--    schema before writing this fix). Without it, restoring from the
--    archive below would fail on a column-count mismatch.
create table if not exists public.spaces (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  hobby_slug text,
  interest text,
  visibility text not null default 'invite' check (visibility in ('invite', 'open')),
  created_at timestamptz not null default now(),
  cover_image_url text
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

insert into public.spaces overriding system value
  select * from archive.old_spaces_20260924
  on conflict (id) do nothing;
insert into public.space_members
  select * from archive.old_space_members_20260924
  on conflict (space_id, user_id) do nothing;
select setval(pg_get_serial_sequence('public.spaces', 'id'), coalesce((select max(id) from public.spaces), 1));

create or replace function public.is_space_member(s bigint, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = s and m.user_id = u and m.status = 'joined'
  );
$$;

-- The forward migration additionally drops this corners policy now (found
-- on the actual first run, 2026-09-24 — see that file's own note), since
-- it's a hard dependency that blocks `drop table public.spaces`. Restore
-- it here for a complete rollback. Uses the real, live private.
-- is_space_member(bigint, uuid) — untouched by any of this — not the
-- public one just recreated above (that one only backs this file's own
-- restored spaces/space_members policies, and was never what this corners
-- policy actually called).
drop policy if exists "space members can create a corner" on public.corners;
create policy "space members can create a corner"
  on public.corners for insert to authenticated
  with check (
    exists (
      select 1 from public.spaces s
      where s.hobby_slug = corners.space_slug
        and (s.owner = auth.uid() or private.is_space_member(s.id, auth.uid()))
    )
  );

drop policy if exists "spaces are visible to members and by invitation" on public.spaces;
create policy "spaces are visible to members and by invitation"
  on public.spaces for select
  using (
    visibility = 'open'
    or owner = auth.uid()
    or exists (select 1 from public.space_members m where m.space_id = spaces.id and m.user_id = auth.uid())
  );

drop policy if exists "you can make a space" on public.spaces;
create policy "you can make a space"
  on public.spaces for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "the owner edits the space" on public.spaces;
create policy "the owner edits the space"
  on public.spaces for update using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "the owner removes the space" on public.spaces;
create policy "the owner removes the space"
  on public.spaces for delete using (auth.uid() = owner);

drop policy if exists "you see membership of spaces you are in" on public.space_members;
create policy "you see membership of spaces you are in"
  on public.space_members for select
  using (
    user_id = auth.uid()
    or public.is_space_member(space_id, auth.uid())
    or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
  );

drop policy if exists "members invite" on public.space_members;
create policy "members invite"
  on public.space_members for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
    )
  );

drop policy if exists "you answer your own invitation" on public.space_members;
create policy "you answer your own invitation"
  on public.space_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "you can leave, the owner can remove" on public.space_members;
create policy "you can leave, the owner can remove"
  on public.space_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.spaces s where s.id = space_id and s.owner = auth.uid())
  );

-- messages.space_id only — no policy to restore here (see this file's
-- section 2 header: the live messages policies were never touched by the
-- forward migration in the first place, since they were never actually
-- connections-based to begin with).
alter table public.messages add column if not exists space_id bigint references public.spaces (id) on delete cascade;
create index if not exists messages_space_idx on public.messages (space_id, created_at);
