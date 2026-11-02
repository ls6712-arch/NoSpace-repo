-- Verifies 20261107000000_log_punch_cards.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and no DELETE
-- (CLAUDE.md); every value is assigned with :=, and the expected failure is its own
-- begin ... exception ... end sub-block with strict sqlstate handling.
--
-- Fixed ids: A ...7b01, B ...7b02. Corners and Pursuits are prefixed vlog-. Every count and
-- read is scoped to these two people and these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_b boolean;
  v_j jsonb;
  v_post bigint;
  results text[] := '{}';
  v_owner_role text;
  v_a uuid := '00000000-0000-4000-8000-000000007b01';
  v_bb uuid := '00000000-0000-4000-8000-000000007b02';
  v_today date := (now() at time zone 'America/New_York')::date;
  v_month date := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  v_first timestamptz;
  v_expect_days int;
begin
  v_owner_role := current_user;

  if to_regprocedure('public.log_progress()') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261107000000_log_punch_cards.sql first, nothing was created)';
  end if;

  -- Noon on the 1st of this New York month. On the 1st itself, that is today, so one day.
  v_first := (v_month::timestamp + interval '12 hours') at time zone 'America/New_York';
  if v_first > now() then
    v_first := now();
  end if;
  v_expect_days := case when v_today = v_month then 1 else 2 end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the table owner, signed out.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vlog-a@logpunch-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_bb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vlog-b@logpunch-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_a, v_bb);

  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'vlog-pots', 'Vlog pots'),
    ('food-cooking', 'vlog-bread', 'Vlog bread'),
    ('books-writing', 'vlog-words', 'Vlog words');

  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode)
  values ('vlog-free', v_a, 'Some bread', 'food-cooking', 'vlog-bread', null, false, 'friends', 'solo'),
         ('vlog-group', v_bb, 'Bake together', 'food-cooking', 'vlog-bread', null, true, 'friends', 'together'),
         ('vlog-other', v_bb, 'Not shared with A', 'food-cooking', 'vlog-bread', null, false, 'friends', 'solo');
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode, finished_at)
  values ('vlog-done', v_a, 'Already finished', 'food-cooking', 'vlog-bread', null, false, 'friends', 'solo', now());
  insert into public.pursuit_members (pursuit_id, user_id, role, status) values ('vlog-group', v_a, 'member', 'joined');

  -- Pots: two photos today, one on the 1st, and a text Moment (never counts).
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, created_at)
  values (v_a, 'crafts-making', 'vlog-pots', 'photo', 'https://example.invalid/p1.jpg', 'p1', v_first),
         (v_a, 'crafts-making', 'vlog-pots', 'photo', 'https://example.invalid/p2.jpg', 'p2', now()),
         (v_a, 'crafts-making', 'vlog-pots', 'photo', 'https://example.invalid/p3.jpg', 'p3', now()),
         (v_a, 'crafts-making', 'vlog-pots', 'written', null, 'just words', now());
  -- Words: only a text Moment, so no card at all.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption)
  values (v_a, 'books-writing', 'vlog-words', 'written', null, 'words only');
  -- Bread: one photo toward A's own Pursuit.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'food-cooking', 'vlog-bread', 'photo', 'https://example.invalid/b1.jpg', 'b1', 'vlog-free');
  -- B logs in the group Pursuit A joined.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_bb, 'food-cooking', 'vlog-bread', 'photo', 'https://example.invalid/g1.jpg', 'g1', 'vlog-group');

  -- A already kept this month's Regular in Bread (a fixture row, as the owner).
  v_post := (select max(po.id) from public.posts po where po.user_id = v_a and po.corner = 'vlog-bread');
  insert into public.stubs (user_id, kind, corner_key, period, post_id)
  values (v_a, 'regular', 'food-cooking/vlog-bread', v_month, v_post)
  on conflict do nothing;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1 to 3. A Moment may have no Space, never a Corner without one
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  v_n := (select count(*) from information_schema.columns c
           where c.table_schema = 'public' and c.table_name = 'posts'
             and c.column_name = 'hobby_slug' and c.is_nullable = 'YES');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS hobby_slug may be null' else 'FAIL hobby_slug still required' end));

  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption)
  values (v_a, null, null, 'photo', 'https://example.invalid/n1.jpg', 'nothing picked');
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts po where po.user_id = v_a and po.hobby_slug is null and po.corner is null and po.caption = 'nothing picked');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS a Moment with nothing picked saves with no Space' else 'FAIL no-Space Moment count ' || v_n end));

  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption)
    values (v_a, null, 'vlog-pots', 'photo', 'https://example.invalid/x.jpg', 'corner, no space');
    results := array_append(results, format('%s FAIL a Corner without a Space was accepted', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS a Corner without a Space is refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 4. A Pursuit added after posting finishes the goal at once
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode)
  values ('vlog-goal', v_a, 'Two loaves', 'food-cooking', 'vlog-bread', 2, false, 'friends', 'solo');
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'food-cooking', 'vlog-bread', 'photo', 'https://example.invalid/l1.jpg', 'loaf 1', 'vlog-goal');
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption)
  values (v_a, null, null, 'photo', 'https://example.invalid/l2.jpg', 'loaf 2, sorted later');
  v_post := (select max(po.id) from public.posts po where po.user_id = v_a and po.caption = 'loaf 2, sorted later');
  update public.posts set hobby_slug = 'food-cooking', corner = 'vlog-bread', pursuit_id = 'vlog-goal'
   where public.posts.id = v_post;
  v_i := v_i + 1;
  v_n := (select count(*) from public.pursuits pu where pu.id = 'vlog-goal' and pu.finished_at is not null)
       + (select count(*) from public.stubs s where s.user_id = v_a and s.pursuit_id = 'vlog-goal' and s.kind = 'finish');
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS adding a Pursuit afterward finishes its goal and issues the Finisher' else 'FAIL after-the-fact Pursuit, got ' || v_n || ' of 2' end));

  v_i := v_i + 1;
  v_n := (select count(*) from pg_trigger t
           where t.tgrelid = 'public.posts'::regclass and not t.tgisinternal
             and t.tgname in ('posts_zz_award_moment_stubs_on_update', 'posts_pursuit_auto_finish_on_update'));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS both Stub triggers also run on update' else 'FAIL update triggers found ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5 to 6. Who can call it
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  v_b := has_function_privilege('anon', 'public.log_progress()', 'execute');
  results := array_append(results, format('%s %s', v_i, case when not v_b then 'PASS anon cannot call log_progress' else 'FAIL anon can call log_progress' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  v_j := public.log_progress();
  results := array_append(results, format('%s %s', v_i, case when v_j is null then 'PASS signed out gets nothing' else 'FAIL signed out got ' || left(v_j::text, 80) end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 6 to 12. As A
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_j := public.log_progress();

  v_i := v_i + 1;
  v_n := (select (c.value->>'days')::int from jsonb_array_elements(v_j->'corners') c where c.value->>'key' = 'crafts-making/vlog-pots');
  results := array_append(results, format('%s %s', v_i, case when v_n = v_expect_days then format('PASS pots counts %s distinct New York days, text never counts', v_n) else format('FAIL pots days %s, expected %s', v_n, v_expect_days) end));

  v_i := v_i + 1;
  v_b := (select (c.value->>'today')::boolean from jsonb_array_elements(v_j->'corners') c where c.value->>'key' = 'crafts-making/vlog-pots');
  results := array_append(results, format('%s %s', v_i, case when v_b then 'PASS pots already counts today' else 'FAIL pots today ' || coalesce(v_b::text, 'missing') end));

  v_i := v_i + 1;
  v_n := (select count(*) from jsonb_array_elements(v_j->'corners') c where c.value->>'key' = 'books-writing/vlog-words');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS a Corner with only text Moments has no card' else 'FAIL words card present' end));

  v_i := v_i + 1;
  v_b := (select (c.value->>'kept')::boolean from jsonb_array_elements(v_j->'corners') c where c.value->>'key' = 'food-cooking/vlog-bread');
  results := array_append(results, format('%s %s', v_i, case when v_b then 'PASS bread shows this month''s Regular as kept' else 'FAIL bread kept ' || coalesce(v_b::text, 'missing') end));

  v_i := v_i + 1;
  v_b := (select (p.value->>'owner')::boolean and (p.value->>'moments')::int = 1 and (p.value->>'days')::int = 1
                 and (p.value->>'today')::boolean and p.value->'target' = 'null'::jsonb
            from jsonb_array_elements(v_j->'pursuits') p where p.value->>'id' = 'vlog-free');
  results := array_append(results, format('%s %s', v_i, case when v_b then 'PASS own Pursuit: 1 Moment, 1 day, today, no goal' else 'FAIL own Pursuit ' || coalesce((select p.value::text from jsonb_array_elements(v_j->'pursuits') p where p.value->>'id' = 'vlog-free'), 'missing') end));

  v_i := v_i + 1;
  v_b := (select not (p.value->>'owner')::boolean and (p.value->>'moments')::int = 1 and (p.value->>'days')::int = 0
            from jsonb_array_elements(v_j->'pursuits') p where p.value->>'id' = 'vlog-group');
  results := array_append(results, format('%s %s', v_i, case when v_b then 'PASS joined Pursuit: the group''s Moment counts, A has no days yet' else 'FAIL joined Pursuit ' || coalesce((select p.value::text from jsonb_array_elements(v_j->'pursuits') p where p.value->>'id' = 'vlog-group'), 'missing') end));

  v_i := v_i + 1;
  v_n := (select count(*) from jsonb_array_elements(v_j->'pursuits') p where p.value->>'id' in ('vlog-done', 'vlog-other'));
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS finished and not-joined Pursuits are left out' else 'FAIL leaked ' || v_n end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 13. As B: never A's days
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_bb), true);
  v_j := public.log_progress();
  v_i := v_i + 1;
  v_n := (select count(*) from jsonb_array_elements(v_j->'corners') c where c.value->>'key' = 'crafts-making/vlog-pots');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS B never sees A''s Corner days' else 'FAIL B sees A''s days' end));

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
