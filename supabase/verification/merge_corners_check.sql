-- Verifies 20261019000000_merge_corners.sql. Run AFTER it.
--
-- Read-only: it creates no fixtures and changes nothing. One transaction, one
-- do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' and
-- rolls back (see CLAUDE.md). No SELECT/RETURNING INTO and no DELETE; every value
-- is assigned with :=.
--
-- The Corner that was merged away is "Food photography" in the Food & Cooking
-- group: space_slug 'food-cooking', slug 'food-photography', hobby key
-- 'food-cooking:food-photography'. Nothing should reference it any more.
--
-- Run it once the production deploy is Ready, and again a day later. A FAIL the
-- second time is not necessarily the migration: the Food photography Corner is
-- still in the picker of the client that was live before the new code, so a
-- public Moment posted from an old browser tab can re-create the Corner row
-- (and be counted below). Every count is scoped to that one Corner.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
begin
  -- 1. The Corner row itself is gone.
  v_i := v_i + 1;
  v_n := (select count(*) from public.corners c
    where c.space_slug = 'food-cooking' and c.slug = 'food-photography');
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 0 then 'PASS no food-photography row in corners' else 'FAIL corners rows=' || v_n end));

  -- 2. No Moment is still filed under it.
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts p
    where p.hobby_slug = 'food-cooking' and coalesce(p.corner, p.sub_hobby) = 'food-photography');
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 0 then 'PASS no Moments reference it' else 'FAIL posts=' || v_n end));

  -- 3. No Pursuit still points at it, by slug or by name.
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuits p
    where p.hobby_slug = 'food-cooking'
      and (p.sub_hobby = 'food-photography'
        or lower(btrim(p.interest)) in ('food photography', 'food-photography')));
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 0 then 'PASS no Pursuits reference it' else 'FAIL pursuits=' || v_n end));

  -- 4. No Space is linked to it.
  v_i := v_i + 1;
  v_n := (select count(*) from public.space_corners sc
    where sc.corner_id in (select c.id from public.corners c
                            where c.space_slug = 'food-cooking' and c.slug = 'food-photography'));
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 0 then 'PASS no Space links to it' else 'FAIL space_corners=' || v_n end));

  -- 5. Nobody follows it.
  v_i := v_i + 1;
  v_n := (select count(*) from public.hobby_follows hf
    where hf.hobby_key = 'food-cooking:food-photography');
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 0 then 'PASS no follows of it' else 'FAIL hobby_follows=' || v_n end));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
