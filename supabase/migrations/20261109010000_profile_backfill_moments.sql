-- Profile backfill: old Moments keep showing.
--
-- Run AFTER 20261109000000_profile_roles_and_planning.sql.
--
-- Moments made before the profile migration have no visible_at and no private
-- row. This sets occurred_at = created_at (in public.post_private) and
-- visible_at = created_at, so every old Moment is visible straight away and
-- reads as made when it was posted. Idempotent: it only fills what is empty,
-- so a Moment made after the first migration (which got its own values) is
-- never touched.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261109010000_profile_backfill_moments.sql.

insert into public.post_private (post_id, user_id, occurred_at)
select po.id, po.user_id, po.created_at
  from public.posts po
 where not exists (select 1 from public.post_private pp where pp.post_id = po.id);

update public.posts po set visible_at = po.created_at where po.visible_at is null;
