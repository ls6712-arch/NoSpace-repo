-- Verifies 20261019000000_merge_corners.sql. Run AFTER that migration.
-- Not a migration: nothing here alters the schema.
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so the run rolls back whatever the outcome.
-- No fixtures are created. Every assertion is a predicate on the exact old
-- Corner or group being merged, not a count of a whole table.

begin;

do $$
declare
  results text[] := '{}';
  v_n int;
begin
  v_n := (select count(*) from public.corners c where c.space_slug = 'food-cooking' and c.slug = 'food-photography');
  results := results || (case when v_n = 0 then 'PASS food-photography Corner is gone' else 'FAIL food-photography Corner still exists' end);

  v_n := (select count(*) from public.posts p where coalesce(p.corner, p.sub_hobby) = 'food-photography');
  results := results || (case when v_n = 0 then 'PASS no Moment still uses food-photography' else 'FAIL ' || v_n || ' Moments still use food-photography' end);

  v_n := (select count(*) from public.pursuits pu where pu.sub_hobby = 'food-photography');
  results := results || (case when v_n = 0 then 'PASS no Pursuit still uses food-photography' else 'FAIL ' || v_n || ' Pursuits still use food-photography' end);

  v_n := (select count(*) from public.posts p where p.hobby_slug in ('food-cooking', 'photography-film') and coalesce(p.corner, p.sub_hobby) is null);
  results := results || (case when v_n = 0 then 'PASS no Moment sits in a merged group without a Corner' else 'FAIL ' || v_n || ' Moments have no Corner' end);

  v_n := (select count(*) from public.corners c where (c.space_slug, c.slug) in (('food-cooking', 'cooking'), ('photography-film', 'photography')));
  results := results || (case when v_n = 2 then 'PASS Cooking and Photography Corners exist' else 'FAIL expected 2 target Corners, found ' || v_n end);

  -- moment_count agrees with the public Moments actually filed under each
  -- target Corner (the corners_sync trigger keeps it in step).
  v_n := (
    select count(*) from public.corners c
    where (c.space_slug, c.slug) in (('food-cooking', 'cooking'), ('photography-film', 'photography'))
      and c.moment_count <> (
        select count(*) from public.posts p
        where p.hobby_slug = c.space_slug and coalesce(p.corner, p.sub_hobby) = c.slug and p.visibility = 'public'
      )
  );
  results := results || (case when v_n = 0 then 'PASS moment_count matches public Moments' else 'FAIL ' || v_n || ' target Corners have a stale moment_count' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
