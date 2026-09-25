-- Sushii: Spaces Rework — allow up to 3 pinned ("featured") Moments per
-- Space instead of just 1.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261003000000_spaces_rework_pending_count_message.sql.
--
-- Space Home feedback: hosts now get a "Pin to Home" / "Unpin" control on
-- each Moment card, and the Home tab groups up to 3 pinned Moments first
-- ("Pinned by the hosts"), ahead of the rest. The original schema
-- (20260924110000) only ever allowed exactly one featured Moment at a
-- time, enforced by the unique partial index space_moments_one_featured —
-- that index is dropped here and replaced with a trigger that allows up to
-- 3, raising the same friendly message the client shows verbatim on a
-- host's client-side pre-check ("Unpin one first.") as its server-side
-- backstop. Same "at most N" trigger shape as check_space_corners_limit()
-- in the original schema migration, just on UPDATE (and INSERT) rather
-- than INSERT alone, since a Moment starts unfeatured and is pinned later
-- via UPDATE.
--
-- Safe to re-run: drop-if-exists / create-or-replace throughout.

drop index if exists space_moments_one_featured;

create or replace function public.check_space_moments_featured_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.featured and (tg_op = 'INSERT' or not old.featured) then
    if (select count(*) from space_moments where space_moments.space_id = new.space_id and space_moments.featured = true) >= 3 then
      raise exception 'Unpin one first.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists space_moments_featured_limit on public.space_moments;
create trigger space_moments_featured_limit
  before insert or update on public.space_moments
  for each row execute function public.check_space_moments_featured_limit();
