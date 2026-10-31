-- Calendar, PR 4: public.calendar_feed_tokens and public.set_calendar_feed_token().
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261114000000_calendar_feed.sql. Run before it, the script stops and says "NOT APPLIED"; it never
-- creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...' so a
-- rollback is guaranteed. Each expected failure is its own begin...exception...end sub-block with strict
-- sqlstate handling; anything unexpected is recorded as 'N ERROR <sqlstate>: <message>', never as a pass.
-- No select-into, no returning-into, no delete (CLAUDE.md): the catalog is checked instead.
--
-- Fixed ids. Users: A …9301, B …9302. Hashes are 'a…a' (64 characters) and the like; every count is
-- scoped to the two fixture users, never to the whole table.
--   01 to 04 making and resetting a link          05 to 08 who can see and write what
--   09 to 13 refused input                          14 to 19 the catalog

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_t timestamptz;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009301';
  v_b uuid := '00000000-0000-4000-8000-000000009302';
  h1 text := repeat('a', 64);
  h2 text := repeat('b', 64);
  h3 text := repeat('c', 64);
begin
  v_owner_role := current_user;

  if to_regclass('public.calendar_feed_tokens') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261114000000_calendar_feed.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'cf.a@acct-test.invalid'), (v_b, 'cf.b@acct-test.invalid')) as u(id, email);

  -- As A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_t := public.set_calendar_feed_token(h1);
  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b) and f.revoked_at is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 and v_t is not null then ' PASS A makes a link and it is the one active link' else ' FAIL active links after making one: ' || v_n end);

  perform public.set_calendar_feed_token(h2);
  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b) and f.revoked_at is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS resetting leaves one active link' else ' FAIL active links after a reset: ' || v_n end);

  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id = v_a and f.revoked_at is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the old link is revoked, not deleted' else ' FAIL revoked links: ' || v_n end);

  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS A sees both rows, to know when the link was made' else ' FAIL A sees ' || v_n || ' rows' end);

  -- As B.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B sees none of A''s links' else ' FAIL B saw ' || v_n || ' rows' end);

  perform public.set_calendar_feed_token(h3);
  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b) and f.revoked_at is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS B makes a link and sees just their own' else ' FAIL B sees ' || v_n || ' active links' end);

  v_i := v_i + 1;
  begin
    v_n := (select count(*) from (select f.token_hash from public.calendar_feed_tokens f where f.user_id = v_b) x);
    results := results || (v_i || ' FAIL B could read token_hash');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS nobody signed in can read a token hash');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_feed_tokens (user_id, token_hash) values (v_b, repeat('d', 64));
    results := results || (v_i || ' FAIL B wrote to the table directly');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS the table cannot be written to directly');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Refused input, as B.
  v_i := v_i + 1;
  begin
    perform public.set_calendar_feed_token('not a hash');
    results := results || (v_i || ' FAIL a hash of the wrong shape was accepted');
  exception
    when invalid_parameter_value then results := results || (v_i || ' PASS a hash that is not 64 hex characters is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.set_calendar_feed_token(upper(repeat('e', 64)));
    results := results || (v_i || ' FAIL upper case hex was accepted');
  exception
    when invalid_parameter_value then results := results || (v_i || ' PASS upper case hex is refused (one spelling only)');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.set_calendar_feed_token(null);
    results := results || (v_i || ' FAIL a null hash was accepted');
  exception
    when invalid_parameter_value then results := results || (v_i || ' PASS a null hash is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform public.set_calendar_feed_token(h1);
    results := results || (v_i || ' FAIL a hash already used was accepted');
  exception
    when unique_violation then results := results || (v_i || ' PASS the same hash cannot be stored twice');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Signed out.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    perform public.set_calendar_feed_token(repeat('f', 64));
    results := results || (v_i || ' FAIL signed out could make a link');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot make a link');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- The catalog, as the owner role.
  perform set_config('role', v_owner_role, true);

  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b) and f.revoked_at is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS each of them has one active link: B making theirs did not touch A''s' else ' FAIL active links with both: ' || v_n end);

  v_n := (select count(*) from pg_class pc where pc.oid = 'public.calendar_feed_tokens'::regclass and pc.relrowsecurity);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS row level security is on' else ' FAIL row level security is off' end);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'calendar_feed_tokens');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS one policy, for reading your own rows (no insert, update or delete policy)' else ' FAIL ' || v_n || ' policies' end);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'calendar_feed_tokens' and pp.cmd = 'SELECT' and pp.qual like '%user_id%auth.uid%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the read policy checks the owner' else ' FAIL the read policy does not check the owner' end);

  v_n := (select count(*) from information_schema.column_privileges cp where cp.table_schema = 'public' and cp.table_name = 'calendar_feed_tokens' and cp.grantee = 'authenticated' and cp.column_name = 'token_hash');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS signed in people have no privilege on token_hash' else ' FAIL signed in people have ' || v_n || ' privileges on token_hash' end);

  v_n := (select count(*) from pg_constraint pc where pc.conrelid = 'public.calendar_feed_tokens'::regclass and pc.contype = 'f' and pc.confdeltype = 'c');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS deleting a user deletes their links (cascade)' else ' FAIL ' || v_n || ' cascading foreign keys' end);

  v_n := (select count(*) from public.calendar_feed_tokens f where f.user_id in (v_a, v_b));
  v_i := v_i + 1;
  results := results || (v_i || ' INFO ' || v_n || ' fixture rows exist inside this transaction, which now rolls back');

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
