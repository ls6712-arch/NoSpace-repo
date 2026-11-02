-- Stubby plan PR 1: personal_picks kind, why, rank, ask_id, soonest_after, and idea links.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261107000000_stubby_smarter_picks.sql. Run before it, the script stops and says
-- "NOT APPLIED"; it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9401 and B ...9402. Picks are titled 'SP pick NN'; every count is
-- scoped to the fixture's users or titles. Inserts run as the owner role (the server inserts).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ask bigint;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009401';
  v_b uuid := '00000000-0000-4000-8000-000000009402';
  v_when timestamptz := now() + interval '1 day';
  v_owner_role text;
begin
  v_owner_role := current_user;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'personal_picks' and c.column_name = 'kind'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261107000000_stubby_smarter_picks.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'sp.a@acct-test.invalid'), (v_b, 'sp.b@acct-test.invalid')) as u(id, email);

  insert into public.stubby_asks (user_id) values (v_a);
  v_ask := (select max(sa.id) from public.stubby_asks sa where sa.user_id = v_a);

  -- 1. An event with an https page, a why, a rank and its ask is saved; kind defaults to event.
  insert into public.personal_picks (user_id, title, starts_at, url, why, rank, ask_id)
    values (v_a, 'SP pick 01', v_when, 'https://example.com/wheel-night', 'A hands-on class, 15 minutes from you.', 0, v_ask);
  v_n := (select count(*) from public.personal_picks pp
          where pp.user_id = v_a and pp.title = 'SP pick 01' and pp.kind = 'event' and pp.soonest_after = false and pp.ask_id = v_ask and pp.rank = 0);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS an event saves with its why, rank and ask, as kind event' else ' FAIL event row not as expected (' || v_n || ')' end);

  -- 2. An idea may link to a Corner's start page or the person's own Pursuit.
  insert into public.personal_picks (user_id, title, starts_at, url, kind)
    values (v_a, 'SP pick 02', v_when, '/start/crafts/pottery', 'idea'),
           (v_a, 'SP pick 03', v_when, '/pursuit/abc_123', 'idea');
  v_n := (select count(*) from public.personal_picks pp where pp.user_id = v_a and pp.title in ('SP pick 02', 'SP pick 03') and pp.kind = 'idea');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS an idea can link to a start page or a Pursuit' else ' FAIL ' || v_n || ' of 2 idea rows' end);

  -- 3. An event can't link to a Soosh page.
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url, kind) values (v_a, 'SP pick 04', v_when, '/start/crafts/pottery', 'event');
    results := results || (v_i || ' FAIL an event took a Soosh link');
  exception
    when check_violation then results := results || (v_i || ' PASS an event needs an https page');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 4. An idea can't link to any other path or an http page.
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url, kind) values (v_a, 'SP pick 05', v_when, '/admin/city-picks', 'idea');
    results := results || (v_i || ' FAIL an idea took a path that is not a start page or Pursuit');
  exception
    when check_violation then results := results || (v_i || ' PASS an idea path must be a start page or Pursuit');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url, kind) values (v_a, 'SP pick 06', v_when, 'http://example.com/x', 'idea');
    results := results || (v_i || ' FAIL an idea took an http link');
  exception
    when check_violation then results := results || (v_i || ' PASS an idea outside link must be https');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 5. Only event or idea.
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url, kind) values (v_a, 'SP pick 07', v_when, 'https://example.com/x', 'party');
    results := results || (v_i || ' FAIL a kind other than event or idea was saved');
  exception
    when check_violation then results := results || (v_i || ' PASS kind is event or idea');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 6. A why over 160 characters is refused.
  v_i := v_i + 1;
  begin
    insert into public.personal_picks (user_id, title, starts_at, url, why) values (v_a, 'SP pick 08', v_when, 'https://example.com/y', repeat('x', 161));
    results := results || (v_i || ' FAIL a 161 character why was saved');
  exception
    when check_violation then results := results || (v_i || ' PASS a why is 160 characters at most');
    when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
  end;

  -- 7. Removing the ask keeps the pick, without its ask (checked from the constraint, no delete).
  v_n := (select count(*) from pg_constraint pc
          where pc.conrelid = 'public.personal_picks'::regclass and pc.contype = 'f'
            and pc.confrelid = 'public.stubby_asks'::regclass and pc.confdeltype = 'n');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS ask_id is set null when its ask goes' else ' FAIL ask_id foreign key not set null (' || v_n || ')' end);

  -- 8. Still owner-only: B sees none of A's picks, A sees all three saved.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.personal_picks pp where pp.title like 'SP pick %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS someone else sees none of your picks' else ' FAIL B sees ' || v_n || ' of A''s picks' end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_n := (select count(*) from public.personal_picks pp where pp.title like 'SP pick %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 3 then ' PASS you see your own three' else ' FAIL A sees ' || v_n || ' of 3' end);
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
