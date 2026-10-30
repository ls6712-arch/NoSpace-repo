-- Soosh: account pause and deletion (Settings > Pause or leave) and the
-- nightly purge_deleted_accounts() job.
--
-- Not a migration. Run AFTER 20261103000000_account_deletion_purge.sql; run
-- before it, the script stops at the first check ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE
-- EXCEPTION 'RESULTS: ...' so everything rolls back. No select-into, no
-- returning-into, no delete statement (the purge's own delete runs inside
-- the function). Every count is scoped to the fixture ids below.
--
-- Fixed ids (a block no earlier script uses):
--   OLD …5001  deletion asked 15 days ago  -> purged
--   NEW …5002  deletion asked 2 days ago   -> kept
--   KEPT …5003 never asked                  -> kept
--   PAUSED …5004 paused, as the client sets it -> hidden, writes blocked, kept

begin;

do $$
declare
  v_n int;
  results text[] := '{}';
  v_old uuid := '00000000-0000-4000-8000-000000005001';
  v_new uuid := '00000000-0000-4000-8000-000000005002';
  v_kept uuid := '00000000-0000-4000-8000-000000005003';
  v_paused uuid := '00000000-0000-4000-8000-000000005004';
begin
  if to_regprocedure('public.purge_deleted_accounts()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261103000000_account_deletion_purge.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (owner) role. handle_new_user creates the
  -- profiles rows.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_old, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purge-old@purge-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purge-new@purge-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_kept, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purge-kept@purge-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_paused, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purge-paused@purge-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles set deletion_requested_at = now() - interval '15 days' where profiles.id = v_old;
  update public.profiles set deletion_requested_at = now() - interval '2 days' where profiles.id = v_new;

  -- 1. The client path: an account pauses itself (same column grant the app uses).
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paused, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.profiles set paused_at = now() where profiles.id = v_paused;
    reset role;
    v_n := (select count(*) from public.profiles where profiles.id = v_paused and profiles.paused_at is not null);
    results := results || case when v_n = 1 then '1 PASS self-pause' else '1 FAIL self-pause' end;
  exception when others then
    reset role;
    results := results || ('1 ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 2. A paused account is hidden from someone else.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_kept, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_n := (case when public.is_visible_profile(v_paused) then 1 else 0 end);
    reset role;
    results := results || case when v_n = 0 then '2 PASS paused hidden' else '2 FAIL paused visible' end;
  exception when others then
    reset role;
    results := results || ('2 ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 3. A paused account's own writes are blocked.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_paused, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_n := (case when public.write_blocked() then 1 else 0 end);
    reset role;
    results := results || case when v_n = 1 then '3 PASS paused writes blocked' else '3 FAIL paused can write' end;
  exception when others then
    reset role;
    results := results || ('3 ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. Clients can't run the purge.
  begin
    set local role authenticated;
    perform public.purge_deleted_accounts();
    reset role;
    results := results || '4 FAIL authenticated could run purge';
  exception
    when insufficient_privilege then
      reset role;
      results := results || '4 PASS purge not callable by clients';
    when others then
      reset role;
      results := results || ('4 ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. The purge removes only the account past its grace period.
  perform public.purge_deleted_accounts();
  v_n := (select count(*) from auth.users where users.id = v_old);
  results := results || case when v_n = 0 then '5a PASS old request purged' else '5a FAIL old request still there' end;
  v_n := (select count(*) from public.profiles where profiles.id = v_old);
  results := results || case when v_n = 0 then '5b PASS old profile cascaded' else '5b FAIL old profile left' end;
  v_n := (select count(*) from auth.users where users.id in (v_new, v_kept, v_paused));
  results := results || case when v_n = 3 then '5c PASS others kept' else '5c FAIL others touched (' || v_n || ')' end;

  -- 6. The job is scheduled.
  v_n := (select count(*) from cron.job where job.jobname = 'purge-deleted-accounts' and job.active);
  results := results || case when v_n = 1 then '6 PASS cron scheduled' else '6 FAIL cron missing' end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
