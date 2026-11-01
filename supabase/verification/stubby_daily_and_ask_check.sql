-- Stubby, part 2: scout_sources, scheduled runs, personal_picks, stubby_asks and the claim functions.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261101180000_stubby_daily_and_ask.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9301 (an admin), B ...9302 and C ...9303 (ordinary people). Picks are
-- titled 'SD pick NN'; every count is scoped to the fixture's users, titles or ids. The claim
-- functions are run as the connecting (owner) role, which is what service_role stands in for.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_id bigint;
  v_id2 bigint;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009301';
  v_b uuid := '00000000-0000-4000-8000-000000009302';
  v_c uuid := '00000000-0000-4000-8000-000000009303';
  v_when timestamptz := now() + interval '2 days';
  v_day date := (now() at time zone 'America/New_York')::date;
  v_src bigint;
  v_owner_role text;
begin
  v_owner_role := current_user;
  if to_regclass('public.personal_picks') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261101180000_stubby_daily_and_ask.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'sd.a@acct-test.invalid'), (v_b, 'sd.b@acct-test.invalid'), (v_c, 'sd.c@acct-test.invalid')) as u(id, email);
  update public.profiles p set is_admin = true where p.id = v_a;

  -- 1. The five sources were seeded.
  v_n := (select count(*) from public.scout_sources s where s.name in ('NYU events', 'NYC Parks', 'New York Public Library', 'Brooklyn Public Library', 'Around the city'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 5 then ' PASS five sources are seeded' else ' FAIL ' || v_n || ' of 5 seeded sources' end);

  -- 2. A source search domain must be a bare host.
  v_i := v_i + 1;
  begin
    insert into public.scout_sources (name, focus, search_domain) values ('SD bad', 'x', 'https://example.com/path');
    results := results || (v_i || ' FAIL a source took a URL as its domain');
  exception
    when check_violation then results := results || (v_i || ' PASS a source domain is a bare host');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 3. claim_scout_source takes each source once a day. Every source but a fixture one is marked
  --    done today first, so the claims below only ever see the fixture source.
  v_src := (select s.id from public.scout_sources s where s.name = 'NYC Parks');
  insert into public.scout_sources (name, focus) values ('SD fixture source', 'SD fixture');
  insert into public.scout_runs (kind, source_id, run_day, started_by, focus)
    select 'scheduled', s.id, v_day, null, 'SD fixture'
    from public.scout_sources s
    where s.name <> 'SD fixture source'
      and not exists (select 1 from public.scout_runs r where r.kind = 'scheduled' and r.source_id = s.id and r.run_day = v_day);
  v_id := (select c.source_id from public.claim_scout_source() c);
  v_id2 := (select c.source_id from public.claim_scout_source() c);
  v_i := v_i + 1;
  results := results || (v_i || case
    when v_id = (select s.id from public.scout_sources s where s.name = 'SD fixture source') and v_id2 is null
      then ' PASS each source is claimed once a day, then nothing'
    else ' FAIL claims gave ' || coalesce(v_id::text, 'null') || ' then ' || coalesce(v_id2::text, 'null') end);

  -- 4. The same source and day can't be recorded twice, even by hand.
  v_i := v_i + 1;
  begin
    insert into public.scout_runs (kind, source_id, run_day, started_by) values ('scheduled', v_src, v_day, null);
    results := results || (v_i || ' FAIL a source ran twice in one day');
  exception
    when unique_violation then results := results || (v_i || ' PASS a source runs at most once a day');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. claim_stubby_ask: 3 for B, then refused; C still gets one; a global limit of 0 refuses all.
  v_n := 0;
  for k in 1..4 loop
    if public.claim_stubby_ask(v_b, 3, 100000) is not null then v_n := v_n + 1; end if;
  end loop;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 3 then ' PASS 3 asks a day, the 4th is refused' else ' FAIL B got ' || v_n || ' asks' end);

  v_i := v_i + 1;
  results := results || (v_i || case when public.claim_stubby_ask(v_c, 3, 100000) is not null then ' PASS another person still gets an ask' else ' FAIL C was refused' end);

  v_i := v_i + 1;
  results := results || (v_i || case when public.claim_stubby_ask(v_c, 3, 0) is null then ' PASS the global limit refuses everyone' else ' FAIL the global limit let an ask through' end);

  -- Fixture personal picks: two for B, one for C.
  insert into public.personal_picks (user_id, title, starts_at, url) values
    (v_b, 'SD pick 01', v_when, 'https://example.com/sd-01'),
    (v_b, 'SD pick 02', v_when, 'https://example.com/sd-02'),
    (v_c, 'SD pick 03', v_when, 'https://example.com/sd-03');

  -- 8. The same pick for the same person is saved once.
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url) values (v_b, 'sd PICK 01', v_when, 'https://example.com/sd-01b');
    results := results || (v_i || ' FAIL the same personal pick was saved twice');
  exception
    when unique_violation then results := results || (v_i || ' PASS a personal pick is saved once');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As B.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_n := (select count(*) from public.personal_picks p where p.title like 'SD pick %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS B reads only their own picks' else ' FAIL B read ' || v_n || ' picks' end);

  v_n := (select count(*) from public.stubby_asks a where a.user_id in (v_b, v_c));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 3 then ' PASS B reads only their own asks' else ' FAIL B read ' || v_n || ' asks' end);

  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url) values (v_b, 'SD pick 04', v_when, 'https://example.com/sd-04');
    results := results || (v_i || ' FAIL B added a pick for themselves');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS only Stubby adds personal picks');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.stubby_asks (user_id) values (v_b);
    results := results || (v_i || ' FAIL B logged an ask by hand');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS asks are only logged by Stubby');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    v_id := public.claim_stubby_ask(v_b, 100, 100000);
    results := results || (v_i || ' FAIL B could call claim_stubby_ask');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS people cannot call claim_stubby_ask');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    v_id := (select c.run_id from public.claim_scout_source() c);
    results := results || (v_i || ' FAIL B could call claim_scout_source');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS people cannot call claim_scout_source');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_n := (select count(*) from public.scout_sources s);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B reads no sources' else ' FAIL B read ' || v_n || ' sources' end);

  -- As C: sees only their own pick, and can't edit anyone's.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_n := (select count(*) from public.personal_picks p where p.title like 'SD pick %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS C sees only their own pick, not B''s' else ' FAIL C saw ' || v_n || ' picks' end);

  v_i := v_i + 1;
  begin
    update public.personal_picks p set title = 'SD pick 01 edited' where p.title = 'SD pick 01';
    results := results || (v_i || ' FAIL C could edit a personal pick');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS nobody edits a personal pick');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As A, the admin: reads and edits sources.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  update public.scout_sources s set enabled = s.enabled where s.name = 'SD fixture source';
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS an admin can edit a source' else ' FAIL the admin edited ' || v_n || ' sources' end);

  -- Signed out: nothing.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.personal_picks p where p.title like 'SD pick %');
    results := results || (v_i || ' FAIL signed out read personal_picks (' || v_n || ')');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot read personal_picks');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- The schedule exists (read as owner).
  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from cron.job j where j.jobname in ('stubby-restock', 'purge-stubby-rows') and j.active);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS the restock and clean up are scheduled' else ' FAIL ' || v_n || ' of 2 jobs scheduled' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
