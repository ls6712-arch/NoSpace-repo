-- Sushii: Spaces Rework — new visibility vocabulary (just_me / followers /
-- space / public), backfilling legacy values.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Deliberately WIDENS the posts_visibility_check constraint rather than
-- narrowing it: 'circle' stays a legal value for now. Circle-posting
-- (CircleComposer.tsx, Log.tsx's composer, MomentCard.tsx's switcher) is
-- still live, shipped UI through Phase 5 of the Spaces Rework — narrowing
-- this constraint before that UI is actually removed (Phase 6) would turn
-- every Circle post into a hard database error in the meantime. This
-- migration backfills existing legacy-tagged posts to their new names now
-- (safe, never widens anyone's visibility) and adds the new values
-- alongside the old ones; the old ones (circle, private, friends) get
-- dropped from the constraint in the Phase 6 migration, once nothing can
-- write them anymore.
--
-- Safe to re-run.

-- Backfill first, before touching the constraint, so a mid-migration
-- failure never leaves a row that satisfies neither the old nor new set.
update public.posts set visibility = 'just_me' where visibility = 'private';
update public.posts set visibility = 'followers' where visibility = 'friends';
-- 'circle' is intentionally NOT backfilled here — see note above. It moves
-- to 'just_me' in the Phase 6 migration, once Circle data itself is gone
-- and this is a rename of already-orphaned rows rather than a live tier.

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'followers', 'space', 'just_me', 'circle'));
