-- Soosh: the four Stubs (20261115000000_stubs_four_kinds.sql).
--
-- Not a migration, nothing here alters the schema. Run this AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and
-- everything rolls back. Each expected failure is its own begin...exception...end
-- sub-block with strict sqlstate handling; anything else is recorded as ERROR.
-- No select-into, no returning-into, no delete (CLAUDE.md).
--
-- Fixed ids (a block no earlier script uses):
--   A …7001 (the person earning), B …7002 (in A's group Pursuit, and a second drop finisher),
--   C …7003 (a stranger viewing A), ADMIN …7004, HOST …7005
--   Pursuits 'vcheck-*', drops 'vcheck-*', Space …00f7, Corner keys 'sports-fitness/vcheck-*'.
-- Fixture rows are written as the table owner with no signed-in user, so the posting
-- rate limit (keyed by auth.uid()) does not apply. Every count is scoped to these ids.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_t text;
  v_j jsonb;
  results text[] := '{}';
  v_owner_role text;
  v_a uuid := '00000000-0000-4000-8000-000000007001';
  v_b uuid := '00000000-0000-4000-8000-000000007002';
  v_c uuid := '00000000-0000-4000-8000-000000007003';
  v_admin uuid := '00000000-0000-4000-8000-000000007004';
  v_host uuid := '00000000-0000-4000-8000-000000007005';
  v_space uuid := '00000000-0000-4000-8000-0000000000f7';
  v_last_month date := (date_trunc('month', (now() at time zone 'America/New_York')) - interval '1 month')::date;
  v_drop_one bigint;
  v_drop_two bigint;
  v_drop_closed bigint;
  v_dp_a text;
  v_dp_a2 text;
  v_dp_b2 text;
  v_event bigint;
  v_stub bigint;
  d int;
begin
  v_owner_role := current_user;

  if to_regclass('public.drops') is null
     or to_regprocedure('public.join_drop(bigint)') is null
     or to_regprocedure('public.pin_stub(bigint, boolean)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261115000000_stubs_four_kinds.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the table owner, signed out.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@stubs4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-b@stubs4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-c@stubs4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-admin@stubs4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-host@stubs4-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_admin = true where public.profiles.id = v_admin;
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_a, v_b, v_c, v_admin, v_host);
  -- An account is active once it has a birthdate (private.is_active), which join_drop checks.
  insert into public.profile_private (user_id, birthdate)
  select u.id, date '1990-01-01' from unnest(array[v_a, v_b, v_c, v_admin, v_host]) as u (id)
  on conflict (user_id) do update set birthdate = excluded.birthdate;

  v_i := v_i + 1;
  v_n := (select count(*) from public.profiles p where p.id in (v_a, v_b, v_c, v_admin, v_host));
  results := array_append(results, case when v_n = 5 then format('%s PASS (5 fixture profiles)', v_i)
                                        else format('%s FAIL (expected 5 profiles, got %s)', v_i, v_n) end);

  v_i := v_i + 1;
  results := array_append(results, case when not private.moment_counts('photo', 'x', '{}', now(), now() - interval '72 hours')
                                          and private.moment_counts('photo', 'x', '{}', now(), now() - interval '24 hours')
                                          and not private.moment_counts('written', 'x', '{}', now(), now())
                                        then format('%s PASS (a 72h-old photo and a text Moment do not count; a 24h-old photo does)', v_i)
                                        else format('%s FAIL (moment_counts)', v_i) end);

  -- Moments reference real Corners (posts_corner_fkey), so the fixture has its own.
  insert into public.corners (space_slug, slug, name) values
    ('sports-fitness', 'vcheck-run', 'Vcheck run'), ('art-creative', 'vcheck-draw', 'Vcheck draw'),
    ('food-cooking', 'vcheck-bake', 'Vcheck bake'), ('crafts-making', 'vcheck-oneday', 'Vcheck one day'),
    ('books-writing', 'vcheck-text', 'Vcheck text'), ('crafts-making', 'vcheck-pottery', 'Vcheck pottery'),
    ('sports-fitness', 'vcheck-sunrise', 'Vcheck sunrise'), ('sports-fitness', 'vcheck-climb', 'Vcheck climb');

  -- ───────────────────────────────────────────────────────────────────────
  -- Finisher
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode)
  values ('vcheck-goal', v_a, 'Two runs', 'sports-fitness', 'vcheck-run', 2, false, 'friends', 'solo'),
         ('vcheck-free', v_a, 'Some drawing', 'art-creative', 'vcheck-draw', null, true, 'friends', 'solo'),
         ('vcheck-group', v_a, 'Four bakes', 'food-cooking', 'vcheck-bake', 4, true, 'friends', 'together');
  insert into public.pursuit_members (pursuit_id, user_id, role, status) values ('vcheck-group', v_b, 'member', 'joined');

  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'sports-fitness', 'vcheck-run', 'photo', 'https://example.invalid/1.jpg', 'run 1', 'vcheck-goal'),
         (v_a, 'sports-fitness', 'vcheck-run', 'photo', 'https://example.invalid/2.jpg', 'run 2', 'vcheck-goal');

  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_a and s.pursuit_id = 'vcheck-goal' and s.kind = 'finish');
  results := array_append(results, case when v_n = 1 then format('%s PASS (reaching a 2-Moment goal issues one Finisher)', v_i)
                                        else format('%s FAIL (Finisher count %s)', v_i, v_n) end);

  -- No goal: two days is not enough, the Finish button gives nothing.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id, created_at)
  values (v_a, 'art-creative', 'vcheck-draw', 'photo', 'https://example.invalid/3.jpg', 'd1', 'vcheck-free', now() - interval '3 days'),
         (v_a, 'art-creative', 'vcheck-draw', 'photo', 'https://example.invalid/4.jpg', 'd2', 'vcheck-free', now() - interval '2 days');
  update public.pursuits set finished_at = now() where public.pursuits.id = 'vcheck-free';
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = 'vcheck-free');
  results := array_append(results, case when v_n = 0 then format('%s PASS (no goal and 2 days: Finish gives no Stub)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- A third day, then finish again: now it counts. Un-finishing takes it back.
  update public.pursuits set finished_at = null where public.pursuits.id = 'vcheck-free';
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id, created_at)
  values (v_a, 'art-creative', 'vcheck-draw', 'photo', 'https://example.invalid/5.jpg', 'd3', 'vcheck-free', now() - interval '1 day');
  update public.pursuits set finished_at = now() where public.pursuits.id = 'vcheck-free';
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = 'vcheck-free' and s.kind = 'finish');
  results := array_append(results, case when v_n = 1 then format('%s PASS (no goal and 3 days: Finisher issued)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);
  update public.pursuits set finished_at = null where public.pursuits.id = 'vcheck-free';
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = 'vcheck-free');
  results := array_append(results, case when v_n = 0 then format('%s PASS (un-finishing removes the Finisher)', v_i)
                                        else format('%s FAIL (still %s)', v_i, v_n) end);
  update public.pursuits set finished_at = now() where public.pursuits.id = 'vcheck-free';

  -- A group Pursuit: B logged once, so with two people B does not get one; A logged 3.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'food-cooking', 'vcheck-bake', 'photo', 'https://example.invalid/6.jpg', 'b1', 'vcheck-group'),
         (v_a, 'food-cooking', 'vcheck-bake', 'photo', 'https://example.invalid/7.jpg', 'b2', 'vcheck-group'),
         (v_b, 'food-cooking', 'vcheck-bake', 'photo', 'https://example.invalid/8.jpg', 'b3', 'vcheck-group'),
         (v_a, 'food-cooking', 'vcheck-bake', 'photo', 'https://example.invalid/9.jpg', 'b4', 'vcheck-group');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = 'vcheck-group' and s.user_id = v_a and s.kind = 'finish');
  d := (select count(*) from public.stubs s where s.pursuit_id = 'vcheck-group' and s.user_id = v_b);
  results := array_append(results, case when v_n = 1 and d = 0 then format('%s PASS (group goal met: A gets one, B with 1 Moment does not)', v_i)
                                        else format('%s FAIL (A %s, B %s)', v_i, v_n, d) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Regular (last month, so the month boundary never moves under the test)
  -- ───────────────────────────────────────────────────────────────────────
  -- Ten photos on one day: one day, no Stub.
  for d in 1..10 loop
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, created_at)
    values (v_a, 'crafts-making', 'vcheck-oneday', 'photo', 'https://example.invalid/o.jpg', 'same day',
            ((v_last_month + 2)::timestamp + interval '12 hours') at time zone 'America/New_York');
  end loop;
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'regular' and s.corner_key = 'crafts-making/vcheck-oneday');
  results := array_append(results, case when v_n = 0 then format('%s PASS (10 Moments on one day: no Regular)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- Ten text Moments on ten days: they do not count.
  for d in 1..10 loop
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, created_at)
    values (v_a, 'books-writing', 'vcheck-text', 'written', 'https://example.invalid/t.jpg', 'words',
            ((v_last_month + d)::timestamp + interval '12 hours') at time zone 'America/New_York');
  end loop;
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'regular' and s.corner_key = 'books-writing/vcheck-text');
  results := array_append(results, case when v_n = 0 then format('%s PASS (10 days of text Moments: no Regular)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- Photos on nine days: not yet. The tenth day: exactly one Regular, for last month.
  for d in 1..9 loop
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, created_at)
    values (v_a, 'crafts-making', 'vcheck-pottery', 'photo', 'https://example.invalid/p.jpg', 'clay',
            ((v_last_month + d)::timestamp + interval '12 hours') at time zone 'America/New_York');
  end loop;
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'regular' and s.corner_key = 'crafts-making/vcheck-pottery');
  results := array_append(results, case when v_n = 0 then format('%s PASS (9 days: no Regular yet)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, created_at)
  values (v_a, 'crafts-making', 'vcheck-pottery', 'photo', 'https://example.invalid/p.jpg', 'clay',
          ((v_last_month + 12)::timestamp + interval '12 hours') at time zone 'America/New_York'),
         (v_a, 'crafts-making', 'vcheck-pottery', 'photo', 'https://example.invalid/p.jpg', 'clay',
          ((v_last_month + 13)::timestamp + interval '12 hours') at time zone 'America/New_York');
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_a and s.kind = 'regular' and s.corner_key = 'crafts-making/vcheck-pottery' and s.period = v_last_month);
  results := array_append(results, case when v_n = 1 then format('%s PASS (10th day issues one Regular; an 11th does not add another)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Drops
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.drops (slug, title, corner_key, target_moments, opens_at, closes_at, max_editions)
  values ('vcheck-one', 'Vcheck capped', 'sports-fitness/vcheck-sunrise', 2, now() - interval '1 day', now() + interval '5 days', 1),
         ('vcheck-two', 'Vcheck open', 'sports-fitness/vcheck-sunrise', 1, now() - interval '1 day', now() + interval '5 days', null),
         ('vcheck-closed', 'Vcheck closed', 'sports-fitness/vcheck-sunrise', 1, now() - interval '3 days', now() - interval '1 day', null);
  v_drop_one := (select dr.id from public.drops dr where dr.slug = 'vcheck-one');
  v_drop_two := (select dr.id from public.drops dr where dr.slug = 'vcheck-two');
  v_drop_closed := (select dr.id from public.drops dr where dr.slug = 'vcheck-closed');

  perform set_config('role', 'authenticated', true);

  -- Only admins write drops.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    insert into public.drops (slug, title, corner_key, target_moments, opens_at, closes_at)
    values ('vcheck-nope', 'Nope', 'sports-fitness/vcheck-sunrise', 1, now(), now() + interval '1 day');
    results := array_append(results, format('%s FAIL (a member created a drop)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a member cannot create a drop)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  v_i := v_i + 1;
  begin
    insert into public.drops (slug, title, corner_key, target_moments, opens_at, closes_at)
    values ('vcheck-admin', 'Admin made', 'sports-fitness/vcheck-sunrise', 1, now() + interval '1 day', now() + interval '2 days');
    results := array_append(results, format('%s PASS (an admin creates a drop)', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- A drop that has not opened is invisible to members.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.drops dr where dr.slug = 'vcheck-admin');
  results := array_append(results, case when v_n = 0 then format('%s PASS (an unopened drop is hidden)', v_i)
                                        else format('%s FAIL (member sees it)', v_i) end);

  -- A joins the capped drop (twice returns the same Pursuit); B finds it full.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_dp_a := public.join_drop(v_drop_one);
  v_t := public.join_drop(v_drop_one);
  v_i := v_i + 1;
  results := array_append(results, case when v_dp_a is not null and v_t = v_dp_a then format('%s PASS (joining twice gives the same Pursuit)', v_i)
                                        else format('%s FAIL (%s vs %s)', v_i, v_dp_a, v_t) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_i := v_i + 1;
  begin
    perform public.join_drop(v_drop_one);
    results := array_append(results, format('%s FAIL (joined a full drop)', v_i));
  exception
    when raise_exception then
      results := array_append(results, case when sqlerrm = 'That one is full.' then format('%s PASS (a full drop refuses the next person)', v_i)
                                            else format('%s FAIL (wrong message: %s)', v_i, sqlerrm) end);
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.join_drop(v_drop_closed);
    results := array_append(results, format('%s FAIL (joined a closed drop)', v_i));
  exception
    when raise_exception then
      results := array_append(results, case when sqlerrm = 'That one has closed.' then format('%s PASS (a closed drop cannot be joined)', v_i)
                                            else format('%s FAIL (wrong message: %s)', v_i, sqlerrm) end);
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- Nobody sets drop_id by hand.
  v_i := v_i + 1;
  begin
    insert into public.pursuits (id, user_id, title, drop_id) values ('vcheck-sneak', v_b, 'Sneak', v_drop_two);
    results := array_append(results, format('%s FAIL (a Pursuit was made with a drop_id)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (drop_id cannot be set on insert)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    update public.pursuits set drop_id = v_drop_two where public.pursuits.id = 'vcheck-goal';
    results := array_append(results, format('%s FAIL (drop_id changed by update)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (drop_id cannot be changed)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_dp_a2 := public.join_drop(v_drop_two);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_dp_b2 := public.join_drop(v_drop_two);

  -- Posting is the owner's job here (signed out, no rate limit).
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  -- One photo toward a 2-Moment drop: nothing yet. The second: the drop Stub, No. 1, and no Finisher.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'sports-fitness', 'vcheck-sunrise', 'photo', 'https://example.invalid/s1.jpg', 'sunrise 1', v_dp_a);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = v_dp_a);
  results := array_append(results, case when v_n = 0 then format('%s PASS (halfway through a drop: no Stub)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'sports-fitness', 'vcheck-sunrise', 'photo', 'https://example.invalid/s2.jpg', 'sunrise 2', v_dp_a);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = v_dp_a and s.kind = 'drop' and s.edition = 1 and s.drop_id = v_drop_one);
  d := (select count(*) from public.stubs s where s.pursuit_id = v_dp_a and s.kind = 'finish');
  results := array_append(results, case when v_n = 1 and d = 0 then format('%s PASS (finishing a drop issues edition 1 and no Finisher)', v_i)
                                        else format('%s FAIL (drop %s, finish %s)', v_i, v_n, d) end);

  -- Two finishers of one drop get editions 1 and 2, in finishing order.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_b, 'sports-fitness', 'vcheck-sunrise', 'photo', 'https://example.invalid/s3.jpg', 'b first', v_dp_b2);
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, pursuit_id)
  values (v_a, 'sports-fitness', 'vcheck-sunrise', 'photo', 'https://example.invalid/s4.jpg', 'a second', v_dp_a2);
  v_i := v_i + 1;
  v_n := (select s.edition from public.stubs s where s.pursuit_id = v_dp_b2 and s.kind = 'drop');
  d := (select s.edition from public.stubs s where s.pursuit_id = v_dp_a2 and s.kind = 'drop');
  results := array_append(results, case when v_n = 1 and d = 2 then format('%s PASS (editions follow finishing order: B 1, A 2)', v_i)
                                        else format('%s FAIL (B %s, A %s)', v_i, v_n, d) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Was there: a host confirms; the Stub gets its Corner key and a notification.
  -- ───────────────────────────────────────────────────────────────────────
  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, created_by, status)
  values (v_space, 'vcheck-closed-space', 'Vcheck closed space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'in_person', 'closed', 'immediate', v_host, 'active');
  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    (v_space, v_host, 'host', 'active', now() - interval '30 days'),
    (v_space, v_a, 'member', 'active', now() - interval '30 days');
  insert into public.space_corners (space_id, corner_id, is_primary)
  values (v_space, (select c.id from public.corners c where c.space_slug = 'sports-fitness' and c.slug = 'vcheck-climb'), true);
  insert into public.space_events (space_id, title, starts_at, ends_at, timezone, meets, neighborhood, city, created_by, status)
  values (v_space, 'Vcheck secret night', now() - interval '3 days', now() - interval '2 days', 'UTC', 'in_person', 'Secret hood', 'Secret city', v_host, 'scheduled');
  v_event := (select e.id from public.space_events e where e.space_id = v_space and e.title = 'Vcheck secret night');
  insert into public.event_rsvps (event_id, user_id) values (v_event, v_a);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_host), true);
  perform public.confirm_event_attendance(v_event, array[v_a]);
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);

  v_i := v_i + 1;
  v_t := (select s.corner_key from public.stubs s where s.user_id = v_a and s.event_id = v_event);
  results := array_append(results, case when v_t = 'sports-fitness/vcheck-climb' then format('%s PASS (an event Stub gets its Corner key)', v_i)
                                        else format('%s FAIL (key %s)', v_i, coalesce(v_t, 'null')) end);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications nt where nt.user_id = v_a and nt.kind = 'stub_earned' and nt.body = 'Vcheck closed space confirmed you were there.');
  results := array_append(results, case when v_n = 1 then format('%s PASS (one stub_earned notification)', v_i)
                                        else format('%s FAIL (got %s)', v_i, v_n) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- Nobody writes Stubs directly; pinning is yours and stops at 3.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  v_i := v_i + 1;
  begin
    insert into public.stubs (user_id, kind, corner_key, period) values (v_a, 'regular', 'x/y', current_date);
    results := array_append(results, format('%s FAIL (self insert worked)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a Stub cannot be inserted by its owner)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.stubs set edition = 1 where public.stubs.user_id = v_a;
    results := array_append(results, format('%s FAIL (self update worked)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (a Stub cannot be edited by its owner)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_n := 0;
  for v_stub in select s.id from public.stubs s where s.user_id = v_a order by s.id limit 3 loop
    perform public.pin_stub(v_stub, true);
    v_n := v_n + 1;
  end loop;
  v_i := v_i + 1;
  begin
    perform public.pin_stub((select s.id from public.stubs s where s.user_id = v_a and s.pinned_at is null order by s.id limit 1), true);
    results := array_append(results, format('%s FAIL (a 4th pin worked)', v_i));
  exception
    when raise_exception then
      results := array_append(results, case when v_n = 3 then format('%s PASS (3 pins, the 4th refused)', v_i)
                                            else format('%s FAIL (only %s pinned)', v_i, v_n) end);
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.pin_stub((select s.id from public.stubs s where s.user_id = v_b order by s.id limit 1), true);
    results := array_append(results, format('%s FAIL (pinned someone else''s Stub)', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS (cannot pin someone else''s Stub)', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Who sees what
  -- ───────────────────────────────────────────────────────────────────────
  -- A sees all of their own: 3 Finishers (goal, free, group), 1 Regular, 2 drops, 1 event = 7.
  v_j := public.get_profile_stubs(v_a);
  v_i := v_i + 1;
  v_n := jsonb_array_length(v_j);
  d := (select count(*) from public.stubs s where s.user_id = v_a);
  results := array_append(results, case when v_n = 7 and d = 7 then format('%s PASS (the owner reads all 7 of their Stubs)', v_i)
                                        else format('%s FAIL (reader %s, table %s)', v_i, v_n, d) end);

  v_i := v_i + 1;
  v_n := ((public.get_profile(v_a::text)) ->> 'stubCount')::int;
  results := array_append(results, case when v_n = 7 then format('%s PASS (the owner''s stubCount is 7)', v_i)
                                        else format('%s FAIL (stubCount %s)', v_i, v_n) end);

  -- C, a stranger: the unshared Pursuit's Finisher is hidden (6), the Closed Space event shows only Corner and month.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_j := public.get_profile_stubs(v_a);
  v_i := v_i + 1;
  v_n := jsonb_array_length(v_j);
  results := array_append(results, case when v_n = 6 then format('%s PASS (a stranger sees 6: the unshared Finisher is hidden)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);
  v_i := v_i + 1;
  v_n := (select count(*) from jsonb_array_elements(v_j) e
           where e ->> 'kind' = 'event' and (e -> 'event' ->> 'full') = 'false'
             and not (e ? 'title') and not ((e -> 'event') ? 'spaceName') and e ->> 'cornerKey' = 'sports-fitness/vcheck-climb');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a Closed Space event shows a stranger only its Corner and month)', v_i)
                                        else format('%s FAIL', v_i) end);
  v_i := v_i + 1;
  v_n := (select count(*) from jsonb_array_elements(v_j) e where e ? 'serial');
  results := array_append(results, case when v_n = 0 then format('%s PASS (serials are the owner''s only)', v_i)
                                        else format('%s FAIL (%s serials shown)', v_i, v_n) end);
  v_i := v_i + 1;
  v_n := ((public.get_profile(v_a::text)) ->> 'stubCount')::int;
  results := array_append(results, case when v_n = 6 then format('%s PASS (a stranger''s stubCount is 6)', v_i)
                                        else format('%s FAIL (stubCount %s)', v_i, v_n) end);

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
