-- Week view, PR 2: public.city_picks.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261111000000_city_picks.sql. Run before it, the script stops and says "NOT APPLIED";
-- it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its
-- own begin...exception...end sub-block with strict sqlstate handling; anything unexpected
-- is recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (CLAUDE.md): the delete policy is checked in pg_policies.
--
-- Fixed ids. Users: A …9101 (an admin), B …9102 (an ordinary signed-in person). Picks are
-- titled 'CP pick NN' and every count is scoped to those titles, never to the whole table.
--   01 published / 02 draft                                  who reads what
--   03 made by B (must be refused) / 04 made by A            who writes
--   05 to 11 each break one constraint (must be refused)

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009101';
  v_b uuid := '00000000-0000-4000-8000-000000009102';
  v_t timestamptz := now() + interval '2 days';
begin
  v_owner_role := current_user;

  if to_regclass('public.city_picks') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261111000000_city_picks.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (owner) role, which bypasses RLS.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'cp.a@acct-test.invalid'), (v_b, 'cp.b@acct-test.invalid')) as u(id, email);

  update public.profiles p set is_admin = true where p.id = v_a;

  insert into public.city_picks (title, place, starts_at, price, color, published) values
    ('CP pick 01', 'Central Park', v_t, 'free', 'teal', true),
    ('CP pick 02', 'Hidden draft', v_t, null, 'rose', false);

  -- As B, an ordinary person.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  v_n := (select count(*) from public.city_picks c where c.title in ('CP pick 01', 'CP pick 02'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS B reads the published pick and not the draft' else ' FAIL B read ' || v_n || ' of the 2 fixture picks' end);

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at) values ('CP pick 03', v_t);
    results := results || (v_i || ' FAIL B was allowed to add a pick');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS B cannot add a pick');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  update public.city_picks c set title = 'CP pick 01 edited by B' where c.title = 'CP pick 01';
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS B cannot edit a pick (0 rows)' else ' FAIL B edited ' || v_n || ' rows' end);

  -- Signed out sees nothing, and cannot even select.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.city_picks c where c.title in ('CP pick 01', 'CP pick 02'));
    results := results || (v_i || ' FAIL signed out could read city_picks (' || v_n || ' rows)');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS signed out cannot read city_picks');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- As A, an admin.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_n := (select count(*) from public.city_picks c where c.title in ('CP pick 01', 'CP pick 02'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS the admin reads the published pick and the draft' else ' FAIL the admin read ' || v_n || ' of 2' end);

  insert into public.city_picks (title, place, starts_at, ends_at, price, url, color, published)
  values ('CP pick 04', 'Brooklyn', v_t, v_t + interval '3 hours', '$25', 'https://example.com/pick', 'violet', true);
  v_n := (select count(*) from public.city_picks c where c.title = 'CP pick 04' and c.created_by = v_a and c.city = 'new-york');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the admin adds a pick, stamped with their id and the default city' else ' FAIL the admin pick count was ' || v_n end);

  update public.city_picks c set published = false where c.title = 'CP pick 04';
  get diagnostics v_n = row_count;
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the admin unpublishes a pick' else ' FAIL unpublish touched ' || v_n || ' rows' end);

  -- Each constraint, as the admin.
  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at) values ('', v_t);
    results := results || (v_i || ' FAIL an empty title was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an empty title is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at) values (repeat('x', 81), v_t);
    results := results || (v_i || ' FAIL an 81 character title was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a title over 80 characters is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, place, starts_at) values ('CP pick 07', repeat('x', 81), v_t);
    results := results || (v_i || ' FAIL an 81 character place was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a place over 80 characters is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, color) values ('CP pick 08', v_t, 'green');
    results := results || (v_i || ' FAIL a colour outside the 8 was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a colour outside the 8 is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, ends_at) values ('CP pick 09', v_t, v_t - interval '1 hour');
    results := results || (v_i || ' FAIL an end before the start was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS an end before the start is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, url) values ('CP pick 10', v_t, 'http://example.com');
    results := results || (v_i || ' FAIL a link that is not https was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a link that is not https is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  v_i := v_i + 1;
  begin
    insert into public.city_picks (title, starts_at, price) values ('CP pick 11', v_t, repeat('x', 41));
    results := results || (v_i || ' FAIL a 41 character price was accepted');
  exception
    when check_violation then results := results || (v_i || ' PASS a price over 40 characters is refused');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- Back to the owner role for catalog checks.
  perform set_config('role', v_owner_role, true);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'city_picks' and pp.cmd = 'DELETE' and pp.qual like '%is_admin%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the delete policy is admin only' else ' FAIL ' || v_n || ' admin delete policies' end);

  v_n := (select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'city_picks' and pp.cmd in ('INSERT', 'UPDATE', 'DELETE') and (coalesce(pp.qual, '') || coalesce(pp.with_check, '')) not like '%is_admin%');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS every write policy checks is_admin' else ' FAIL ' || v_n || ' write policies skip is_admin' end);

  v_n := (select count(*) from pg_class pc where pc.oid = 'public.city_picks'::regclass and pc.relrowsecurity);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS row level security is on' else ' FAIL row level security is off' end);

  v_n := (select count(*) from public.city_picks c where c.title like 'CP pick %');
  v_i := v_i + 1;
  results := results || (v_i || ' INFO ' || v_n || ' fixture picks exist inside this transaction, which now rolls back');

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
