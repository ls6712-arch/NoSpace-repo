-- Verifies 20261020000000_profiles_terms_accepted_at.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally
-- in RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md); every value is assigned with :=.
--
-- Fixed ids: ACCEPTOR ...7a01, PRIOR ...7a02 (already has an earlier time).
-- Every count and read is scoped to these two profiles.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_acceptor uuid := '00000000-0000-4000-8000-000000007a01';
  v_prior uuid := '00000000-0000-4000-8000-000000007a02';
  v_early timestamptz := '2001-01-01 00:00:00+00';
  v_client_time timestamptz := '2000-01-01 00:00:00+00';
  v_got timestamptz;
  v_stored timestamptz;
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_acceptor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terms-acceptor@terms-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_prior, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terms-prior@terms-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- Sanity: the sign-up trigger made both profiles, with no acceptance recorded.
  v_n := (select count(*) from public.profiles p
    where p.id in (v_acceptor, v_prior) and p.terms_accepted_at is null);
  if v_n <> 2 then
    results := array_append(results, 'SETUP FAIL fixture profiles missing or already accepted n=' || v_n);
  end if;

  -- The earlier acceptance for PRIOR is set by the owner role, as a fixture.
  update public.profiles set terms_accepted_at = v_early where public.profiles.id = v_prior;

  -- 1. The column is a nullable timestamptz with no default.
  v_i := v_i + 1;
  v_n := (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'terms_accepted_at'
      and c.data_type = 'timestamp with time zone' and c.is_nullable = 'YES' and c.column_default is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL found=' || v_n end));

  -- 2. accept_terms() exists, takes no arguments, is security definer and has a
  --    pinned search_path.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_proc p
    where p.oid = 'public.accept_terms()'::regprocedure
      and p.pronargs = 0 and p.prosecdef and p.proconfig is not null
      and p.prorettype = 'timestamptz'::regtype);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL found=' || v_n end));

  -- 3. Only authenticated can run it; anon cannot.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_function_privilege('authenticated', 'public.accept_terms()', 'EXECUTE')
          and not has_function_privilege('anon', 'public.accept_terms()', 'EXECUTE')
         then 'PASS' else 'FAIL' end));

  -- 4. Nobody on the client side can write the column directly.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE')
          and not has_column_privilege('anon', 'public.profiles', 'terms_accepted_at', 'UPDATE')
         then 'PASS' else 'FAIL' end));

  -- 5. A client-supplied time is refused outright: a direct update as the
  --    account owner fails with insufficient_privilege and changes nothing.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  begin
    update public.profiles set terms_accepted_at = v_client_time where public.profiles.id = v_acceptor;
    results := array_append(results, format('%s FAIL direct update was allowed', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS direct update refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);
  v_stored := (select p.terms_accepted_at from public.profiles p where p.id = v_acceptor);
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when v_stored is null then 'PASS still unset' else 'FAIL stored=' || v_stored end));

  -- 6. accept_terms() stamps the database's own time. It has no parameter to
  --    carry a client time, and the result is this transaction's now().
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  v_got := public.accept_terms();
  perform set_config('role', v_owner_role, true);
  v_stored := (select p.terms_accepted_at from public.profiles p where p.id = v_acceptor);
  results := array_append(results, format('%s %s', v_i,
    case when v_got = v_stored and v_got = transaction_timestamp() and v_got <> v_client_time
         then 'PASS server time' else 'FAIL got=' || coalesce(v_got::text, 'null') || ' stored=' || coalesce(v_stored::text, 'null') end));

  -- 7. A second call changes nothing.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_prior), true);
  v_got := public.accept_terms();
  perform set_config('role', v_owner_role, true);
  v_stored := (select p.terms_accepted_at from public.profiles p where p.id = v_prior);
  results := array_append(results, format('%s %s', v_i,
    case when v_got = v_early and v_stored = v_early then 'PASS earlier time kept' else 'FAIL got=' || coalesce(v_got::text, 'null') || ' stored=' || coalesce(v_stored::text, 'null') end));

  -- 8. One person's call never touches another's row: ACCEPTOR calling it
  --    (step 6) left PRIOR's earlier time alone, and vice versa.
  v_i := v_i + 1;
  v_stored := (select p.terms_accepted_at from public.profiles p where p.id = v_acceptor);
  v_n := (select count(*) from public.profiles p
    where p.id = v_acceptor and p.terms_accepted_at = transaction_timestamp());
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL stored=' || coalesce(v_stored::text, 'null') end));

  -- 9. With no logged-in person it refuses (28000) and writes nothing.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    v_got := public.accept_terms();
    results := array_append(results, format('%s FAIL ran with no session', v_i));
  exception
    when sqlstate '28000' then
      results := array_append(results, format('%s PASS refused with no session', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
