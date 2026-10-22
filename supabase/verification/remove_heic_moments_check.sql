-- Read-only check for 20261025000000_remove_heic_moments.sql.
-- Safe to run before or after the migration. It never changes anything:
-- it ends in raise exception, so the transaction always rolls back.
--
-- Before the merge, expect: PASS links, and "targets_remaining=11".
-- After the merge, expect:  PASS links, PASS targets_gone, PASS no_heic_left.
begin;
do $$
declare
  results text[] := '{}';
  v_targets bigint[] := array[
    100033, 100043, 100051, 100052, 100053, 100054,
    100055, 100056, 100058, 100102, 100104
  ];
  v_remaining int;
  v_heic int;
  v_bad_links int;
begin
  -- 1. Every table that points at posts must cascade or clear the link,
  --    otherwise the delete would fail or leave a dangling id.
  v_bad_links := (
    select count(*)
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.posts'::regclass
      and c.confdeltype not in ('c', 'n')
  );
  results := results || case when v_bad_links = 0
    then 'PASS links' else 'FAIL links: ' || v_bad_links || ' foreign keys block deletes' end;

  -- 2. How many of the 11 target Moments still exist.
  v_remaining := (
    select count(*) from public.posts p where p.id = any(v_targets)
  );
  results := results || case when v_remaining = 0
    then 'PASS targets_gone' else 'targets_remaining=' || v_remaining end;

  -- 3. Any Moment anywhere still pointing at a HEIC file.
  v_heic := (
    select count(*)
    from public.posts p
    where exists (
      select 1
      from unnest(coalesce(p.media_urls, '{}'::text[]) || p.media_url) as u(url)
      where u.url ilike '%.heic'
    )
  );
  results := results || case when v_heic = 0
    then 'PASS no_heic_left' else 'heic_moments=' || v_heic end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;
rollback;
