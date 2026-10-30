-- Open sign-up clean-up: profiles.is_test.
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261106000000_profiles_is_test.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed whatever happens. Each expected
-- failure is its own begin...exception...end sub-block with strict sqlstate
-- handling; anything unexpected is recorded as 'N ERROR <sqlstate>: <message>'.
-- No select-into, no returning-into, no delete (per CLAUDE.md).
--
-- Fixed ids: A …6101 (an ordinary account), B …6102 (flagged as a test account).
-- Every lookup is scoped to those ids. Whole-table facts (a column, a grant, a
-- trigger) are read from the catalog.

begin;

do $$
declare
  v_i int := 0;
  v_b boolean;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000006101';
  v_bb uuid := '00000000-0000-4000-8000-000000006102';
begin
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'is_test'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261106000000_profiles_is_test.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testflag.one@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_bb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testflag.two@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- 1. A new account is not a test account.
  v_i := v_i + 1;
  v_b := (select p.is_test from public.profiles p where p.id = v_a);
  results := results || (v_i || case when v_b is false then ' PASS default is false' else ' FAIL default is ' || coalesce(v_b::text, 'null') end);

  -- 2. The owner role (no signed-in person) can set the flag.
  v_i := v_i + 1;
  update public.profiles p set is_test = true where p.id = v_bb;
  v_b := (select p.is_test from public.profiles p where p.id = v_bb);
  results := results || (v_i || case when v_b is true then ' PASS the owner role can flag an account' else ' FAIL flag not set' end);

  -- 3. A signed-in person cannot clear it on their own account.
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_bb::text, true);
    update public.profiles p set is_test = false where p.id = v_bb;
    results := results || (v_i || ' FAIL a signed-in person cleared the flag');
  exception
    when raise_exception then
      results := results || (v_i || ' PASS a signed-in person cannot clear the flag');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. A signed-in person cannot set it on their own account.
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claim.sub', v_a::text, true);
    update public.profiles p set is_test = true where p.id = v_a;
    results := results || (v_i || ' FAIL a signed-in person set the flag');
  exception
    when raise_exception then
      results := results || (v_i || ' PASS a signed-in person cannot set the flag');
    when others then
      results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 5. Both flag values are still what they were after the failed attempts.
  v_i := v_i + 1;
  results := results || (v_i || case
    when (select p.is_test from public.profiles p where p.id = v_bb) is true
     and (select p.is_test from public.profiles p where p.id = v_a) is false
    then ' PASS flags unchanged' else ' FAIL flags changed' end);

  -- 6. The app can read the column (granted by name, since profiles columns are).
  v_i := v_i + 1;
  results := results || (v_i || case
    when has_column_privilege('anon', 'public.profiles', 'is_test', 'select')
     and has_column_privilege('authenticated', 'public.profiles', 'is_test', 'select')
    then ' PASS anon and authenticated can read is_test' else ' FAIL is_test is not readable' end);

  -- 7. Nobody but the owner can write it directly (no client column update grant).
  v_i := v_i + 1;
  results := results || (v_i || case
    when has_column_privilege('anon', 'public.profiles', 'is_test', 'update') then ' FAIL anon can update is_test'
    else ' PASS anon cannot update is_test' end);

  -- 8. The trigger and index exist.
  v_i := v_i + 1;
  results := results || (v_i || case
    when exists (select 1 from pg_trigger t where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'profiles_lock_is_test' and not t.tgisinternal)
     and exists (select 1 from pg_indexes i where i.schemaname = 'public' and i.tablename = 'profiles' and i.indexname = 'profiles_is_test_idx')
    then ' PASS trigger and index exist' else ' FAIL trigger or index missing' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
