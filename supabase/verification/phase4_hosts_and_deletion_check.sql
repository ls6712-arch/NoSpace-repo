-- Sushii: Spaces Rework Phase 4 — hosts & deletion RLS/logic simulation.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260926000000_spaces_rework_phase4_hosts_and_deletion.sql.
--
-- Same shape as Phase 3's script: one do $$ ... $$ block (fixture +
-- every check), ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: 1 PASS, 2 PASS, ...' so results land in the
-- error message the Editor shows, and a fixture failure surfaces the
-- same way. Every attack/expected-failure check is its own
-- begin...exception...end sub-block, classifying what it caught
-- (insufficient_privilege / raise_exception = PASS, anything else =
-- 'N ERROR <sqlstate>: <message>') rather than treating any error as a
-- pass.
--
-- This phase's fixture interleaves privileged setup (creating requests
-- as a specific host, demoting another, deleting an account) with
-- role-switched checks, so the very first thing it does is capture
-- current_user before any role-switching, to switch back to it whenever
-- a later step needs owner-level access again (sweep_expired_host_
-- handoffs in particular: EXECUTE is revoked from authenticated/anon on
-- purpose, so it can only be called back in the owner context).
--
-- Fixed ids, a distinct block from Phase 3's own fixture range:
--   D (2-host, decline test): host D_HOST1 …1001, host D_HOST2 …1002,
--     member D_MEMBER …1003 — space …0000000000b1
--   E (2-host, timeout test): host E_HOST1 …1004, host E_HOST2 …1005
--     — space …0000000000b2
--   F (departed-host test): hosts F_HOST1 …1006, F_HOST2 …1007 (gets
--     demoted before responding), F_HOST3 …1008 — space …0000000000b3
--   H (sole-host delete + Moments-survive test): host H_HOST …1009,
--     member H_MEMBER …1010 (posts moment 900002001, linked into H)
--     — space …0000000000b4
--   I (handoff test): host I_HOST1 …1011 (account gets deleted),
--     I_OLDMEMBER …1012 (joined before the handoff starts),
--     I_NEWMEMBER …1013 (joined after) — space …0000000000b5
--   J (sweep test): no members at all, host_handoff_started_at
--     pre-fixtured 20 days in the past — space …0000000000b6

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_ts timestamptz;
  results text[] := '{}';
  v_owner_role text;
  v_d_request_id bigint;
  v_e_request_id bigint;
  v_f_request_id bigint;
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-000000001001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-d-host1@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-d-host2@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-d-member@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-e-host1@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-e-host2@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-f-host1@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-f-host2@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-f-host3@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-h-host@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-h-member@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-i-host1@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-i-oldmember@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-000000001013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4-i-newmember@phase4-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by)
  values
    ('00000000-0000-4000-8000-0000000000b1', 'phase4-test-d', 'Phase 4 Test D', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001001'),
    ('00000000-0000-4000-8000-0000000000b2', 'phase4-test-e', 'Phase 4 Test E', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001004'),
    ('00000000-0000-4000-8000-0000000000b3', 'phase4-test-f', 'Phase 4 Test F', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001006'),
    ('00000000-0000-4000-8000-0000000000b4', 'phase4-test-h', 'Phase 4 Test H', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001009'),
    ('00000000-0000-4000-8000-0000000000b5', 'phase4-test-i', 'Phase 4 Test I', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001011');

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by, host_handoff_started_at)
  values
    ('00000000-0000-4000-8000-0000000000b6', 'phase4-test-j', 'Phase 4 Test J', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'immediate', null, '00000000-0000-4000-8000-000000001011', now() - interval '20 days');

  insert into public.space_members (space_id, user_id, role, status, joined_at) values
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000001001', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000001002', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000001003', 'member', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000001004', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000001005', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000001006', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000001007', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000001008', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000001009', 'host', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000001010', 'member', 'active', now() - interval '30 days'),
    ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000001011', 'host', 'active', now() - interval '30 days'),
    -- now() is stable for the whole transaction, so these two are
    -- guaranteed to land on either side of whatever "now()" the trigger
    -- captures later in this same transaction when I_HOST1's account is
    -- deleted, regardless of real elapsed time.
    ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000001012', 'member', 'active', now() - interval '10 days'),
    ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000001013', 'member', 'active', now() + interval '1 hour');

  insert into public.space_private_details (space_id, exact_address)
  values ('00000000-0000-4000-8000-0000000000b4', '789 Phase 4 St, Testville');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value
  values (900002001, '00000000-0000-4000-8000-000000001010', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Phase 4 test Moment (H member).', 'public');

  insert into public.space_moments (space_id, post_id)
  values ('00000000-0000-4000-8000-0000000000b4', 900002001);

  raise notice '--- fixture ready, running checks ---';

  -- ───────────────────────────────────────────────────────────────────────
  -- 1. Last host can't leave (Phase 3 behavior, re-confirmed not re-built).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001009"}', true);
  v_i := v_i + 1;
  begin
    perform public.leave_space('00000000-0000-4000-8000-0000000000b4');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 2. Non-host can't start a deletion request (Space D).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001003"}', true);
  v_i := v_i + 1;
  begin
    perform public.request_space_deletion('00000000-0000-4000-8000-0000000000b1');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- D_HOST1 actually requests deletion (setup, not a numbered check).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001001"}', true);
  perform public.request_space_deletion('00000000-0000-4000-8000-0000000000b1');
  perform set_config('role', v_owner_role, true);
  select space_deletion_requests.id into v_d_request_id
  from space_deletion_requests
  where space_deletion_requests.space_id = '00000000-0000-4000-8000-0000000000b1' and space_deletion_requests.status = 'pending';

  -- 3. Exactly one approval row was created (for D_HOST2, not the requester).
  select count(*) into v_n from space_deletion_approvals
  where space_deletion_approvals.deletion_request_id = v_d_request_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 4. Non-host can't approve/decline it either.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001003"}', true);
  v_i := v_i + 1;
  begin
    perform public.respond_to_deletion_request(v_d_request_id, 'approved');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- D_HOST2 declines (setup action).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001002"}', true);
  perform public.respond_to_deletion_request(v_d_request_id, 'declined');
  perform set_config('role', v_owner_role, true);

  -- 5. A decline cancels the whole request.
  select space_deletion_requests.status into v_text from space_deletion_requests
  where space_deletion_requests.id = v_d_request_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'cancelled' then 'PASS' else 'FAIL' end));

  -- 6. ...and the Space itself is untouched.
  select spaces.status into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b1';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'active' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 7-8. 2-host deletion cancelled by a timeout (Space E).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001004"}', true);
  perform public.request_space_deletion('00000000-0000-4000-8000-0000000000b2');
  perform set_config('role', v_owner_role, true);
  select space_deletion_requests.id into v_e_request_id
  from space_deletion_requests
  where space_deletion_requests.space_id = '00000000-0000-4000-8000-0000000000b2' and space_deletion_requests.status = 'pending';
  -- Fixture: push it past its own expiry directly, rather than waiting 7
  -- real days.
  update space_deletion_requests set expires_at = now() - interval '1 hour'
  where space_deletion_requests.id = v_e_request_id;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001005"}', true);
  v_i := v_i + 1;
  begin
    perform public.respond_to_deletion_request(v_e_request_id, 'approved');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  -- 8. The expired request is now formally cancelled, and E is untouched.
  select space_deletion_requests.status into v_text from space_deletion_requests where space_deletion_requests.id = v_e_request_id;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'cancelled' then 'PASS' else 'FAIL' end));
  select spaces.status into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b2';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'active' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 10. A departed host's missing approval doesn't block completion
  --     (Space F: F_HOST2 gets demoted between the request and the
  --     response that completes it).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001006"}', true);
  perform public.request_space_deletion('00000000-0000-4000-8000-0000000000b3');
  perform set_config('role', v_owner_role, true);
  select space_deletion_requests.id into v_f_request_id
  from space_deletion_requests
  where space_deletion_requests.space_id = '00000000-0000-4000-8000-0000000000b3' and space_deletion_requests.status = 'pending';
  -- F_HOST2 departs (demoted) before ever responding.
  update space_members set role = 'member'
  where space_members.space_id = '00000000-0000-4000-8000-0000000000b3' and space_members.user_id = '00000000-0000-4000-8000-000000001007';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001008"}', true);
  select public.respond_to_deletion_request(v_f_request_id, 'approved') into v_text;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'deleted' then 'PASS' else 'FAIL' end));

  perform set_config('role', v_owner_role, true);
  select spaces.status into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b3';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'deleted' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 12-16. Sole host deletes directly (Space H); Moments survive in
  --        authors' logs; a member reads 0 Moments/0 address afterward.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001009"}', true);
  select public.request_space_deletion('00000000-0000-4000-8000-0000000000b4') into v_text;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'deleted' then 'PASS' else 'FAIL' end));

  perform set_config('role', v_owner_role, true);
  select spaces.status into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b4';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'deleted' then 'PASS' else 'FAIL' end));

  select count(*) into v_n from posts where posts.id = 900002001;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  select count(*) into v_n from space_moments where space_moments.space_id = '00000000-0000-4000-8000-0000000000b4';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001010"}', true);
  select count(*) into v_n from space_moments where space_moments.space_id = '00000000-0000-4000-8000-0000000000b4';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from space_private_details where space_private_details.space_id = '00000000-0000-4000-8000-0000000000b4';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 18-21. Account-deletion handoff (Space I): the trigger fires, a new
  --        joiner can't claim it, a pre-existing member can.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  delete from auth.users where auth.users.id = '00000000-0000-4000-8000-000000001011';

  select spaces.host_handoff_started_at into v_ts from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b5';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_ts is not null then 'PASS' else 'FAIL' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001013"}', true);
  v_i := v_i + 1;
  begin
    perform public.accept_host_handoff('00000000-0000-4000-8000-0000000000b5');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS', v_i));
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001012"}', true);
  v_i := v_i + 1;
  begin
    perform public.accept_host_handoff('00000000-0000-4000-8000-0000000000b5');
    results := array_append(results, format('%s PASS', v_i));
  exception
    when others then
      results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  select space_members.role into v_text from space_members
  where space_members.space_id = '00000000-0000-4000-8000-0000000000b5' and space_members.user_id = '00000000-0000-4000-8000-000000001012';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'host' then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 22-23. The sweep (Space J: pre-fixtured expired handoff, no host).
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', v_owner_role, true);
  perform public.sweep_expired_host_handoffs();

  select spaces.status into v_text from spaces where spaces.id = '00000000-0000-4000-8000-0000000000b6';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_text = 'read_only' then 'PASS' else 'FAIL' end));

  select count(*) into v_n from moderation_queue
  where moderation_queue.target_type = 'space' and moderation_queue.target_id = '00000000-0000-4000-8000-0000000000b6';
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

-- Unreachable in the normal path (the do block above always raises), kept
-- as a defensive no-op in case the Editor's connection is somehow reused
-- afterward.
rollback;
