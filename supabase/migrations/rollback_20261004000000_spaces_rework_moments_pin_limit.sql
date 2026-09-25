-- Rollback for 20261004000000_spaces_rework_moments_pin_limit.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the original "at most 1 featured Moment" unique index and
-- drops the "at most 3" trigger/function this migration added.
--
-- Not a recommendation: rolling this back while any Space has 2-3
-- Moments simultaneously pinned will fail outright (the unique index
-- can't be created over existing duplicates) — unpin down to at most one
-- per Space first, and this also un-does the paired frontend pin/unpin UI
-- (SpaceHomeTab.tsx), which now expects up to 3.

drop trigger if exists space_moments_featured_limit on public.space_moments;
drop function if exists public.check_space_moments_featured_limit();

create unique index if not exists space_moments_one_featured
  on public.space_moments (space_id) where featured = true;
