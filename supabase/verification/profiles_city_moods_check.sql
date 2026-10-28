-- Soosh core loop v1, PR 2: profiles.moods (public) and profile_private.city (owner only).
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261030000000_profiles_city_moods.sql. Run before it, the script stops at
-- the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE
-- EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure
-- is its own begin...exception...end sub-block with strict sqlstate handling
-- (23514 for a check violation, 42501 for a privilege error); anything else
-- is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No
-- select-into, no returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   PERSON …5001, OTHER …5002
-- Every count and lookup is scoped to those ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_person uuid := '00000000-0000-4000-8000-000000005001';
  v_other uuid := '00000000-0000-4000-8000-000000005002';
begin
  v_owner_role := current_user;

  if to_regclass('public.profile_private') is null
     or not exists (
       select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'moods'
     ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261030000000_profiles_city_moods.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_person, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moods-person@moods-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moods-other@moods-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_person, v_other) and p.moods = '{}');
  results := array_append(results, case when v_n = 2 then format('%s PASS (new profiles start with no moods)', v_i)
                                        else format('%s FAIL (expected 2 empty profiles, got %s)', v_i, v_n) end);

  v_i := v_i + 1;
  results := array_append(results, case when has_column_privilege('authenticated', 'public.profiles', 'moods', 'UPDATE')
                                          and not has_column_privilege('anon', 'public.profiles', 'moods', 'UPDATE')
                                          and not has_table_privilege('anon', 'public.profile_private', 'SELECT')
                                          and not has_table_privilege('anon', 'public.profile_private', 'INSERT')
                                          and has_table_privilege('authenticated', 'public.profile_private', 'SELECT')
                                        then format('%s PASS (grants: authenticated writes moods and reads profile_private, anon touches neither)', v_i)
                                        else format('%s FAIL (grants are wrong)', v_i) end);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_person), true);

  -- Moods: saved on your own profile, refused when unknown, not writable on someone else's.
  v_i := v_i + 1;
  begin
    update public.profiles p set moods = array['make', 'people'] where p.id = v_person;
    v_n := (select count(*) from public.profiles p where p.id = v_person and p.moods = array['make', 'people']);
    results := array_append(results, case when v_n = 1 then format('%s PASS (own moods saved)', v_i)
                                          else format('%s FAIL (not saved)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  update public.profiles p set moods = array['move'] where p.id = v_other;
  v_n := (select count(*) from public.profiles p where p.id = v_other and p.moods <> '{}');
  results := array_append(results, case when v_n = 0 then format('%s PASS (cannot write another person''s moods)', v_i)
                                        else format('%s FAIL (wrote another person''s moods)', v_i) end);

  v_i := v_i + 1;
  begin
    update public.profiles p set moods = array['make', 'nonsense'] where p.id = v_person;
    results := array_append(results, format('%s FAIL (unknown mood accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (unknown mood refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- City: yours to write and read.
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, city) values (v_person, 'Bangalore');
    v_n := (select count(*) from public.profile_private x where x.user_id = v_person and x.city = 'Bangalore');
    results := array_append(results, case when v_n = 1 then format('%s PASS (own city saved and read back)', v_i)
                                          else format('%s FAIL (not saved)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private x set city = 'Pune' where x.user_id = v_person;
    v_n := (select count(*) from public.profile_private x where x.user_id = v_person and x.city = 'Pune');
    results := array_append(results, case when v_n = 1 then format('%s PASS (own city updated)', v_i)
                                          else format('%s FAIL (not updated)', v_i) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- City: not anyone else's, not as a row for someone else.
  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, city) values (v_other, 'Elsewhere');
    results := array_append(results, format('%s FAIL (wrote a row for another person)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (cannot create another person''s private profile)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.profile_private (user_id, city) values (v_person, repeat('x', 81))
      on conflict (user_id) do update set city = excluded.city;
    results := array_append(results, format('%s FAIL (81-character city accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (81-character city refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.profile_private x set city = '' where x.user_id = v_person;
    results := array_append(results, format('%s FAIL (empty city accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (empty city refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- The other person cannot read it, and cannot change it. Moods stay readable.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);

  v_i := v_i + 1;
  v_n := (select count(*) from public.profile_private x where x.user_id = v_person);
  results := array_append(results, case when v_n = 0 then format('%s PASS (another person reads no private profile of yours)', v_i)
                                        else format('%s FAIL (another person sees %s rows)', v_i, v_n) end);

  v_i := v_i + 1;
  update public.profile_private x set city = 'Hijacked' where x.user_id = v_person;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_person), true);
  v_n := (select count(*) from public.profile_private x where x.user_id = v_person and x.city = 'Hijacked');
  results := array_append(results, case when v_n = 0 then format('%s PASS (another person cannot change your city)', v_i)
                                        else format('%s FAIL (city was changed)', v_i) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id = v_person and p.moods = array['make', 'people']);
  results := array_append(results, case when v_n = 1 then format('%s PASS (moods stay public: another person reads them)', v_i)
                                        else format('%s FAIL (moods not readable, got %s)', v_i, v_n) end);

  -- Signed out (anon): no private profile at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.profile_private x where x.user_id = v_person);
    results := array_append(results, format('%s FAIL (anon read the table, %s rows)', v_i, v_n));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (anon cannot read the private profile)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
