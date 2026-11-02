-- Stubby plan PR 3: stubby_asks.free_follow_up_used and personal_picks.better_with_friend.
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261108000000_stubby_deck.sql. Run before it, the script stops and says "NOT APPLIED";
-- it never creates anything then.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. No expected-failure cases here
-- (both columns are plain flags), so no exception sub-blocks are needed. No select-into, no
-- returning-into, no delete (CLAUDE.md).
--
-- Fixed ids. Users: A ...9501 and B ...9502. Picks are titled 'SK pick NN'; every count is scoped
-- to the fixture's users or titles. Writes run as the owner role (the server writes).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_ask bigint;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009501';
  v_b uuid := '00000000-0000-4000-8000-000000009502';
  v_owner_role text;
begin
  v_owner_role := current_user;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'stubby_asks' and c.column_name = 'free_follow_up_used'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261108000000_stubby_deck.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values (v_a, 'sk.a@acct-test.invalid'), (v_b, 'sk.b@acct-test.invalid')) as u(id, email);

  insert into public.stubby_asks (user_id) values (v_a);
  v_ask := (select max(sa.id) from public.stubby_asks sa where sa.user_id = v_a);

  -- 1. A new ask starts with its free follow-up unused.
  v_n := (select count(*) from public.stubby_asks sa where sa.id = v_ask and sa.free_follow_up_used = false);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a new ask has its free follow-up' else ' FAIL a new ask''s free follow-up is not unused' end);

  -- 2. The function's claim: one update that succeeds once, and only for the asker.
  update public.stubby_asks sa set free_follow_up_used = true
    where sa.id = v_ask and sa.user_id = v_b and sa.free_follow_up_used = false;
  v_n := (select count(*) from public.stubby_asks sa where sa.id = v_ask and sa.free_follow_up_used = true);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS someone else can''t use your free follow-up' else ' FAIL B used A''s free follow-up' end);

  update public.stubby_asks sa set free_follow_up_used = true
    where sa.id = v_ask and sa.user_id = v_a and sa.free_follow_up_used = false;
  v_n := (select count(*) from public.stubby_asks sa where sa.id = v_ask and sa.free_follow_up_used = true);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the asker''s free follow-up is marked used' else ' FAIL the free follow-up was not marked' end);

  -- 3. A free follow-up adds no ask row: still one row for A.
  v_n := (select count(*) from public.stubby_asks sa where sa.user_id = v_a);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a free follow-up adds no ask' else ' FAIL ' || v_n || ' asks for A' end);

  -- 4. A pick saves with better_with_friend, defaulting to false.
  insert into public.personal_picks (user_id, title, starts_at, url, ask_id, better_with_friend)
    values (v_a, 'SK pick 01', now() + interval '1 day', 'https://example.com/for-two', v_ask, true),
           (v_a, 'SK pick 02', now() + interval '1 day', 'https://example.com/solo', v_ask, default);
  v_n := (select count(*) from public.personal_picks pp
          where pp.user_id = v_a and ((pp.title = 'SK pick 01' and pp.better_with_friend) or (pp.title = 'SK pick 02' and not pp.better_with_friend)));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS better_with_friend saves, default false' else ' FAIL better_with_friend rows (' || v_n || ')' end);

  -- 5. Still owner-only: B sees none of A's picks.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_n := (select count(*) from public.personal_picks pp where pp.title like 'SK pick %');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS someone else sees none of your picks' else ' FAIL B sees ' || v_n || ' of A''s picks' end);
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
