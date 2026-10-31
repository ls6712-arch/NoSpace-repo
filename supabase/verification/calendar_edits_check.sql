-- Calendar, PR 2: public.calendar_entries.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261113000000_calendar_edits.sql. Run before it, the script stops and says "NOT APPLIED"; it never
-- creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...' so a
-- rollback is guaranteed. Each expected failure is its own begin...exception...end sub-block with strict
-- sqlstate handling; anything unexpected is recorded as 'N ERROR <sqlstate>: <message>', never as a pass.
-- No select-into, no returning-into, no delete (CLAUDE.md): the delete policy and the cascade are checked
-- in the catalog.
--
-- Fixed ids. Users: A …9201, B …9202. Entries carry the note 'CE NN' or a fixed time, and every count is
-- scoped to the two fixture users, never to the whole table.
--   01 to 03 A adds, and reads, its own entries     04 to 07 B cannot see, add, change or move them
--   08 signed out cannot read                        09 to 17 each constraint (must be refused)
--   18 to 21 the catalog: delete policy, every policy owner only, RLS on, cascade on user delete

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009201';
  v_b uuid := '00000000-0000-4000-8000-000000009202';
  v_t timestamptz := date_trunc('hour', now()) + interval '2 days';
begin
  v_owner_role := current_user;

  if to_regclass('public.calendar_entries') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261113000000_calendar_edits.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'ce.a@acct-test.invalid'), (v_b, 'ce.b@acct-test.invalid')) as u(id, email);

  -- As A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  insert into public.calendar_entries (kind, starts_at, ends_at) values ('free', v_t, v_t + interval '3 hours');
  insert into public.calendar_entries (kind, starts_at, ends_at, repeat, note) values ('block', v_t + interval '1 day', v_t + interval '1 day 2 hours', 'weekly', 'CE 02 dentist');
  insert into public.calendar_entries (kind, starts_at, ends_at) values ('busy', v_t + interval '2 days', v_t + interval '2 days 1 hour');

  v_n := (select count(*) from public.calendar_entries e where e.user_id in (v_a, v_b));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 3 then ' PASS A adds a free, a block and a busy entry and reads all 3' else ' FAIL A reads ' || v_n || ' of 3' end);

  v_n := (select count(*) from public.calendar_entries e where e.user_id = v_a and e.kind = 'block' and e.repeat = 'weekly' and e.note = 'CE 02 dentist');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the entry is stamped with A and keeps its repeat and note' else ' FAIL block count ' || v_n end);

  v_n := (select count(*) from public.calendar_entries e where e.user_id = v_a and e.repeat = 'none' and e.note is null and e.kind in ('free', 'busy'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS repeat defaults to none and a free or busy entry has no note' else ' FAIL default count ' || v_n end);

  -- As B, an ordinary person.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_n := (select count(*) from public.calendar_entries e where e.user_id in (v_a, v_b));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B reads none of A''s entries' else ' FAIL B read ' || v_n || ' of A''s entries' end);

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (user_id, kind, starts_at, ends_at) values (v_a, 'block', v_t, v_t + interval '1 hour');
    results := results || (v_i || ' FAIL B was allowed to add an entry for A');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot add an entry for A');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  update public.calendar_entries e set note = 'CE edited by B' where e.user_id = v_a;
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B cannot change A''s entries (0 rows)' else ' FAIL B changed ' || v_n || ' rows' end);

  v_i := v_i + 1;
  begin
    update public.calendar_entries e set user_id = v_b where e.user_id = v_a;
    get diagnostics v_n = row_count;
    results := results || (v_i || case when v_n = 0 then ' PASS B cannot take over A''s entries (0 rows)' else ' FAIL B moved ' || v_n || ' rows' end);
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot take over A''s entries');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Signed out.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.calendar_entries e where e.user_id in (v_a, v_b));
    results := results || (v_i || ' FAIL signed out could read calendar_entries (' || v_n || ' rows)');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot read calendar_entries');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Each constraint, as A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at) values ('party', v_t, v_t + interval '1 hour');
    results := results || (v_i || ' FAIL an unknown kind was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an unknown kind is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at) values ('free', v_t, v_t);
    results := results || (v_i || ' FAIL an entry that ends when it starts was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an entry that ends when it starts is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at) values ('free', v_t, v_t - interval '1 hour');
    results := results || (v_i || ' FAIL an entry that ends before it starts was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an entry that ends before it starts is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at) values ('block', v_t, v_t + interval '25 hours');
    results := results || (v_i || ' FAIL a 25 hour entry was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an entry over 24 hours is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at, repeat) values ('free', v_t, v_t + interval '1 hour', 'daily');
    results := results || (v_i || ' FAIL a daily repeat was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a repeat other than none or weekly is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at, note) values ('free', v_t, v_t + interval '1 hour', 'CE note on a free entry');
    results := results || (v_i || ' FAIL a note on a free entry was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS only a block can carry a note');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at, note) values ('block', v_t, v_t + interval '1 hour', repeat('x', 81));
    results := results || (v_i || ' FAIL an 81 character note was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a note over 80 characters is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at, note) values ('block', v_t, v_t + interval '1 hour', '');
    results := results || (v_i || ' FAIL an empty note was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an empty note is refused (no note is null)');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.calendar_entries (kind, starts_at, ends_at, repeat) values ('busy', v_t, v_t + interval '1 hour', 'weekly');
    results := results || (v_i || ' FAIL a weekly busy entry was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a busy entry is one off only');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- The catalog, as the owner role.
  perform set_config('role', v_owner_role, true);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'calendar_entries' and pp.cmd = 'DELETE' and pp.qual like '%user_id%auth.uid%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the delete policy is owner only' else ' FAIL ' || v_n || ' owner delete policies' end);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'calendar_entries' and (coalesce(pp.qual, '') || coalesce(pp.with_check, '')) not like '%user_id%auth.uid%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every policy checks the owner' else ' FAIL ' || v_n || ' policies skip the owner check' end);

  v_n := (select count(*) from pg_class pc where pc.oid = 'public.calendar_entries'::regclass and pc.relrowsecurity);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS row level security is on' else ' FAIL row level security is off' end);

  v_n := (select count(*) from pg_constraint pc where pc.conrelid = 'public.calendar_entries'::regclass and pc.contype = 'f' and pc.confdeltype = 'c');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS deleting a user deletes their entries (cascade)' else ' FAIL ' || v_n || ' cascading foreign keys' end);

  v_n := (select count(*) from public.calendar_entries e where e.user_id in (v_a, v_b));
  v_i := v_i + 1;
  results := results || (v_i || ' INFO ' || v_n || ' fixture entries exist inside this transaction, which now rolls back');

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
