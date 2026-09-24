-- Sushii: Spaces Rework Phase 2 — before/after verification.
--
-- Not a migration — nothing here alters the schema. Run the BEFORE block,
-- run the four Phase 2 migrations in order (20260924090000_export,
-- 20260924095000_cleanup, 20260924100000_visibility,
-- 20260924110000_schema), then run the AFTER block and diff the two.
--
-- The two numbers that must be identical before and after are
-- total_moments and total_pursuits — nothing in this phase is supposed to
-- touch either. total_posts is expected to shrink by exactly the number
-- of Circle-only "Update" threads the cleanup migration deletes (0 today,
-- per the live-data audit in 20260924090000's header).
--
-- ── Testing the whole sequence on a copy first ────────────────────────
--
-- Option A — Supabase branching (needs a paid plan with branching
-- enabled): create a branch from the dashboard or `supabase branches
-- create`, run everything below against the branch's own connection
-- string, then delete the branch when done. Nothing on production is ever
-- touched.
--
-- Option B — local Postgres via pg_dump/restore (works on any plan):
--   1. pg_dump --schema=public --schema=archive --no-owner --no-acl
--        "$PROD_CONNECTION_STRING" > sushii_snapshot.sql
--      (Supabase dashboard -> Project Settings -> Database has the
--      connection string; use the read-only/reporting one if offered.)
--   2. Start a throwaway local Postgres (e.g. `docker run --rm -e
--      POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`) and restore:
--      `psql postgresql://postgres:postgres@localhost:5432/postgres < sushii_snapshot.sql`
--   3. Run the BEFORE block below against that local database.
--   4. Run the four Phase 2 migrations, in order, against it.
--   5. Run the AFTER block; diff against BEFORE.
--   6. Run the rollbacks in REVERSE order — rollback_...110000_schema,
--      rollback_...100000_visibility, rollback_...095000_cleanup,
--      rollback_...090000_export — then re-run the BEFORE block one more
--      time and confirm it matches the very first BEFORE output exactly
--      (this is what actually proves the rollbacks are real, not just
--      that they run without erroring).
--   7. Discard the local database. Nothing here ever touches production.

-- ═══════════════════════════════════════════════════════════════════════
-- BEFORE — run first, save the output
-- ═══════════════════════════════════════════════════════════════════════

select count(*) as total_posts from public.posts;

-- "Moment" here = a post that shows in its author's own Moments shelf:
-- everything except a Circle-only thread that was never opted into it
-- (hidden_from_moments = true). This is the count that must be unchanged
-- after the migration.
select count(*) as total_moments
from public.posts
where circle_id is null or hidden_from_moments = false;

select count(*) as total_pursuits from public.pursuits;

select p.user_id, count(*) as moments
from public.posts p
where p.circle_id is null or p.hidden_from_moments = false
group by p.user_id
order by moments desc;

-- Reference counts for the Circle/old-Space data itself, so you can
-- confirm the export captured everything before it's deleted.
select count(*) as circles from public.circles;
select count(*) as circle_members from public.circle_members;
select count(*) as circle_linked_posts from public.posts where circle_id is not null;
select
  count(*) filter (where hidden_from_moments = false) as will_be_kept_and_unlinked,
  count(*) filter (where hidden_from_moments = true) as will_be_deleted
from public.posts where circle_id is not null;
select count(*) as old_style_spaces from public.spaces;
select count(*) as old_style_space_members from public.space_members;

-- DM messaging, before — pick two connected users' ids you can test with;
-- this just confirms the query pattern the app itself uses still returns
-- their thread. Replace the two uuids.
-- select * from public.messages
-- where (from_user = '<user-a-id>' and to_user = '<user-b-id>')
--    or (from_user = '<user-b-id>' and to_user = '<user-a-id>')
-- order by created_at desc limit 5;

-- ═══════════════════════════════════════════════════════════════════════
-- AFTER — run once all four Phase 2 migrations have been applied
-- ═══════════════════════════════════════════════════════════════════════

select count(*) as total_posts from public.posts;

-- circle_id/hidden_from_moments still exist post-migration (kept until
-- Phase 6 — see the cleanup migration's header), just empty/false for
-- every row now, so the same predicate as BEFORE still applies and should
-- now just be trivially true for everything.
select count(*) as total_moments
from public.posts
where circle_id is null or hidden_from_moments = false;

select count(*) as total_pursuits from public.pursuits;

select user_id, count(*) as moments
from public.posts
where circle_id is null or hidden_from_moments = false
group by user_id
order by moments desc;

-- Circles: table/columns still exist (Phase 6 territory), but should be
-- empty now:
select count(*) as circles from public.circles;
select count(*) as circle_members from public.circle_members;
select count(*) as circle_linked_posts_remaining from public.posts where circle_id is not null;
-- expect 0, 0, 0

-- sql/connections.sql's old spaces/space_members ARE fully schema-dropped:
select count(*) as old_spaces_table_exists
from information_schema.tables
where table_schema = 'public' and table_name in ('spaces', 'space_members');
-- expect 0 rows — NOTE: this check must run before the schema migration
-- creates the NEW `spaces`/`space_members` (uuid-keyed), or it'll show 2
-- and you won't be able to tell which `spaces` it found. Run this AFTER
-- 20260924095000_cleanup but you can still run it after 110000_schema too
-- — just cross-check the new tables' column types (uuid, not bigint) via:
-- select column_name, data_type from information_schema.columns where table_name = 'spaces' and column_name = 'id';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'messages' and column_name = 'space_id';
-- expect 0 rows

-- The archive tables should hold everything that was deleted:
select 'circles' as archived, count(*) from archive.circles_20260924
union all
select 'circle_members', count(*) from archive.circle_members_20260924
union all
select 'old_spaces', count(*) from archive.old_spaces_20260924
union all
select 'old_space_members', count(*) from archive.old_space_members_20260924
union all
select 'circle_linked_posts', count(*) from archive.circle_linked_posts_20260924;

-- DM messaging, after — same query as the BEFORE block, same two ids.
-- Should return the identical rows.
-- select * from public.messages
-- where (from_user = '<user-a-id>' and to_user = '<user-b-id>')
--    or (from_user = '<user-b-id>' and to_user = '<user-a-id>')
-- order by created_at desc limit 5;

-- The new messages policies, to eyeball directly:
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by policyname;

-- The new Space schema exists and the reserved-slug guard is live:
select public.is_reserved_space_slug('food-cooking') as expect_true,
       public.is_reserved_space_slug('workbench') as expect_true_too,
       public.is_reserved_space_slug('brand-new-space-name') as expect_false;
