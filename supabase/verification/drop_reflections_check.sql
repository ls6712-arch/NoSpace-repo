-- Verifies 20261022000000_drop_reflections.sql. Run AFTER that migration.
-- Not a migration: nothing here alters the schema.
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so the run rolls back whatever the outcome.
-- No fixtures are created, so there is nothing to clean up.

begin;

do $$
declare
  results text[] := '{}';
  v_n int;
begin
  -- The table is gone.
  if to_regclass('public.post_reflections') is null then
    results := array_append(results, 'PASS table post_reflections is gone');
  else
    results := array_append(results, 'FAIL table post_reflections still exists');
  end if;

  -- The column is gone (scoped to the one table it lived on).
  v_n := (
    select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'reflection'
  );
  if v_n = 0 then
    results := array_append(results, 'PASS posts.reflection is gone');
  else
    results := array_append(results, 'FAIL posts.reflection still exists');
  end if;

  -- posts itself is intact: its id column is still there.
  v_n := (
    select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'id'
  );
  if v_n = 1 then
    results := array_append(results, 'PASS posts table intact');
  else
    results := array_append(results, 'FAIL posts table is missing its id column');
  end if;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
