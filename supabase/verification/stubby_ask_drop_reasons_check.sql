-- stubby_asks.drop_reasons: why each candidate was dropped, for debugging.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261109000000_stubby_ask_drop_reasons.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9601 and B ...9602. Every count is scoped to the fixture's users.
-- Writes run as the owner role (the server writes).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ask bigint;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009601';
  v_b uuid := '00000000-0000-4000-8000-000000009602';
  v_owner_role text;
begin
  v_owner_role := current_user;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'stubby_asks' and c.column_name = 'drop_reasons'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261109000000_stubby_ask_drop_reasons.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'dr.a@acct-test.invalid'), (v_b, 'dr.b@acct-test.invalid')) as u(id, email);

  insert into public.stubby_asks (user_id) values (v_a);
  v_ask := (select max(sa.id) from public.stubby_asks sa where sa.user_id = v_a);

  -- 1. A new ask has no drop reasons.
  v_n := (select count(*) from public.stubby_asks sa where sa.id = v_ask and sa.drop_reasons is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a new ask has no drop reasons' else ' FAIL a new ask has drop reasons' end);

  -- 2. The server saves a list of title and reason.
  update public.stubby_asks sa
    set found = 1, added = 0, drop_reasons = '[{"title": "50 things to do tonight", "reason": "A page that lists many things, not its own page."}]'::jsonb
    where sa.id = v_ask;
  v_n := (select count(*) from public.stubby_asks sa
          where sa.id = v_ask and sa.drop_reasons -> 0 ->> 'reason' = 'A page that lists many things, not its own page.');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS drop reasons save as a list' else ' FAIL drop reasons did not save' end);

  -- 3. Not a list: refused.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa set drop_reasons = '{"title": "x"}'::jsonb where sa.id = v_ask;
    results := results || (v_i || ' FAIL drop reasons took an object');
  exception
    when check_violation then results := results || (v_i || ' PASS drop reasons must be a list');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. More than 40: refused.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa
      set drop_reasons = (select jsonb_agg(jsonb_build_object('title', 'x', 'reason', 'y')) from generate_series(1, 41) g)
      where sa.id = v_ask;
    results := results || (v_i || ' FAIL 41 drop reasons were saved');
  exception
    when check_violation then results := results || (v_i || ' PASS at most 40 drop reasons');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. Only your own asks (and so only your own drop reasons): B sees none of A's, A sees theirs.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.stubby_asks sa where sa.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS someone else sees none of your asks' else ' FAIL B sees ' || v_n || ' of A''s asks' end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_n := (select count(*) from public.stubby_asks sa where sa.user_id = v_a and sa.drop_reasons is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS you see your own ask and its drop reasons' else ' FAIL A sees ' || v_n || ' of 1' end);

  -- 6. People can't write drop reasons, not even on their own ask.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa set drop_reasons = '[]'::jsonb where sa.id = v_ask;
    results := results || (v_i || ' FAIL a person changed their ask''s drop reasons');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS only the server writes drop reasons');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
