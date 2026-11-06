-- Soosh: the Founding Stub (20261118000000_founding_stub.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and everything
-- rolls back (including the flag changes). No select-into, no returning-into, no delete.
--
-- Fixed ids: A …8001 (first poster), B …8002 (second poster). Corner 'sports-fitness/vcheck-founding'.
-- Every count is scoped to these ids / that Corner key.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000008001';
  v_b uuid := '00000000-0000-4000-8000-000000008002';
  v_key text := 'sports-fitness/vcheck-founding';
  v_post bigint;
begin
  if to_regprocedure('private.award_founding_stub()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261118000000_founding_stub.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@founding-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-b@founding-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into public.corners (space_slug, slug, name) values ('sports-fitness', 'vcheck-founding', 'Vcheck founding');

  -- 1. The flag is seeded off.
  v_i := v_i + 1;
  v_n := (select count(*) from public.app_config ac where ac.key = 'founding_stub_enabled' and ac.value = 'false'::jsonb);
  results := array_append(results, case when v_n = 1 then format('%s PASS (flag exists and is false)', v_i)
                                        else format('%s FAIL (flag rows %s)', v_i, v_n) end);

  -- 2. Flag off: a first public Moment with a city earns nothing.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_a, 'sports-fitness', 'vcheck-founding', 'written', 'off', 'everyone', 'New York');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'founding' and s.corner_key = v_key);
  results := array_append(results, case when v_n = 0 then format('%s PASS (flag off: no Stub)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- Turn it on. Earlier Moments are not "first" any more, so use a second city.
  update public.app_config set value = 'true'::jsonb where public.app_config.key = 'founding_stub_enabled';

  -- 3. A friends-only Moment earns nothing; a public one with no city earns nothing.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_a, 'sports-fitness', 'vcheck-founding', 'written', 'friends', 'friends', 'Austin'),
         (v_a, 'sports-fitness', 'vcheck-founding', 'written', 'nocity', 'everyone', null);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'founding' and s.corner_key = v_key);
  results := array_append(results, case when v_n = 0 then format('%s PASS (friends-only and no-city Moments earn nothing)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- 4. The first public Moment in Austin earns one, for its author, with the city.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_a, 'sports-fitness', 'vcheck-founding', 'written', 'first', 'everyone', 'Austin');
  v_post := (select po.id from public.posts po where po.user_id = v_a and po.caption = 'first' and po.corner = 'vcheck-founding');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'founding' and s.corner_key = v_key
            and s.user_id = v_a and s.city = 'Austin' and s.post_id is null);
  results := array_append(results, case when v_n = 1 then format('%s PASS (first public Moment in a city earns one)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- 5. A second person posting there later earns nothing.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_b, 'sports-fitness', 'vcheck-founding', 'written', 'second', 'everyone', ' austin ');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'founding' and s.corner_key = v_key and s.city ilike 'austin');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a second poster, same city, earns nothing)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- 6. Another city is its own first.
  insert into public.posts (user_id, hobby_slug, corner, type, caption, audience, city)
  values (v_b, 'sports-fitness', 'vcheck-founding', 'written', 'other city', 'everyone', 'Boston');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'founding' and s.corner_key = v_key and s.user_id = v_b and s.city = 'Boston');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a different city has its own first)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- 7. Deleting the Moment keeps the Stub (post_id is null, so nothing cascades), and posting
  --    again in the same city does not award a second one. Checked read-only: the cascade
  --    rule on stubs.post_id plus the unique index, rather than a DELETE.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_indexes pi where pi.schemaname = 'public' and pi.indexname = 'stubs_founding_key'
            and pi.indexdef ilike '%unique%');
  results := array_append(results, case when v_n = 1 then format('%s PASS (unique index stubs_founding_key exists)', v_i)
                                        else format('%s FAIL (no unique index)', v_i) end);
  begin
    insert into public.stubs (user_id, kind, corner_key, city) values (v_b, 'founding', v_key, 'AUSTIN');
    results := array_append(results, format('%s FAIL (a second Austin founding Stub was allowed)', v_i + 1));
  exception
    when unique_violation then
      results := array_append(results, format('%s PASS (a second Austin founding Stub is refused)', v_i + 1));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i + 1, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;

  -- 8. A founding Stub needs a city.
  v_i := v_i + 1;
  begin
    insert into public.stubs (user_id, kind, corner_key) values (v_b, 'founding', v_key);
    results := array_append(results, format('%s FAIL (a founding Stub with no city was allowed)', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS (a founding Stub with no city is refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
