-- Soosh: a new Moment is visible to others right away. Holding it for 2 hours is opt-in ("Post in 2 hours").
--
-- Rollback: rollback_20261127000000_moments_visible_at_once.sql.
-- Verification: supabase/verification/moments_visible_at_once_check.sql.
--
-- 20261030210601_profile_roles_and_planning.sql held every new Moment from everyone but its owner for
-- 2 hours unless the owner turned on "Share now" (founder, Nov 9, 2026: no social or hobby app holds
-- posts by default; Instagram, Snapchat, Strava, Pinterest and YouTube publish at once and protect
-- location instead). Now:
--   * posts.visible_at defaults to now();
--   * private.posts_set_visible_at() treats a null visible_at on insert as created_at (right away),
--     where it used to mean created_at + 2 hours. The clamp is unchanged: a requested visible_at is
--     kept between created_at and created_at + 2 hours, so "Post in 2 hours" is the longest hold.
--   * Updates are unchanged.
-- The app always sends visible_at (lib/momentHold.ts), so this only matters for other insert paths.
-- Moments already held when this runs keep their visible_at.

alter table public.posts alter column visible_at set default now();

create or replace function private.posts_set_visible_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created timestamptz := coalesce(new.created_at, now());
begin
  if tg_op = 'INSERT' then
    new.visible_at := least(greatest(coalesce(new.visible_at, v_created), v_created), v_created + interval '2 hours');
  elsif new.visible_at is distinct from old.visible_at then
    -- A Moment that has a visible_at keeps one. (soosh.legacy_rows lets a check
    -- put an old, null row back; nothing in the app sets it.)
    if new.visible_at is null then
      if old.visible_at is not null and coalesce(current_setting('soosh.legacy_rows', true), '') <> 'on' then
        raise exception 'A Moment always has a time it becomes visible.';
      end if;
    else
      new.visible_at := least(greatest(new.visible_at, v_created), v_created + interval '2 hours');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.posts_set_visible_at() from public, anon, authenticated;
