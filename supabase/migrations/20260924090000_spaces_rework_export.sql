-- Sushii: Spaces Rework Phase 2 — export before deleting.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run FIRST, before every other Spaces Rework migration in this batch.
--   In particular: run this and 20260924095000_spaces_rework_cleanup.sql
--   BEFORE 20260924110000_spaces_rework_schema.sql — that migration
--   creates NEW `spaces`/`space_members` tables and an `is_space_member`
--   function with `create table/function if not exists`-style guards, and
--   this database already has OLD tables/function with those same names
--   (see below). If the old ones are still around when the new schema
--   migration runs, its `create table if not exists public.spaces (...)`
--   silently no-ops instead of creating the new uuid-keyed table, leaving
--   the wrong old table sitting under the new name.
--
-- Live-data audit that led to this file (run 2026-09-24):
--   public.circles          — 1 row  ("Students moving to NYC", owner
--                              0a653a11-cb43-40f5-be8e-b21efc57891f)
--   public.circle_members   — 2 rows (the owner + one real member)
--   public.circle_invites   — table doesn't exist (circle-invites.sql was
--                              staged but never run against this database)
--   posts with circle_id set — 0 rows (no live Circle threads/"Updates")
--   public.spaces           — 1 row  ("Food", invite-only, same owner)
--   public.space_members    — 1 row  (the owner)
--
-- "The Lego Makers" correction: an earlier answer in this thread (Q7)
-- treated "The Lego Makers" as an existing Circle to be preserved in this
-- backup. That was wrong, and the error was mine — grep confirms it isn't
-- one: src/app/data/circles.ts's demo/seed Circle array is `[]` (emptied
-- out in a prior commit, per that file's own comment — the old invented
-- demo Circles, ids 1/2/5-10, were removed because "they had no database
-- row and no real members"), and "Lego Makers" appears nowhere in it or in
-- the live `circles` table. The only place that string exists in this
-- repo is a code comment in src/app/lib/pursuitProgress.ts, describing an
-- unrelated Pursuit-auto-labeling bug ("how a watercolor Moment got
-- labelled 'The Lego Makers'") — not a Circle, seed or live. There is
-- exactly one real Circle in this database: "Students moving to NYC".
-- Q7's other instruction (hobbies.ts's sub("LEGO") -> sub("Brick
-- building")) is unaffected and already done.
--
-- These are sql/connections.sql's `spaces`/`space_members` — an earlier,
-- unrelated "user-made Spaces" feature that predates this rework and was
-- never wired into any page (nothing in src/ references `.from('spaces')`,
-- `.from('space_members')`, or the `is_space_member(bigint, uuid)` RPC).
-- It collides by name with the new Phase 2 schema's `spaces`/
-- `space_members`/`is_space_member(uuid, uuid)`, so its tables and
-- function are schema-dropped entirely by the cleanup migration — safe,
-- since nothing live queries them. The real Circle above is treated more
-- conservatively: its ROW data is deleted (and archived here first), but
-- `circles`/`circle_members` and the Circle-thread columns on `posts` stay
-- in place until Phase 6 — see the cleanup migration's own header for why
-- (CirclesContext.tsx and the Circle UI it feeds are still live).
--
-- Nothing about the 15 old hobby-Spaces (as communities) needs exporting:
-- their only "membership" data is hobby_follows, which stays (repurposed
-- as the private Interests list, not deleted — see 20260924100000's
-- sibling decision), and posts.hobby_slug/sub_hobby/corner are untouched.
-- There is no separate table for "the 15 old Spaces' pages/feeds" to back
-- up — they were never anything more than hobbies.ts entries plus posts
-- filtered by hobby_slug, both of which persist. Admin override rows in
-- `categories` (sql/spaces-admin.sql) aren't deleted by this rework either
-- — see the check query at the bottom of this file to see what's there.
--
-- Safe to re-run: `create table if not exists` into a fixed archive name,
-- so re-running after the first successful run is a no-op rather than a
-- second, possibly-different snapshot.

create schema if not exists archive;

-- Not exposed through the Supabase API: PostgREST only serves schemas
-- listed in Project Settings -> API -> Exposed schemas, which defaults to
-- `public` (and `graphql_public`) only — confirm `archive` isn't in that
-- list yourself in the dashboard, since this session has no network path
-- to read it. These REVOKEs are the defense-in-depth backstop regardless
-- of that setting: even if `archive` were ever added to the exposed list
-- by mistake, anon/authenticated still couldn't read anything in it.
revoke all on schema archive from anon, authenticated;
alter default privileges in schema archive revoke all on tables from anon, authenticated;

create table if not exists archive.circles_20260924 as
  table public.circles;

create table if not exists archive.circle_members_20260924 as
  table public.circle_members;

create table if not exists archive.old_spaces_20260924 as
  table public.spaces;

create table if not exists archive.old_space_members_20260924 as
  table public.space_members;

-- Every post ever linked to the Circle above, kept or not — the cleanup
-- migration deletes the "only existed as a Circle thread" ones outright
-- (see its section 2), so this is their only remaining copy after that
-- runs. 0 rows today (audited above), but captured unconditionally so the
-- rollback path is real rather than assumed-empty.
-- `with no data` copies columns/types only, no primary key — so the
-- re-run guard below checks the archive table's own row count rather than
-- using ON CONFLICT (there's nothing to conflict on).
create table if not exists archive.circle_linked_posts_20260924 as
  table public.posts
  with no data;

do $$
begin
  if not exists (select 1 from archive.circle_linked_posts_20260924) then
    insert into archive.circle_linked_posts_20260924
    select * from public.posts where circle_id is not null;
  end if;
end
$$;

revoke all on all tables in schema archive from anon, authenticated;

-- Check: row counts in the archive should match the audit above.
select 'circles' as archived, count(*) from archive.circles_20260924
union all
select 'circle_members', count(*) from archive.circle_members_20260924
union all
select 'old_spaces', count(*) from archive.old_spaces_20260924
union all
select 'old_space_members', count(*) from archive.old_space_members_20260924
union all
select 'circle_linked_posts', count(*) from archive.circle_linked_posts_20260924;

-- Informational — not exported/deleted by this rework, but you asked what
-- admin override rows exist. A row here is either an override of one of
-- the 15 built-ins (its slug matches one) or a true database-only custom
-- Space (its slug doesn't):
select slug, name, active, sort_order, created_at
from public.categories
order by created_at;
