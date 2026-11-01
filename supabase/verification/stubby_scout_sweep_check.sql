-- Stubby's scout, part 2: watch list, member finds, sweep token and schedule.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261101170000_stubby_scout_sweep.sql. Run before it, the script stops and says "NOT APPLIED".
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its
-- own begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9301 (admin), B ...9302 and C ...9303 (members). Picks are titled
-- 'SW pick NN', runs carry focus 'SW fixture', watches start 'SW watch'; every count is
-- scoped to those.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_b2 boolean;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009301';
  v_b uuid := '00000000-0000-4000-8000-000000009302';
  v_c uuid := '00000000-0000-4000-8000-000000009303';
  v_when timestamptz := now() + interval '2 days';
begin
  if to_regclass('public.scout_watches') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261101170000_stubby_scout_sweep.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'sw.a@acct-test.invalid'), (v_b, 'sw.b@acct-test.invalid'), (v_c, 'sw.c@acct-test.invalid')) as u(id, email);
  update public.profiles p set is_admin = true where p.id = v_a;

  -- As the owner (what the function's service role does): B's ask found one draft and one live pick.
  insert into public.city_picks (title, starts_at, found_by, source_url, checked_at, requested_by, published, scout_note) values
    ('SW pick 01', v_when, 'scout', 'https://example.com/sw-01', now(), v_b, false, 'Price not listed'),
    ('SW pick 02', v_when, 'scout', 'https://example.com/sw-02', now(), v_b, true, null);
  insert into public.scout_runs (focus, started_by, kind) values ('SW fixture', v_b, 'member'), ('SW fixture', null, 'sweep');

  -- 1. The token check: right token yes, wrong or empty no.
  v_b2 := public.scout_sweep_token_ok((select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'stubby_scout_sweep_token'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_b2 then ' PASS the sweep token is accepted' else ' FAIL the sweep token was refused' end);
  v_i := v_i + 1;
  results := results || (v_i || case when not public.scout_sweep_token_ok(repeat('0', 64)) and not public.scout_sweep_token_ok(null) and not public.scout_sweep_token_ok('')
    then ' PASS a wrong or empty token is refused' else ' FAIL a wrong token was accepted' end);

  -- 2. The schedule exists.
  v_n := (select count(*) from cron.job j where j.jobname = 'stubby-scout-sweep' and j.active and j.schedule = '*/15 9-13 * * *');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the morning sweep is scheduled' else ' FAIL the sweep job is missing or changed' end);

  -- As B, a member.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_n := (select count(*) from public.city_picks c where c.title in ('SW pick 01', 'SW pick 02'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS B reads both of their finds, the draft too' else ' FAIL B read ' || v_n || ' of their 2 finds' end);

  v_n := (select count(*) from public.scout_runs r where r.focus = 'SW fixture');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS B reads their own run, not the sweep' else ' FAIL B read ' || v_n || ' runs' end);

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, found_by, source_url, checked_at, requested_by, published)
      values ('SW pick 03', v_when, 'scout', 'https://example.com/sw-03', now(), v_b, true);
    results := results || (v_i || ' FAIL B published a pick directly');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot write picks directly');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_n := (select count(*) from public.scout_watches w where w.query like 'SW watch%');
  v_i := v_i + 1;
  begin
    insert into public.scout_watches (query) values ('SW watch by B');
    results := results || (v_i || ' FAIL B added to the watch list');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot add to the watch list');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_n := (select count(*) from public.scout_watches w);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B reads no watch list' else ' FAIL B read ' || v_n || ' watches' end);

  v_i := v_i + 1;
  begin
    v_b2 := public.scout_sweep_token_ok(repeat('0', 64));
    results := results || (v_i || ' FAIL B could call the token check');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot call the token check');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    perform private.scout_sweep_call();
    results := results || (v_i || ' FAIL B could start a sweep');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot start a sweep');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As C, another member: sees B's live find, not B's draft or B's runs.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_n := (select count(*) from public.city_picks c where c.title = 'SW pick 01');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS C cannot see B''s draft' else ' FAIL C saw B''s draft' end);
  v_n := (select count(*) from public.city_picks c where c.title = 'SW pick 02');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS C sees B''s live find' else ' FAIL C could not see B''s live find' end);
  v_n := (select count(*) from public.scout_runs r where r.focus = 'SW fixture');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS C reads none of B''s runs' else ' FAIL C read ' || v_n || ' runs' end);

  -- As A, the admin.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    insert into public.scout_watches (query) values ('SW watch by A');
    results := results || (v_i || ' PASS an admin can add to the watch list');
  exception
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_n := (select count(*) from public.scout_runs r where r.focus = 'SW fixture');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS an admin reads every run' else ' FAIL the admin read ' || v_n || ' runs' end);
  v_i := v_i + 1;
  begin
    insert into public.scout_watches (query) values ('sw WATCH BY A');
    results := results || (v_i || ' FAIL the same watch was added twice');
  exception
    when unique_violation then results := results || (v_i || ' PASS the same watch is never added twice');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Signed out: nothing.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.scout_watches w);
    results := results || (v_i || ' FAIL signed out could read the watch list');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot read the watch list');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
