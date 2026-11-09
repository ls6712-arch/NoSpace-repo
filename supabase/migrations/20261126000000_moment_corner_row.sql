-- Soosh: a Moment can be saved into any Corner again.
--
-- Rollback: rollback_20261126000000_moment_corner_row.sql.
-- Verification: supabase/verification/moment_corner_row_check.sql.
--
-- The bug. posts_corner_fkey requires (posts.hobby_slug, posts.corner) to be a row in public.corners.
-- Until 20261030210601_profile_roles_and_planning.sql, the corners_sync trigger made that row when the
-- first Moment arrived. That migration moved the row (and its count) to release_moment(), which runs
-- when the 2-hour hold ends. The foreign key is checked at insert, two hours earlier, so a Moment into
-- any Corner that had never had a row failed with 23503 (HTTP 409). On Nov 9, 2026, live had 6 Corner
-- rows and the catalog has about 300 Corners, so posting into almost any Corner failed (Gardening and
-- Vegetable gardening among them), and so did moving a Moment into one from the Posted screen.
--
-- The fix. A BEFORE INSERT / UPDATE OF hobby_slug, corner trigger on posts makes the Corner row, with
-- moment_count 0, when it is missing. Counting is unchanged: release_moment() still adds 1 when the
-- Moment is released, and corners_sync still moves the count on later edits.
--   * Only a well-formed slug (lowercase letters, digits, single hyphens, at most 60 characters) in a
--     Space that exists in public.categories gets a row. Anything else is left to the foreign key,
--     which rejects it as before.
--   * The existence check runs first, so a Moment into a Corner that already has a row never touches
--     the corners_insert rate limit (rl_corners fires before ON CONFLICT is considered).
--   * If the row cannot be made (rate limit, blocklisted name), the error is caught and logged as a
--     warning, and the foreign key decides, so this can never make a save fail that would have worked.
--   * The name is the slug in sentence case ("vegetable-gardening" -> "Vegetable gardening"). The app
--     shows a catalog Corner by its catalog name, so this only matters for a Corner a member typed.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

create or replace function private.posts_ensure_corner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := nullif(new.corner, '');
  v_name text;
begin
  if new.hobby_slug is null or v_slug is null then
    return new;
  end if;
  if exists (select 1 from public.corners c where c.space_slug = new.hobby_slug and c.slug = v_slug) then
    return new;
  end if;
  if char_length(v_slug) > 60 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return new;
  end if;
  if not exists (select 1 from public.categories cat where cat.slug = new.hobby_slug) then
    return new;
  end if;

  v_name := upper(left(v_slug, 1)) || replace(substr(v_slug, 2), '-', ' ');
  begin
    insert into public.corners (space_slug, slug, name, moment_count)
    values (new.hobby_slug, v_slug, v_name, 0)
    on conflict (space_slug, slug) do nothing;
  exception when others then
    raise warning 'Corner row not created for %/%: % %', new.hobby_slug, v_slug, sqlstate, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function private.posts_ensure_corner() from public, anon, authenticated;

drop trigger if exists posts_aa_ensure_corner on public.posts;
create trigger posts_aa_ensure_corner
  before insert or update of hobby_slug, corner on public.posts
  for each row execute function private.posts_ensure_corner();
