-- Sushii: Spaces Rework Phase 2 — delete what 20260924090000 just backed up.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924090000_spaces_rework_export.sql.
--   Run BEFORE 20260924110000_spaces_rework_schema.sql (see that file's
--   header — it reuses the `spaces`/`space_members`/`is_space_member`
--   names this migration frees up).
--
-- Two unrelated things are being retired here, both confirmed against live
-- data before writing this file (see 20260924090000's header for the
-- counts) — but treated differently, for a reason worth spelling out:
--
--   1. sql/connections.sql's `spaces`/`space_members` and its
--      `is_space_member(bigint, uuid)` — confirmed by grep unreachable
--      from any current page (nothing in src/ references `.from('spaces')`,
--      `.from('space_members')`, or that RPC). Safe to drop the tables,
--      function (if it even exists in `public` — see the live-database
--      correction in section 1 below; `drop function if exists` makes
--      this harmless either way), and the messages.space_id column. No
--      messages *policy* needs touching: confirmed against the live
--      database that connections.sql's section 4 (connections-based
--      messaging policies) was never actually applied here — the real,
--      live messages policies are still participations-based and don't
--      reference space_id at all. See that section's own note.
--
--   2. Circles (sql/circles.sql: `circles`, `circle_members`, and the
--      Circle-thread columns sql/circle-threads.sql added to `posts`).
--      This is NOT safe to schema-drop yet, even though Circles are being
--      retired: CirclesContext.tsx queries `circles` directly and its
--      CirclesProvider wraps the entire app (src/app/App.tsx) — consumed
--      by MomentCard.tsx (rendered on most pages), Circles.tsx,
--      CircleBoard.tsx, CategoryFeed.tsx, AdminCircles.tsx,
--      CreateCircleDialog.tsx, and more. That UI isn't removed until
--      Phase 6. One call site (CirclesContext's own refresh()) happens to
--      degrade gracefully if the table is simply gone (Supabase-js doesn't
--      throw on a query error, and that function falls back to `?? []`),
--      but proving every other call site — CircleBoard's fetch of one
--      circle by id, CircleComposer's insert with circle_id, AdminCircles'
--      RPC calls — does the same isn't worth the risk when there's a
--      strictly safer option: this migration deletes the actual Circle
--      ROW data (after exporting it), but leaves the tables, `posts`
--      columns, functions and policies in place, empty. An empty `circles`
--      table is a state the app is already built to handle gracefully —
--      circles.ts's own comment says as much, since the old invented demo
--      Circles were already removed down to an empty array the same way.
--      The actual DROP TABLE/DROP COLUMN/DROP FUNCTION cleanup moves to
--      Phase 6, alongside removing the UI that queries them — see the
--      note at the bottom of this file.
--
-- The 15 old hobby-Spaces (as browsable communities) are NOT touched here:
-- their "membership" (hobby_follows) stays, repurposed as the private
-- Interests list, and posts.hobby_slug/sub_hobby/corner are unchanged. See
-- 20260924090000's header for why there's nothing to export or delete for
-- them.
--
-- NOT safe to blindly re-run against a database that has already had this
-- migration applied once and then had new Circles/old-style Spaces created
-- since — every statement here is a DROP or DELETE, and a second real
-- Circle created after the first run would be silently deleted by a
-- second run with no new backup taken. Re-running immediately after a
-- failed first attempt (nothing new created in between) is fine; the
-- DROP/ALTER/DELETE ... IF EXISTS guards make that idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. sql/connections.sql's spaces/space_members/is_space_member, and the
--    messages columns/policies built on top of them. Confirmed dead —
--    schema-dropped outright.
-- ─────────────────────────────────────────────────────────────────────────

-- Live-database correction (found while actually running this migration,
-- 2026-09-24): this file originally rewrote two `messages` RLS policies
-- here, on the assumption that connections.sql's section 4 (connections-
-- based messaging, using to_user/from_user/are_connected) was the live
-- policy set, and needed narrowing now that space_id's table is going
-- away. That assumption was wrong. On this database, connections.sql was
-- only ever partially applied: its columns exist (messages.to_user,
-- from_user, space_id all present), and its are_connected(uuid, uuid)
-- function exists too — but in a `private` schema, not `public`, so
-- `public.are_connected(...)` genuinely doesn't exist. More importantly,
-- the actual LIVE messages policies ("messages need an accepted
-- participation" / "you can write in an accepted thread") were never
-- replaced — they still gate on the older participations table
-- (participation_id, kind in ('make_together','explore_together',
-- 'direct_message'), status='accepted'), not on to_user/from_user/
-- are_connected/space_id at all. Rewriting them here would have been
-- solving a problem this database doesn't have, using a function in the
-- wrong schema on top of that. Nothing needs to change about them: they
-- don't reference space_id, so dropping that column below doesn't touch
-- what they enforce.
--
-- Drops messages_space_idx and the space_id -> spaces(id) FK along with
-- the column itself — still needed, so DROP TABLE public.spaces below
-- doesn't fail on the FK. No live policy references this column.
alter table public.messages drop column if exists space_id;

drop policy if exists "you can leave, the owner can remove" on public.space_members;
drop policy if exists "you answer your own invitation" on public.space_members;
drop policy if exists "members invite" on public.space_members;
drop policy if exists "you see membership of spaces you are in" on public.space_members;
drop table if exists public.space_members;

-- Second live-database correction (found on the actual first run of this
-- migration, 2026-09-24, then confirmed against docs/schema-baseline-
-- 20260920.sql — a real pg-introspected dump, not a guess): `corners` has
-- an INSERT policy, "space members can create a corner", whose WITH CHECK
-- does `exists (select 1 from spaces s where s.hobby_slug = corners.
-- space_slug and (s.owner = auth.uid() or private.is_space_member(s.id,
-- auth.uid())))` — a hard dependency on this table, which blocks
-- `drop table public.spaces` with "cannot drop table spaces because other
-- objects depend on it" unless dropped first. Safe to just drop, not
-- rewrite: corner creation is already covered without it by the sibling
-- policy "anyone signed in can create a corner" (any signed-in user, for
-- any of the 15 built-in space_slugs or any existing Category slug) —
-- the exact same permission surface every live Corner-creation path
-- (Log.tsx, Onboarding.tsx, CornerTagField) actually uses today. Nothing
-- could satisfy this policy's own condition anymore anyway, since nothing
-- creates old-style space_members rows. private.is_space_member(bigint,
-- uuid) and private.knows_space(bigint, uuid) (the two helper functions
-- built for this table, per the same baseline dump) become unreferenced
-- after this — left in place, harmless, Phase 6 cleanup territory like
-- the rest of this file's dead-code notes.
drop policy if exists "space members can create a corner" on public.corners;

drop policy if exists "the owner removes the space" on public.spaces;
drop policy if exists "the owner edits the space" on public.spaces;
drop policy if exists "you can make a space" on public.spaces;
drop policy if exists "spaces are visible to members and by invitation" on public.spaces;
drop table if exists public.spaces;

drop function if exists public.is_space_member(bigint, uuid);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Circles — DATA deleted now, SCHEMA kept until Phase 6 (see header).
--
--    A Circle-linked post splits in two, by `hidden_from_moments` — the
--    flag the Circle composer sets unless its own "Also save to Moments"
--    box is checked (sql/circle-threads.sql):
--      - hidden_from_moments = false: this post IS (also) a real Moment —
--        it already shows in its author's own Moments shelf. Unlink it
--        (clear circle_id/circle_tab) and keep it, same as
--        admin_delete_circle('keep_private') already does per-Circle.
--      - hidden_from_moments = true: this post only ever existed as a
--        Circle-only thread/"Update". Delete it with the Circle, same as
--        admin_delete_circle('delete') does per-Circle.
--    (Pursuits can't be linked to a Circle at all — sql/pursuits.sql's
--    `pursuits` table has no circle_id/space_id column — so there is no
--    Pursuit-unlinking step here.)
--
--    Confirmed against live data before writing this file: 0 posts have
--    circle_id set at all, so both counts below are 0 today. The logic is
--    still written for real, not left as a no-op.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  n_kept int;
  n_deleted int;
begin
  update public.posts
     set circle_id = null,
         circle_tab = null,
         hidden_from_moments = false
   where circle_id is not null
     and hidden_from_moments = false;
  get diagnostics n_kept = row_count;

  delete from public.posts
   where circle_id is not null
     and hidden_from_moments = true;
  get diagnostics n_deleted = row_count;

  raise notice 'Circle-linked posts: % kept as Moments (unlinked), % deleted (Circle-only threads/Updates)', n_kept, n_deleted;
end
$$;

-- circle_members cascades from this. Tables, columns, functions and
-- policies are left in place — see header. The one live Circle
-- ("Students moving to NYC", 2 members) is exported in
-- 20260924090000_spaces_rework_export.sql before this runs.
delete from public.circles;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Check it
-- ─────────────────────────────────────────────────────────────────────────
-- Should be 0, but the relations should still exist (no error):
-- select count(*) from public.circles;
-- select count(*) from public.circle_members;
-- Confirmed dropped:
-- select * from public.spaces;
-- select * from public.space_members;
-- select column_name from information_schema.columns where table_name = 'messages' and column_name = 'space_id';
--
-- Should be unaffected — DM messaging keeps working:
-- select policyname from pg_policies where tablename = 'messages';
--
-- ─────────────────────────────────────────────────────────────────────────
-- Phase 6 TODO (not run here — write this as its own migration then):
--   Once CirclesContext.tsx, Circles.tsx, CircleBoard.tsx, CategoryFeed.tsx's
--   Circles tab, AdminCircles.tsx, CreateCircleDialog.tsx, CirclesJoined.tsx,
--   CircleRoster.tsx, CirclesRail.tsx and MomentCard.tsx's Circle-composer
--   path are removed or updated to stop querying these tables/columns:
--     drop policy "circle threads follow the circle's visibility" on posts;
--     alter table posts drop constraint posts_circle_tab_check;
--     alter table posts drop column circle_id, drop column circle_tab,
--       drop column answered, drop column hidden_from_moments;
--     drop function set_thread_answered(bigint, boolean);
--     drop table circle_members; drop table circles;
--     drop function owns_circle(bigint, uuid), is_circle_member(bigint, uuid),
--       real_circle_member_counts(), rl_circles(), rl_circle_members();
--   sql/spaces-admin.sql's space_usage() and admin_move_space_content()
--   both reference public.circles (a 'circles' usage count, and moving a
--   Circle's hobby_slug) — update both to drop that reference in the same
--   migration, or they'll error the next time an admin calls them.
