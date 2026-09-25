-- Sushii: Spaces Rework — set_space_corners RPC for Edit Space's now-
-- editable Corners picker.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260929000000_spaces_rework_phase5_notification_fixes.sql.
--
-- Found in review: the client's first pass at "Corners editable in Edit
-- Space" did the swap as two separate calls — delete every space_corners
-- row for the Space, then insert the new set — straight through
-- space_corners' own "hosts manage their space's corners" policy. If the
-- insert failed after the delete succeeded (a dropped connection, a
-- blocked/oversized batch, anything), the Space was left with zero
-- Corners and no way back short of a manual fix — two round trips, no
-- transaction tying them together.
--
-- set_space_corners(p_space_id, p_corner_ids) replaces both calls with one
-- RPC: same validation create_space already applies to p_corner_ids (1-3,
-- no duplicates, every id a real Corner), host-only and active-Space-only
-- like update_space, and the delete+insert happens inside this function's
-- own single transaction — plpgsql wraps a function body in one
-- transaction implicitly, so a failure partway through (the corner-count
-- trigger, the one-primary unique index) rolls back the delete too,
-- never leaving the Space's Corners short.
--
-- With this in place, space_corners no longer needs a client-writable
-- policy at all — every write (create_space, this function) goes through
-- a SECURITY DEFINER function now. The "hosts manage their space's
-- corners" policy (ALL, host-only) is dropped; "space corners are as
-- visible as the space" (SELECT) is untouched, so reads are unaffected.
--
-- Safe to re-run: create-or-replace / drop-policy-if-exists throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. set_space_corners
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_space_corners(p_space_id uuid, p_corner_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corner_count int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);

  if p_corner_ids is null or coalesce(array_length(p_corner_ids, 1), 0) < 1 then
    raise exception 'Pick at least 1 Corner.';
  end if;
  if array_length(p_corner_ids, 1) > 3 then
    raise exception 'A Space can have at most 3 Corners.';
  end if;
  if array_length(p_corner_ids, 1) <> (select count(distinct x) from unnest(p_corner_ids) as x) then
    raise exception 'Pick 3 different Corners.';
  end if;
  select count(*) into v_corner_count from corners where corners.id = any(p_corner_ids);
  if v_corner_count <> array_length(p_corner_ids, 1) then
    raise exception 'One of those Corners doesn''t exist.';
  end if;

  delete from space_corners where space_corners.space_id = p_space_id;

  insert into space_corners (space_id, corner_id, is_primary)
  select p_space_id, picked.corner_id, picked.ord = 1
  from unnest(p_corner_ids) with ordinality as picked(corner_id, ord);
end;
$$;
revoke all on function public.set_space_corners(uuid, bigint[]) from public, anon;
grant execute on function public.set_space_corners(uuid, bigint[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. space_corners: drop the direct host write policy. create_space and
--    set_space_corners are the only writers now, both SECURITY DEFINER;
--    the SELECT policy (space_corners' own visibility, unchanged) still
--    lets anyone read a non-deleted Space's Corners directly.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "hosts manage their space's corners" on public.space_corners;
