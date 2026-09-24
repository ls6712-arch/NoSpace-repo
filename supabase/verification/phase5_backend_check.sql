-- Sushii: Spaces Rework Phase 5 backend — create_space/update_space,
-- request_or_join_space's Moment validation, space_moment_count_30d, and
-- the two notification fixes.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260928000000_spaces_rework_phase5_backend.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome. Expected-failure checks are their own
-- begin...exception...end sub-block, classifying what's caught
-- (raise_exception = P0001, check_violation = 23514, unique_violation =
-- 23505; anything else recorded as 'N ERROR <sqlstate>: <message>', never
-- silently treated as a pass). Expected-success calls are not wrapped,
-- matching the Phase 4/Events scripts' own convention.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   NEW_USER …3001 (fresh account, created_at = now())
--   ESTABLISHED_USER …3002 (created_at = now() - 40 days)
--   JOINER …3003, owning public Moment 900005001 and private Moment
--     900005002
--   OTHER_USER …3004, owning public Moment 900005003 (not JOINER's)
--   M2_HOST …3005, M2_MEMBER …3006 — Space M2 (Closed) …0000000000e1
--   DEL_HOST …3007 — Space DEL …0000000000e2, soft-deleted directly in
--     the fixture (not through request_space_deletion)
--   EVT_HOST …3008, EVT_RSVP …3009 — Space L2 (Open) …0000000000e3
--   Q2_HOST …3010, Q2_MEMBER …3011 — Space Q2 (Closed, sole host)
--     …0000000000e4
--   4 throwaway Corners (space_slug = 'crafts-making'), ids captured at
--   fixture time since corners.id is an identity column

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  results text[] := '{}';
  v_owner_role text;
  v_c1 bigint;
  v_c2 bigint;
  v_c3 bigint;
  v_c4 bigint;
  v_space_id uuid;
  v_space3_id uuid;
  v_l2_event_id bigint;
  v_q2_event_id bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000003001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-new@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-established@phase5-test.invalid', '', now() - interval '40 days', now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-joiner@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-other@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-m2-host@phase5-test.invalid', '', now() - interval '40 days', now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-m2-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-del-host@phase5-test.invalid', '', now() - interval '40 days', now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-evt-host@phase5-test.invalid', '', now() - interval '40 days', now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-evt-rsvp@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-q2-host@phase5-test.invalid', '', now() - interval '40 days', now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000003011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase5b-q2-member@phase5-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5b-corner-1', 'Phase5b Corner 1') returning id into v_c1;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5b-corner-2', 'Phase5b Corner 2') returning id into v_c2;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5b-corner-3', 'Phase5b Corner 3') returning id into v_c3;
  insert into public.corners (space_slug, slug, name) values
    ('crafts-making', 'phase5b-corner-4', 'Phase5b Corner 4') returning id into v_c4;

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, status)
  values
    ('00000000-0000-4000-8000-0000000000e1', 'phase5b-test-m2', 'Phase 5b Test M2', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000003005', 'active'),
    ('00000000-0000-4000-8000-0000000000e2', 'phase5b-test-del', 'Phase 5b Test DEL', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000003007', 'active'),
    ('00000000-0000-4000-8000-0000000000e3', 'phase5b-test-l2', 'Phase 5b Test L2', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-000000003008', 'active'),
    ('00000000-0000-4000-8000-0000000000e4', 'phase5b-test-q2', 'Phase 5b Test Q2', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000003010', 'active');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000003005', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000003006', 'member', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000003007', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000003008', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000003010', 'host', 'active', now() - interval '30 days');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    (900005001, '00000000-0000-4000-8000-000000003003', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Joiner public Moment.', 'public'),
    (900005002, '00000000-0000-4000-8000-000000003003', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Joiner private Moment.', 'just_me'),
    (900005003, '00000000-0000-4000-8000-000000003004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Other user''s public Moment.', 'public'),
    (900005004, '00000000-0000-4000-8000-000000003006', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'M2 member''s Moment.', 'public'),
    (900005005, '00000000-0000-4000-8000-000000003007', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'DEL host''s Moment.', 'public');

  -- M2's own approved Moment, for space_moment_count_30d.
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000e1', 900005004);
  -- DEL's own approved Moment — inserted BEFORE the soft-delete below, so
  -- check 21 (space_moment_count_30d hides a deleted Space's count) is
  -- actually exercising the hiding logic against real data, not just
  -- returning 0 because there was never anything to count.
  insert into public.space_moments (space_id, post_id) values ('00000000-0000-4000-8000-0000000000e2', 900005005);

  -- Soft-delete Space DEL directly (not through request_space_deletion —
  -- only its status is under test here, not the deletion flow itself).
  update public.spaces set status = 'deleted' where id = '00000000-0000-4000-8000-0000000000e2';

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-3. create_space: Corner-count/duplicate/existence validation.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003001"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-new-no-corners', 'No Corners Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[]::bigint[]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-new-4-corners', 'Four Corners Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1, v_c2, v_c3, v_c4]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-new-nonexistent-corner', 'Bad Corner Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[999999999]::bigint[]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 4-6. create_space: blocklist, reserved slug, duplicate slug.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-lego-club', 'LEGO Club', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.create_space('crafts-making', 'Reserved Slug Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-test-m2', 'Duplicate Slug Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when unique_violation then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 7-9. create_space: success, and the creation-limit check by account
  --      age. NEW_USER (fresh account) gets exactly 1; ESTABLISHED_USER
  --      (40 days old) gets more than 1.
  -- ───────────────────────────────────────────────────────────────────────
  select public.create_space('phase5b-new-first', 'New User''s First Space', 'A test Space.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1, v_c2]) into v_space_id;

  select count(*) into v_n from space_members
  where space_members.space_id = v_space_id and space_members.user_id = '00000000-0000-4000-8000-000000003001' and space_members.role = 'host' and space_members.status = 'active';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from space_corners where space_corners.space_id = v_space_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL' end));

  select space_corners.corner_id into v_n from space_corners where space_corners.space_id = v_space_id and space_corners.is_primary;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = v_c1 then 'PASS' else 'FAIL' end));

  -- 10. NEW_USER is now at their limit (1) — a second Space is refused.
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-new-second', 'New User''s Second Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 11. ESTABLISHED_USER's limit is higher than 1 — two Spaces succeed.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003002"}', true);
  perform public.create_space('phase5b-established-first', 'Established First', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-established-second', 'Established Second', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 12-14. update_space: host-only, blocklisted name, gated on an active
  --        Space (DEL was soft-deleted in the fixture).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003006"}', true);
  v_i := v_i + 1;
  begin
    perform public.update_space('00000000-0000-4000-8000-0000000000e1', 'Renamed by non-host', '', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', 'hosts');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003005"}', true);
  v_i := v_i + 1;
  begin
    perform public.update_space('00000000-0000-4000-8000-0000000000e1', 'LEGO Masters', '', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', 'hosts');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS', v_i));
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003007"}', true);
  v_i := v_i + 1;
  begin
    perform public.update_space('00000000-0000-4000-8000-0000000000e2', 'Renamed DEL', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 15-18. request_or_join_space: an attached Moment must be the caller's
  --        own and public; the message + post_id are stored as-is.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003003"}', true);
  v_i := v_i + 1;
  begin
    perform public.request_or_join_space('00000000-0000-4000-8000-0000000000e1', jsonb_build_object('message', 'Hi!', 'post_id', 900005003));
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    perform public.request_or_join_space('00000000-0000-4000-8000-0000000000e1', jsonb_build_object('message', 'Hi!', 'post_id', 900005002));
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select public.request_or_join_space('00000000-0000-4000-8000-0000000000e1', jsonb_build_object('message', 'Hi, I''d love to join!', 'post_id', 900005001)) into v_text;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'pending' then 'PASS' else 'FAIL' end));

  perform set_config('role', v_owner_role, true);
  select space_join_requests.answers::text into v_text from space_join_requests
  where space_join_requests.space_id = '00000000-0000-4000-8000-0000000000e1' and space_join_requests.user_id = '00000000-0000-4000-8000-000000003003';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text::jsonb = jsonb_build_object('message', 'Hi, I''d love to join!', 'post_id', 900005001) then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 19-21. space_moment_count_30d: a Closed non-member gets the real
  --        count (bypassing RLS), while a direct table read still yields
  --        0 rows for them; a deleted Space's count is hidden.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003003"}', true);
  select count(*) into v_n from space_moments where space_moments.space_id = '00000000-0000-4000-8000-0000000000e1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  select public.space_moment_count_30d('00000000-0000-4000-8000-0000000000e1') into v_n;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select public.space_moment_count_30d('00000000-0000-4000-8000-0000000000e2') into v_n;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 22. cancel_event's notification now carries a real href.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003008"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000e3', 'L2 Event', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null) into v_l2_event_id;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003009"}', true);
  perform public.rsvp_to_event(v_l2_event_id);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003008"}', true);
  perform public.cancel_event(v_l2_event_id);
  perform set_config('role', v_owner_role, true);
  select notifications.href into v_text from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000003009' and notifications.kind = 'space_event_cancelled';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = '/space/phase5b-test-l2?tab=events' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 23-24. execute_space_deletion's notification: a different message, no
  --        href (Space Q2, sole host — direct delete).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003010"}', true);
  select public.create_event('00000000-0000-4000-8000-0000000000e4', 'Q2 Event', null, now() + interval '5 days', null, 'America/New_York', 'online', null, null, null) into v_q2_event_id;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003011"}', true);
  perform public.rsvp_to_event(v_q2_event_id);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003010"}', true);
  perform public.request_space_deletion('00000000-0000-4000-8000-0000000000e4');
  perform set_config('role', v_owner_role, true);
  select notifications.body into v_text from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000003011' and notifications.kind = 'space_event_cancelled';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'Q2 Event was cancelled because its Space closed.' then 'PASS' else 'FAIL' end));

  select count(*) into v_n from notifications
  where notifications.user_id = '00000000-0000-4000-8000-000000003011' and notifications.kind = 'space_event_cancelled' and notifications.href is null;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 25-27. create_space: an in-person Space needs a neighborhood and
  --        city; the exact address, when given, lands in
  --        space_private_details (ESTABLISHED_USER, who still has room
  --        under their limit).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003002"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-established-inperson-bad', 'In-Person No Location', '', 'https://example.invalid/cover.jpg', 'in_person', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  select public.create_space(
    'phase5b-established-third', 'Established Third', '', 'https://example.invalid/cover.jpg', 'in_person', 'open', 'immediate', 'hosts', array[v_c1],
    p_neighborhood := 'Downtown', p_city := 'Testville', p_exact_address := '123 Established Ave, Testville'
  ) into v_space3_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_space3_id is not null then 'PASS' else 'FAIL' end));

  select count(*) into v_n from space_private_details
  where space_private_details.space_id = v_space3_id and space_private_details.exact_address = '123 Established Ave, Testville';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 28-30. update_space: a null exact address keeps the current one, and
  --        p_clear_address removes it explicitly (same as update_event);
  --        an in-person Space still needs a neighborhood and city.
  -- ───────────────────────────────────────────────────────────────────────
  perform public.update_space(
    v_space3_id, 'Established Third', '', 'https://example.invalid/cover.jpg', 'in_person', 'open', 'immediate', 'hosts',
    p_neighborhood := 'Downtown', p_city := 'Testville'
  );
  select count(*) into v_n from space_private_details where space_private_details.space_id = v_space3_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  perform public.update_space(
    v_space3_id, 'Established Third', '', 'https://example.invalid/cover.jpg', 'in_person', 'open', 'immediate', 'hosts',
    p_neighborhood := 'Downtown', p_city := 'Testville', p_clear_address := true
  );
  select count(*) into v_n from space_private_details where space_private_details.space_id = v_space3_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003005"}', true);
  v_i := v_i + 1;
  begin
    perform public.update_space('00000000-0000-4000-8000-0000000000e1', 'M2', '', 'https://example.invalid/cover.jpg', 'in_person', 'closed', 'immediate', 'hosts');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 31-32. update_space: switching Closed -> Open is refused while M2 has
  --        JOINER's still-pending request (from check 17); once M2_HOST
  --        resolves it, the switch succeeds.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.update_space('00000000-0000-4000-8000-0000000000e1', 'Phase 5b Test M2', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform public.approve_join_request('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000003003');
  perform public.update_space('00000000-0000-4000-8000-0000000000e1', 'Phase 5b Test M2', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts');
  perform set_config('role', v_owner_role, true);
  select spaces.access into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000e1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'open' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 33. Creation limit: a rolling 30-day window, deleted Spaces included.
  --     NEW_USER's one Space (check 7) gets soft-deleted; they're still
  --     refused a new one, since it was created within the last 30 days
  --     regardless of its current status.
  -- ───────────────────────────────────────────────────────────────────────
  update spaces set status = 'deleted' where spaces.id = v_space_id;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003001"}', true);
  v_i := v_i + 1;
  begin
    perform public.create_space('phase5b-new-third', 'New User''s Third Space', '', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', 'hosts', array[v_c1]);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
