-- Soosh: Step 4, the 18 categories (public.corner_categories and
-- corners.category_slug).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261027000000_corner_categories_18.sql. Run before it, the script stops at
-- the first check and says so ("NOT APPLIED"); it never creates anything then.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results land
-- in the error message the Editor shows and a rollback is guaranteed whatever
-- happens. Each expected failure is its own begin...exception...end sub-block
-- that names the exact sqlstate it expects (23503, 23514, 23505, 42501);
-- anything else is recorded as 'N ERROR <sqlstate>: <message>', never as a pass.
-- No select-into, no returning-into, no delete (per CLAUDE.md).
--
-- Fixtures, all rolled back, all with their own ids:
--   Corner  crafts-making / step4-check-corner  (category yarn-fabric)
--   (no auth user is needed: a made-up uuid is simply not an admin)
-- Every count is scoped to those ids or to the 18 / 15 / 6 known slugs, never a
-- bare count of a live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_corner_id bigint;
  v_def text;
  -- The 18, in sort order (docs/categories-18.md).
  v_slugs text[] := array[
    'yarn-fabric', 'crafts-diy', 'art-design', 'tech-tinkering', 'food-drink', 'running-fitness',
    'sports-martial-arts', 'dance-stage', 'outdoors-adventure', 'home-garden', 'games-puzzles',
    'music-sound', 'photo-film', 'reading-writing', 'skills-side-projects', 'collecting-style',
    'culture-community', 'rest-ritual'
  ];
  v_names text[] := array[
    'Yarn and fabric', 'Crafts and DIY', 'Art and design', 'Tech and tinkering', 'Food and drink',
    'Running and fitness', 'Sports and martial arts', 'Dance and stage', 'Outdoors and adventure',
    'Home and garden', 'Games and puzzles', 'Music and sound', 'Photo and film', 'Reading and writing',
    'Skills and side projects', 'Collecting and style', 'Culture and community', 'Rest and ritual'
  ];
  -- The 15 old Spaces (public.categories), which this migration must not touch.
  v_old text[] := array[
    'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making', 'books-writing', 'nature-outdoors',
    'home-garden', 'gaming-tabletop', 'music', 'photography-film', 'health-wellness', 'fashion-beauty',
    'tech-building', 'collecting-fandom', 'travel-adventure'
  ];
