-- Sushii: Spaces Rework — a host's own Moments skip approval, plus a real
-- approve/decline path for the ones that don't.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261004000000_spaces_rework_moments_pin_limit.sql.
--
-- Found via the Sushii Space (posting_mode = 'approval'): "Lego roses"
-- (post 100103) sat at status = 'pending' with no way for a host to ever
-- move it to 'approved' short of editing the row directly in the SQL
-- editor — set_space_moment_status() (20260925010000) only ever looked at
-- the Space's posting_mode, so a host posting into their own
-- approval-mode Space was stuck waiting on themselves, and there was no
-- approve/decline RPC at all for the ordinary case of a member's Moment.
--
-- Three things, in one migration since they're one fix:
--   1. set_space_moment_status(): 'approved' when the poster is an active
--      host of the Space, regardless of posting_mode.
--   2. Backfill: existing pending links whose author is already an active
--      host move to 'approved' now, retroactively — reports the count via
--      RAISE NOTICE in the Editor's Messages panel.
--   3. approve_space_moment / decline_space_moment: the host-side review
--      RPCs that didn't exist before. Approve sets status = 'approved';
--      decline deletes the link only (posts.id is unaffected — space_
--      moments.post_id has no cascade back onto posts — so the author's
--      post stays in their own log either way, same as unlink_my_moment
--      already relies on for a self-unlink).
--
-- Safe to re-run: create-or-replace throughout; the backfill UPDATE is
-- idempotent (its own WHERE clause only ever matches already-pending
-- rows, so a second run just reports 0).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. A host's own Moment is approved on the way in, even in an
--    approval-mode Space — they don't need their own sign-off.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posting_mode text;
  v_author_id uuid;
begin
  select posting_mode into v_posting_mode from spaces where id = new.space_id;
  select user_id into v_author_id from posts where id = new.post_id;

  if v_posting_mode = 'approval' and not public.is_space_host(new.space_id, v_author_id) then
    new.status := 'pending';
  else
    new.status := 'approved';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Backfill — existing pending links whose author is already an active
--    host, same rule as above, applied retroactively.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_count int;
begin
  update space_moments sm
  set status = 'approved'
  where sm.status = 'pending'
    and exists (
      select 1 from posts p
      join space_members m
        on m.space_id = sm.space_id and m.user_id = p.user_id and m.role = 'host' and m.status = 'active'
      where p.id = sm.post_id
    );
  get diagnostics v_count = row_count;
  raise notice 'Backfilled % pending space_moments to approved (host authors).', v_count;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. approve_space_moment / decline_space_moment — the Manage tab's
--    approval queue calls these. Same shape as feature_event/cancel_rsvp:
--    host check, assert_space_active, then the write, with a not-found
--    guard so a stale queue row (already actioned, or the post deleted)
--    fails with a specific message instead of silently no-op'ing.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.approve_space_moment(p_space_id uuid, p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);

  update space_moments set status = 'approved'
  where space_moments.space_id = p_space_id and space_moments.post_id = p_post_id;
  if not found then
    raise exception 'That Moment link no longer exists.';
  end if;
end;
$$;
revoke all on function public.approve_space_moment(uuid, bigint) from public, anon;
grant execute on function public.approve_space_moment(uuid, bigint) to authenticated;

create or replace function public.decline_space_moment(p_space_id uuid, p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  perform public.assert_space_active(p_space_id);

  delete from space_moments
  where space_moments.space_id = p_space_id and space_moments.post_id = p_post_id;
  if not found then
    raise exception 'That Moment link no longer exists.';
  end if;
end;
$$;
revoke all on function public.decline_space_moment(uuid, bigint) from public, anon;
grant execute on function public.decline_space_moment(uuid, bigint) to authenticated;
