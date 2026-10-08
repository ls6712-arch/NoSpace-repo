-- Verifies 20261020000000_terms_acceptances.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally
-- in RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md); every value is assigned with :=, and each expected
-- failure is its own begin ... exception ... end sub-block with strict sqlstate
-- handling (an unexpected error is recorded as ERROR, never as a pass).
--
-- Fixed ids: ACCEPTOR ...7a01, PRIOR ...7a02 (already has an earlier time).
-- Every count and read is scoped to these two people.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_acceptor uuid := '00000000-0000-4000-8000-000000007a01';
  v_prior uuid := '00000000-0000-4000-8000-000000007a02';
  v_today text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  v_old_version text := '2026-01-01';
  v_early timestamptz := '2001-01-01 00:00:00+00';
  v_client_time timestamptz := '2000-01-01 00:00:00+00';
  v_got timestamptz;
  v_bad text;
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_acceptor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terms-acceptor@terms-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_prior, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terms-prior@terms-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- PRIOR already accepted this version long ago (an owner-role fixture row).
  insert into public.terms_acceptances (user_id, terms_version, accepted_at) values (v_prior, v_today, v_early);

  -- 1. Table shape: the three columns, the primary key, and a cascade to auth.users.
  v_i := v_i + 1;
  v_n := (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'terms_acceptances'
      and ((c.column_name = 'user_id' and c.data_type = 'uuid' and c.is_nullable = 'NO')
        or (c.column_name = 'terms_version' and c.data_type = 'text' and c.is_nullable = 'NO')
        or (c.column_name = 'accepted_at' and c.data_type = 'timestamp with time zone'
            and c.is_nullable = 'NO' and c.column_default = 'now()')));
  results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS columns' else 'FAIL columns found=' || v_n end));
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c
    where c.conrelid = 'public.terms_acceptances'::regclass and c.contype = 'p'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
            where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['terms_version', 'user_id']);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS one row per person per version' else 'FAIL primary key' end));
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c
    where c.conrelid = 'public.terms_acceptances'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'c');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS cascades with the account' else 'FAIL foreign key' end));

  -- 2. Row level security is on, with exactly one policy: select, for authenticated.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_class c where c.oid = 'public.terms_acceptances'::regclass and c.relrowsecurity);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS rls on' else 'FAIL rls off' end));
  v_i := v_i + 1;
  v_n := (select count(*) from pg_policy p where p.polrelid = 'public.terms_acceptances'::regclass);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS one policy' else 'FAIL policies=' || v_n end));
  v_i := v_i + 1;
  v_n := (select count(*) from pg_policy p
    where p.polrelid = 'public.terms_acceptances'::regclass and p.polcmd = 'r');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS it is a select policy' else 'FAIL no select policy' end));

  -- 3. Privileges: authenticated can only read; anon can do nothing.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_table_privilege('authenticated', 'public.terms_acceptances', 'SELECT')
          and not has_table_privilege('authenticated', 'public.terms_acceptances', 'INSERT')
          and not has_table_privilege('authenticated', 'public.terms_acceptances', 'UPDATE')
          and not has_table_privilege('authenticated', 'public.terms_acceptances', 'DELETE')
          and not has_table_privilege('authenticated', 'public.terms_acceptances', 'TRUNCATE')
         then 'PASS authenticated is read only' else 'FAIL authenticated privileges' end));
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_table_privilege('anon', 'public.terms_acceptances', 'SELECT')
          and not has_table_privilege('anon', 'public.terms_acceptances', 'INSERT')
          and not has_table_privilege('anon', 'public.terms_acceptances', 'UPDATE')
          and not has_table_privilege('anon', 'public.terms_acceptances', 'DELETE')
         then 'PASS anon has none' else 'FAIL anon privileges' end));

  -- 4. Nothing about it lives on profiles any more.
  v_i := v_i + 1;
  v_n := (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = 'terms_accepted_at');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS profiles has no acceptance column' else 'FAIL profiles still has it' end));

  -- 5. accept_terms(text): one argument, security definer, pinned search_path,
  --    returns timestamptz; no zero-argument version; only authenticated runs it.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_proc p
    where p.oid = 'public.accept_terms(text)'::regprocedure
      and p.pronargs = 1 and p.prosecdef and p.proconfig is not null
      and p.prorettype = 'timestamptz'::regtype);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS function shape' else 'FAIL function shape' end));
  v_i := v_i + 1;
  v_n := (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'accept_terms');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS only one accept_terms' else 'FAIL overloads=' || v_n end));
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_function_privilege('authenticated', 'public.accept_terms(text)', 'EXECUTE')
          and not has_function_privilege('anon', 'public.accept_terms(text)', 'EXECUTE')
         then 'PASS authenticated only' else 'FAIL execute privileges' end));

  -- 6. A client-chosen time cannot be written: a direct insert (with a made-up
  --    accepted_at), update or delete as the account owner is refused.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  v_i := v_i + 1;
  begin
    insert into public.terms_acceptances (user_id, terms_version, accepted_at) values (v_acceptor, v_old_version, v_client_time);
    results := array_append(results, format('%s FAIL direct insert was allowed', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS direct insert refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    update public.terms_acceptances set accepted_at = v_client_time where public.terms_acceptances.user_id = v_prior;
    results := array_append(results, format('%s FAIL direct update was allowed', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS direct update refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    perform 1 from public.terms_acceptances limit 0;
    -- delete is checked by privilege, not by running one (no DELETE in this script)
    if has_table_privilege('authenticated', 'public.terms_acceptances', 'DELETE') then
      results := array_append(results, format('%s FAIL delete is granted', v_i));
    else
      results := array_append(results, format('%s PASS delete is not granted', v_i));
    end if;
  exception when others then
    results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.terms_acceptances t where t.user_id in (v_acceptor, v_prior) and t.accepted_at = v_client_time);
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS no client time stored' else 'FAIL client time stored' end));

  -- 7. accept_terms(version) stamps the database's own time, not one the client
  --    could pick: the function has no time argument, and the stored time is this
  --    transaction's now().
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  v_got := public.accept_terms(v_today);
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.terms_acceptances t
    where t.user_id = v_acceptor and t.terms_version = v_today and t.accepted_at = transaction_timestamp());
  results := array_append(results, format('%s %s', v_i,
    case when v_n = 1 and v_got = transaction_timestamp() then 'PASS server time' else 'FAIL got=' || coalesce(v_got::text, 'null') end));

  -- 8. Once per version: calling again for the same version changes nothing,
  --    and an earlier time is never replaced.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_prior), true);
  v_got := public.accept_terms(v_today);
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.terms_acceptances t where t.user_id = v_prior);
  results := array_append(results, format('%s %s', v_i,
    case when v_got = v_early and v_n = 1 then 'PASS earlier time kept, still one row' else 'FAIL got=' || coalesce(v_got::text, 'null') || ' rows=' || v_n end));

  -- 9. A new version is a new row, and the first one is untouched.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  v_got := public.accept_terms(v_old_version);
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.terms_acceptances t where t.user_id = v_acceptor);
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS second version is a second row' else 'FAIL rows=' || v_n end));

  -- 10. Versions that are not a real, started date are refused (22023) and add nothing.
  foreach v_bad in array array['', 'latest', '2026-13-45', '2999-01-01', '26-10-08'] loop
    v_i := v_i + 1;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
    begin
      v_got := public.accept_terms(v_bad);
      results := array_append(results, format('%s FAIL accepted version "%s"', v_i, v_bad));
    exception
      when sqlstate '22023' then
        results := array_append(results, format('%s PASS refused version "%s"', v_i, v_bad));
      when others then
        results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
    end;
    perform set_config('role', v_owner_role, true);
  end loop;
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  begin
    v_got := public.accept_terms(null);
    results := array_append(results, format('%s FAIL accepted a null version', v_i));
  exception
    when sqlstate '22023' then
      results := array_append(results, format('%s PASS refused a null version', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.terms_acceptances t where t.user_id = v_acceptor);
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS refused versions added no rows' else 'FAIL rows=' || v_n end));

  -- 11. With no logged-in person it refuses (28000).
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    v_got := public.accept_terms(v_today);
    results := array_append(results, format('%s FAIL ran with no session', v_i));
  exception
    when sqlstate '28000' then
      results := array_append(results, format('%s PASS refused with no session', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  -- 12. Readable only by the owner: each person sees their own rows and none of
  --     anyone else's; anon cannot read the table at all.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_acceptor), true);
  v_n := (select count(*) from public.terms_acceptances t where t.user_id = v_acceptor);
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS owner sees own rows' else 'FAIL own rows=' || v_n end));
  v_i := v_i + 1;
  v_n := (select count(*) from public.terms_acceptances t where t.user_id = v_prior);
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS cannot see someone else''s rows' else 'FAIL saw rows=' || v_n end));
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    v_n := (select count(*) from public.terms_acceptances t where t.user_id in (v_acceptor, v_prior));
    results := array_append(results, format('%s FAIL anon could read, rows=%s', v_i, v_n));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS anon cannot read', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