begin
  v_owner_role := current_user;

  if to_regclass('public.corner_categories') is null
     or not exists (
       select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'corners' and c.column_name = 'category_slug'
     ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261027000000_corner_categories_18.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (table-owner) role, bypasses RLS.
  insert into public.corners (space_slug, slug, name, category_slug)
  values ('crafts-making', 'step4-check-corner', 'Step4 check corner', 'yarn-fabric');
  v_corner_id := (
    select c.id from public.corners c
    where c.space_slug = 'crafts-making' and c.slug = 'step4-check-corner'
  );

  -- 1. All 18 slugs exist.
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_categories cc where cc.slug = any (v_slugs));
  results := array_append(results, format('%s %s', v_i, case when v_n = 18 then 'PASS' else 'FAIL (found ' || v_n || ')' end));

  -- 2. Sort order is 1..18 in exactly the approved order.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when
    (select array_agg(cc.slug order by cc.sort_order) from public.corner_categories cc where cc.slug = any (v_slugs)) = v_slugs
    and (select array_agg(cc.sort_order order by cc.sort_order) from public.corner_categories cc where cc.slug = any (v_slugs)) = (select array_agg(g) from generate_series(1, 18) g)
    then 'PASS' else 'FAIL' end));

  -- 3. Names are exactly the approved names, in that order.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when
    (select array_agg(cc.name order by cc.sort_order) from public.corner_categories cc where cc.slug = any (v_slugs)) = v_names
    then 'PASS' else 'FAIL' end));

  -- 4. Every one has a description and is active.
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_categories cc where cc.slug = any (v_slugs) and cc.active and char_length(cc.description) > 0);
  results := array_append(results, format('%s %s', v_i, case when v_n = 18 then 'PASS' else 'FAIL (' || v_n || ')' end));

  -- 5. The 17 new slugs are NOT in public.categories (they would show up as
  --    custom Spaces). home-garden is the one shared slug, so it is excluded.
  v_i := v_i + 1;
  v_n := (select count(*) from public.categories c where c.slug = any (v_slugs) and c.slug <> 'home-garden');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL (' || v_n || ' leaked into categories)' end));

  -- 6. All 15 old Spaces are still there.
  v_i := v_i + 1;
  v_n := (select count(*) from public.categories c where c.slug = any (v_old));
  results := array_append(results, format('%s %s', v_i, case when v_n = 15 then 'PASS' else 'FAIL (' || v_n || ')' end));

  -- 7. The 6 database Corners carry the approved category, in their old Space.
  v_i := v_i + 1;
  v_n := (
    select count(*) from public.corners c
    join (values
      ('books-writing', 'reading', 'reading-writing'),
      ('food-cooking', 'cooking', 'food-drink'),
      ('food-cooking', 'storytelling', 'reading-writing'),
      ('photography-film', 'photography', 'photo-film'),
      ('tech-building', 'web-design', 'skills-side-projects'),
      ('travel-adventure', 'travel', 'outdoors-adventure')
    ) as m (space_slug, corner_slug, category_slug)
      on c.space_slug = m.space_slug and c.slug = m.corner_slug and c.category_slug = m.category_slug
  );
  results := array_append(results, format('%s %s', v_i, case when v_n = 6 then 'PASS' else 'FAIL (' || v_n || ' of 6)' end));

  -- 8. The fixture Corner took its category.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when
    (select c.category_slug from public.corners c where c.id = v_corner_id) = 'yarn-fabric'
    then 'PASS' else 'FAIL' end));

  -- 9. posts still ties a Moment to (hobby_slug, corner) in corners, unchanged.
  v_i := v_i + 1;
  v_def := (select pg_get_constraintdef(k.oid) from pg_constraint k where k.conname = 'posts_corner_fkey' and k.conrelid = 'public.posts'::regclass);
  results := array_append(results, format('%s %s', v_i, case when v_def like 'FOREIGN KEY (hobby_slug, corner) REFERENCES corners(space_slug, slug)%' then 'PASS' else 'FAIL (' || coalesce(v_def, 'missing') || ')' end));

  -- 10. The category FK carries a renamed slug along (on update cascade).
  v_i := v_i + 1;
  v_n := (
    select count(*) from pg_constraint k
    where k.conrelid = 'public.corners'::regclass and k.confrelid = 'public.corner_categories'::regclass
      and k.contype = 'f' and k.confupdtype = 'c'
  );
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL (' || v_n || ')' end));

  -- 11. Row level security is on.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when
    (select c.relrowsecurity from pg_class c where c.oid = 'public.corner_categories'::regclass)
    then 'PASS' else 'FAIL' end));

  -- 12. Expected failure: an unknown category on a Corner (23503).
  v_i := v_i + 1;
  begin
    update public.corners set category_slug = 'step4-no-such-category' where corners.id = v_corner_id;
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when foreign_key_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 13. Expected failure: a slug with spaces and capitals (23514).
  v_i := v_i + 1;
  begin
    insert into public.corner_categories (slug, name, description, sort_order)
    values ('Step4 Bad Slug', 'Bad', 'Bad', 9001);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 14. Expected failure: a second category with an existing sort_order (23505).
  v_i := v_i + 1;
  begin
    insert into public.corner_categories (slug, name, description, sort_order)
    values ('step4-check-dup', 'Dup', 'Dup', 1);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when unique_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 15. A signed-in non-admin can read the 18 ...
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009999"}', true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_categories cc where cc.slug = any (v_slugs));
  results := array_append(results, format('%s %s', v_i, case when v_n = 18 then 'PASS' else 'FAIL (' || v_n || ')' end));

  -- 16. ... but cannot add one (42501: the row level security policy).
  v_i := v_i + 1;
  begin
    insert into public.corner_categories (slug, name, description, sort_order)
    values ('step4-check-nonadmin', 'Nope', 'Nope', 9002);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 17. ... and an update by a non-admin changes no row (the policy hides them).
  v_i := v_i + 1;
  begin
    update public.corner_categories set name = 'Renamed by a non-admin' where corner_categories.slug = 'yarn-fabric';
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL (' || v_n || ' rows)' end));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Done. This is the ONLY way this block ends: the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
