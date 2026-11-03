-- stubby_asks.decision_trace: how each deck was chosen (stubby-agent G4).
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261111000000_stubby_ask_decision_trace.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9611 and B ...9612. Every count is scoped to the fixture's users.
-- Writes run as the owner role (the server writes).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ask bigint;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009611';
  v_b uuid := '00000000-0000-4000-8000-000000009612';
  v_owner_role text;
begin
  v_owner_role := current_user;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'stubby_asks' and c.column_name = 'decision_trace'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000000_stubby_ask_decision_trace.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'dt.a@acct-test.invalid'), (v_b, 'dt.b@acct-test.invalid')) as u(id, email);

  insert into public.stubby_asks (user_id) values (v_a);
  v_ask := (select max(sa.id) from public.stubby_asks sa where sa.user_id = v_a);

  -- 1. A new ask has no decision trace.
  v_n := (select count(*) from public.stubby_asks sa where sa.id = v_ask and sa.decision_trace is null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a new ask has no decision trace' else ' FAIL a new ask has a decision trace' end);

  -- 2. The server saves one object, with the drop reasons beside it.
  update public.stubby_asks sa
    set found = 1, added = 1,
        drop_reasons = '[]'::jsonb,
        decision_trace = '{"version": "2026-11-03.1", "outcome": "found", "picks": [{"title": "Open studio hour", "kind": "event", "source": "web", "eligibility": "valid", "selection": "rank", "rank": 0, "why": true}], "dropped": {}}'::jsonb
    where sa.id = v_ask;
  v_n := (select count(*) from public.stubby_asks sa
          where sa.id = v_ask and sa.decision_trace ->> 'version' = '2026-11-03.1' and sa.decision_trace -> 'picks' -> 0 ->> 'selection' = 'rank');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a decision trace saves as an object' else ' FAIL the decision trace did not save' end);

  -- 3. Not an object: refused.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa set decision_trace = '[{"version": "x"}]'::jsonb where sa.id = v_ask;
    results := results || (v_i || ' FAIL a decision trace took a list');
  exception
    when check_violation then results := results || (v_i || ' PASS a decision trace must be an object');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. Over 16 KB: refused.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa set decision_trace = jsonb_build_object('pad', repeat('x', 17000)) where sa.id = v_ask;
    results := results || (v_i || ' FAIL a 17 KB decision trace was saved');
  exception
    when check_violation then results := results || (v_i || ' PASS a decision trace is at most 16 KB');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. Only your own asks (and so only your own traces): B sees none of A's, A sees theirs.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.stubby_asks sa where sa.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS someone else sees none of your asks' else ' FAIL B sees ' || v_n || ' of A''s asks' end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_n := (select count(*) from public.stubby_asks sa where sa.user_id = v_a and sa.decision_trace is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS you see your own ask and its decision trace' else ' FAIL A sees ' || v_n || ' of 1' end);

  -- 6. People can't write decision traces, not even on their own ask.
  v_i := v_i + 1;
  begin
    update public.stubby_asks sa set decision_trace = '{}'::jsonb where sa.id = v_ask;
    results := results || (v_i || ' FAIL a person changed their ask''s decision trace');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS only the server writes decision traces');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
