-- Stubby's scout: city_picks scout columns and public.scout_runs.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261118000000_stubby_scout.sql. Run before it, the script stops and says "NOT APPLIED";
-- it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its
-- own begin...exception...end sub-block with strict sqlstate handling; anything unexpected
-- is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9201 (an admin), B ...9202 (an ordinary signed-in person). Picks are
-- titled 'SC pick NN' and runs carry focus 'SC fixture'; every count is scoped to those.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_t text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009201';
  v_b uuid := '00000000-0000-4000-8000-000000009202';
  v_when timestamptz := now() + interval '3 days';
begin
  if to_regclass('public.scout_runs') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261118000000_stubby_scout.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (owner) role, which bypasses RLS.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'sc.a@acct-test.invalid'), (v_b, 'sc.b@acct-test.invalid')) as u(id, email);

  update public.profiles p set is_admin = true where p.id = v_a;

  -- 1. An editor's pick needs nothing new and is marked as the editor's.
  insert into public.city_picks (title, starts_at) values ('SC pick 01', v_when);
  v_t := (select c.found_by from public.city_picks c where c.title = 'SC pick 01');
  v_i := v_i + 1;
  results := results || (v_i || case when v_t = 'editor' then ' PASS an editor pick defaults to found_by editor' else ' FAIL found_by was ' || coalesce(v_t, 'null') end);

  -- 2. A scout pick with no source link is refused.
  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, checked_at) values ('SC pick 02', v_when, 'scout', now());
    results := results || (v_i || ' FAIL a scout pick with no source link was saved');
  exception
    when check_violation then results := results || (v_i || ' PASS a scout pick needs a source link');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 3. A scout pick with an http (not https) link is refused.
  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, source_url, checked_at) values ('SC pick 03', v_when, 'scout', 'http://example.com/x', now());
    results := results || (v_i || ' FAIL a scout pick with an http link was saved');
  exception
    when check_violation then results := results || (v_i || ' PASS a scout source link must be https');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. A good scout pick saves; the same title and start again (any case) is refused.
  insert into public.city_picks (title, starts_at, found_by, source_url, checked_at, scout_note)
    values ('SC pick 04', v_when, 'scout', 'https://example.com/sc-04', now(), 'Price not listed');
  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, source_url, checked_at)
      values ('sc PICK 04', v_when, 'scout', 'https://example.com/sc-04b', now());
    results := results || (v_i || ' FAIL the same scout pick was saved twice');
  exception
    when unique_violation then results := results || (v_i || ' PASS the same scout pick is never saved twice');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. A scout pick may share a title and start with an editor pick (the index is scout only).
  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, source_url, checked_at)
      values ('SC pick 01', v_when, 'scout', 'https://example.com/sc-01', now());
    results := results || (v_i || ' PASS a scout pick does not clash with an editor pick');
  exception
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As B, an ordinary person.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_i := v_i + 1;
  begin
    insert into public.scout_runs (focus, started_by) values ('SC fixture', v_b);
    results := results || (v_i || ' FAIL B was allowed to start a scout run');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot start a scout run');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, source_url, checked_at)
      values ('SC pick 06', v_when, 'scout', 'https://example.com/sc-06', now());
    results := results || (v_i || ' FAIL B was allowed to add a scout pick');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot add a scout pick');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As A, the admin.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  begin
    insert into public.scout_runs (focus) values ('SC fixture');
    results := results || (v_i || ' PASS an admin can start a scout run');
  exception
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.scout_runs (focus, started_by) values ('SC fixture', v_b);
    results := results || (v_i || ' FAIL an admin started a run in someone else''s name');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS a run is always in the admin''s own name');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  update public.scout_runs r set finished_at = now(), searches = 4, found = 6, added = 3
  where r.focus = 'SC fixture' and r.started_by = v_a;
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS an admin can finish a run' else ' FAIL the admin finished ' || v_n || ' runs' end);

  v_i := v_i + 1;
  begin
    update public.scout_runs r set searches = 500 where r.focus = 'SC fixture' and r.started_by = v_a;
    results := results || (v_i || ' FAIL a run saved 500 searches');
  exception
    when check_violation then results := results || (v_i || ' PASS searches per run are capped');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Back to B: reads no runs, cannot edit them.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.scout_runs r where r.focus = 'SC fixture');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B reads no scout runs' else ' FAIL B read ' || v_n || ' scout runs' end);

  update public.scout_runs r set error = 'B was here' where r.focus = 'SC fixture';
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B cannot edit a scout run (0 rows)' else ' FAIL B edited ' || v_n || ' runs' end);

  -- B still sees no draft scout picks.
  v_n := (select count(*) from public.city_picks c where c.title like 'SC pick %' and c.found_by = 'scout');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B sees no scout drafts' else ' FAIL B saw ' || v_n || ' scout drafts' end);

  -- Signed out cannot read scout runs at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.scout_runs r where r.focus = 'SC fixture');
    results := results || (v_i || ' FAIL signed out could read scout_runs (' || v_n || ' rows)');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot read scout_runs');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
