-- Rollback for 20260930000000_spaces_rework_set_space_corners.sql.
--
-- Draft only — staged for review, not run.
--
-- Drops set_space_corners and restores space_corners' original host-only
-- write policy (verbatim from 20260924110000_spaces_rework_schema.sql).
--
-- Not a recommendation: rolling this back reopens the two-round-trip
-- delete+insert-through-RLS path this migration replaced, with the
-- partial-failure risk (a Space left with zero Corners if the insert
-- fails after the delete succeeds) that's the exact reason it exists.

drop function if exists public.set_space_corners(uuid, bigint[]);

drop policy if exists "hosts manage their space's corners" on public.space_corners;
create policy "hosts manage their space's corners"
  on public.space_corners for all to authenticated
  using (public.is_space_host(space_id, auth.uid()))
  with check (public.is_space_host(space_id, auth.uid()));
