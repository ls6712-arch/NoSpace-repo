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
-- counts):
--
--   1. Circles — real (sql/circles.sql: `circles`, `circle_members`) and
--      the Circle-thread columns sql/circle-threads.sql added to `posts`.
--      Circles are retired entirely by this rework ("a clean break with no
--      leftover Circle rows or columns" — explicit instruction). The one
--      live Circle had zero threads posted (0 rows with circle_id set), so
--      there is nothing to unlink-and-keep here the way a Moment or
--      Pursuit linked to a Circle would be — see the "nothing to unlink"
--      note in section 2 below.
--
--   2. sql/connections.sql's `spaces`/`space_members` and its
--      `is_space_member(bigint, uuid)` — an earlier, unrelated "user-made
--      Spaces" feature, confirmed unreachable from any current page, that
--      happens to collide by name with this rework's own Space model.
--      messages.space_id (added by the same file, for Space-scoped
--      messaging) goes with it; the two `messages` RLS policies that
--      referenced it are narrowed back down to their connections-only form
--      (DM messaging itself — to_user/from_user — is untouched and stays
--      live).
--
-- The 15 old hobby-Spaces (as browsable communities) are NOT touched here:
-- their "membership" (hobby_follows) stays, repurposed as the private
-- Interests list, and posts.hobby_slug/sub_hobby/corner are unchanged. See
-- 20260924090000's header for why there's nothing to export or delete for
-- them.
--
-- NOT safe to blindly re-run against a database that has already had this
-- migration applied once and then had new Circles/old-style Spaces created
-- since — every statement here is a DROP, and a second real Circle created
-- after the first run would be silently deleted by a second run with no
-- new backup taken. Re-running immediately after a failed first attempt
-- (nothing new created in between) is fine; the DROP/ALTER ... IF EXISTS
-- guards make that idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. sql/connections.sql's spaces/space_members/is_space_member, and the
--    messages columns/policies built on top of them.
-- ─────────────────────────────────────────────────────────────────────────

-- Narrow the two messaging policies back to connections-only before the
-- column they reference is gone, so `messages` is never left without a
-- working SELECT/INSERT policy mid-migration.
drop policy if exists "you read messages meant for you" on public.messages;
create policy "you read messages meant for you"
  on public.messages for select
  using (
    to_user is not null
    and (auth.uid() = from_user or auth.uid() = to_user)
    and public.are_connected(from_user, to_user)
  );

drop policy if exists "you write to connections and your spaces" on public.messages;
create policy "you write to connections and your spaces"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and to_user is not null
    and public.are_connected(auth.uid(), to_user)
  );

-- Drops messages_space_idx and the space_id -> spaces(id) FK along with the
-- column itself.
alter table public.messages drop column if exists space_id;

drop policy if exists "you can leave, the owner can remove" on public.space_members;
drop policy if exists "you answer your own invitation" on public.space_members;
drop policy if exists "members invite" on public.space_members;
drop policy if exists "you see membership of spaces you are in" on public.space_members;
drop table if exists public.space_members;

drop policy if exists "the owner removes the space" on public.spaces;
drop policy if exists "the owner edits the space" on public.spaces;
drop policy if exists "you can make a space" on public.spaces;
drop policy if exists "spaces are visible to members and by invitation" on public.spaces;
drop table if exists public.spaces;

drop function if exists public.is_space_member(bigint, uuid);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Circles.
--
--    A Circle-linked post splits in two, by `hidden_from_moments` — the
--    flag the Circle composer sets unless its own "Also save to Moments"
--    box is checked (sql/circle-threads.sql):
--      - hidden_from_moments = false: this post IS (also) a real Moment —
--        it already shows in its author's own Moments shelf. Unlink it
--        (clear circle_id/circle_tab) and keep it, same as
--        admin_delete_circle('keep_private') already does per-Circle.
--      - hidden_from_moments = true: this post only ever existed as a
--        Circle-only thread/"Update" — it was never shown as a Moment.
--        Delete it with the Circle, same as
--        admin_delete_circle('delete') does per-Circle.
--    (Pursuits can't be linked to a Circle at all — sql/pursuits.sql's
--    `pursuits` table has no circle_id/space_id column — so there is no
--    Pursuit-unlinking step here.)
--
--    Confirmed against live data before writing this file: 0 posts have
--    circle_id set at all, so both counts below are 0 today. The logic is
--    still written for real, not left as a no-op, so it's correct if this
--    ever runs against a database where that's no longer true.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "circle threads follow the circle's visibility" on public.posts;

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

alter table public.posts drop constraint if exists posts_circle_tab_check;
alter table public.posts drop column if exists circle_id;
alter table public.posts drop column if exists circle_tab;
alter table public.posts drop column if exists answered;
alter table public.posts drop column if exists hidden_from_moments;

drop function if exists public.set_thread_answered(bigint, boolean);

drop table if exists public.circle_members;
drop table if exists public.circles;

drop function if exists public.owns_circle(bigint, uuid);
drop function if exists public.is_circle_member(bigint, uuid);
drop function if exists public.real_circle_member_counts();
drop function if exists public.rl_circles();
drop function if exists public.rl_circle_members();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Check it
-- ─────────────────────────────────────────────────────────────────────────
-- Should all return zero rows / relation-does-not-exist:
-- select * from public.circles;
-- select * from public.circle_members;
-- select * from public.spaces;
-- select * from public.space_members;
-- select column_name from information_schema.columns where table_name = 'posts' and column_name in ('circle_id','circle_tab','answered','hidden_from_moments');
-- select column_name from information_schema.columns where table_name = 'messages' and column_name = 'space_id';
--
-- Should be unaffected — DM messaging keeps working:
-- select policyname from pg_policies where tablename = 'messages';
