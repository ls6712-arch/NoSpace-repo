-- Sushii: Space Moment sharing — verification.
--
-- Not a migration — nothing here should alter the schema (the INSERTs are
-- fixture data, rolled back unconditionally at the end). Run this AFTER
-- 20261010000000_space_moment_sharing.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome.
--
-- Fixed ids, a distinct block from every earlier script's own range:
--   HOST (host of both Spaces)            00000000-0000-4000-8000-0000000c0001
--   MEMBER_CLOSED (active member, Closed) 00000000-0000-4000-8000-0000000c0002
--   NON_MEMBER (member of neither, not a follower of AUTHOR)
--                                          00000000-0000-4000-8000-0000000c0003
--   AUTHOR (posts every test Moment)      00000000-0000-4000-8000-0000000c0004
--   FOLLOWER (follows AUTHOR, accepted)   00000000-0000-4000-8000-0000000c0005
--   OPEN_SPACE   (access=open, posting_mode=immediate)
--                                          00000000-0000-4000-8000-0000000c00a1
--   CLOSED_SPACE (access=closed, posting_mode=approval)
--                                          00000000-0000-4000-8000-0000000c00a2
--   Posts 900010001-900010007 — see the fixture comments below for which
--   is which.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  v_sqlstate text;
  v_message text;
  results text[] := '{}';
begin
  select current_user into v_owner_role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — as the connecting (table-owner) role, bypasses RLS. The
  -- space_moments before-insert trigger (set_space_moment_status) still
  -- fires regardless — it's not RLS, so status is genuinely
  -- trigger-computed for every link below, same as every earlier Spaces
  -- fixture in this repo.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smshare-host@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-0000000c0002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smshare-member@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-0000000c0003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smshare-nonmember@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-0000000c0004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smshare-author@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    ('00000000-0000-4000-8000-0000000c0005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smshare-follower@phase6-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.spaces (id, slug, name, description, cover_image, meets, access, posting_mode, member_cap, created_by)
  values
    ('00000000-0000-4000-8000-0000000c00a1', 'smshare-test-open-space', 'Share Test Open Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'open', 'immediate', null, '00000000-0000-4000-8000-0000000c0001'),
    ('00000000-0000-4000-8000-0000000c00a2', 'smshare-test-closed-space', 'Share Test Closed Space', 'Test fixture, rolled back.', 'https://example.invalid/cover.jpg', 'online', 'closed', 'approval', null, '00000000-0000-4000-8000-0000000c0001');

  insert into public.space_private_details (space_id, exact_address) values
    ('00000000-0000-4000-8000-0000000c00a1', '1 Open St, Openville'),
    ('00000000-0000-4000-8000-0000000c00a2', '2 Closed Ave, Closedville');

  insert into public.space_members (space_id, user_id, role, status) values
    ('00000000-0000-4000-8000-0000000c00a1', '00000000-0000-4000-8000-0000000c0001', 'host', 'active'),
    ('00000000-0000-4000-8000-0000000c00a2', '00000000-0000-4000-8000-0000000c0001', 'host', 'active'),
    ('00000000-0000-4000-8000-0000000c00a2', '00000000-0000-4000-8000-0000000c0002', 'member', 'active'),
    -- AUTHOR is an active member of OPEN_SPACE too, so check 7 (the
    -- just_me link attempt) isolates the just_me rejection itself rather
    -- than incidentally failing on membership.
    ('00000000-0000-4000-8000-0000000c00a1', '00000000-0000-4000-8000-0000000c0004', 'member', 'active');

  -- FOLLOWER (…c0005) follows AUTHOR (…c0004), already accepted.
  insert into public.profile_follows (follower_id, followed_id, status)
    values ('00000000-0000-4000-8000-0000000c0005', '00000000-0000-4000-8000-0000000c0004', 'accepted');

  insert into public.posts (id, user_id, hobby_slug, type, media_url, caption, visibility) overriding system value values
    -- A: AUTHOR, followers-only, linked into OPEN_SPACE below -> approved
    -- (posting_mode = immediate, any author).
    (900010001, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test A (open, approved).', 'followers'),
    -- B: HOST, followers-only, linked into CLOSED_SPACE below -> approved
    -- (a host's own Moment always auto-approves, any posting_mode).
    (900010002, '00000000-0000-4000-8000-0000000c0001', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test B (closed, approved, host).', 'followers'),
    -- C: AUTHOR, followers-only, linked into CLOSED_SPACE below -> pending
    -- (posting_mode = approval, AUTHOR is not a host there).
    (900010003, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test C (closed, pending).', 'followers'),
    -- D: AUTHOR, just_me — linking attempt (check 7) must be rejected.
    (900010004, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test D (just_me, unlinkable).', 'just_me'),
    -- E: AUTHOR, followers-only, linked into OPEN_SPACE -> approved, then
    -- switched to just_me mid-script (checks 8-10).
    (900010005, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test E (switched to just_me).', 'followers'),
    -- F: AUTHOR, public, never linked — regression check.
    (900010006, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test F (unlinked public).', 'public'),
    -- G: AUTHOR, followers-only, never linked — regression check.
    (900010007, '00000000-0000-4000-8000-0000000c0004', 'crafts-making', 'photo', 'https://example.invalid/photo.jpg', 'Share test G (unlinked followers).', 'followers');

  insert into public.space_moments (space_id, post_id) values
    ('00000000-0000-4000-8000-0000000c00a1', 900010001),
    ('00000000-0000-4000-8000-0000000c00a2', 900010002),
    ('00000000-0000-4000-8000-0000000c00a2', 900010003),
    ('00000000-0000-4000-8000-0000000c00a1', 900010005);

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-2. Moment A (followers-only, approved link to Open Space): a
  --      logged-out visitor and a non-follower/non-member both see it —
  --      the Open Space grants it, not the followers branch.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into v_n from public.posts where posts.id = 900010001;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL logged-out can''t see it' end));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010001;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL non-member/non-follower can''t see it' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 3-4. Moment B (followers-only, approved link to Closed Space): an
  --      active member sees it, a non-member does not.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0002"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010002;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL closed-space member can''t see it' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010002;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL non-member CAN see it' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5-6. Moment C (followers-only, pending link to Closed Space): a host
  --      sees it (approval queue), a regular active member does not.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0001"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL host can''t see the pending link' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0002"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010003;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL a non-host member CAN see the pending link' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 7. A just_me Moment can't be linked into a Space — rejected with the
  --    specific message, not a generic RLS/constraint error.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0004"}', true);
  v_i := v_i + 1;
  begin
    insert into public.space_moments (space_id, post_id)
      values ('00000000-0000-4000-8000-0000000c00a1', 900010004);
    results := array_append(results, format('%s FAIL insert succeeded, should have been rejected', v_i));
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
      results := array_append(results, format('%s %s', v_i,
        case when v_sqlstate = 'P0001' and v_message = 'Private Moments can''t be shared to a Space.' then 'PASS'
        else 'FAIL ' || v_sqlstate || ': ' || v_message end));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 8-10. Moment E (followers-only, approved link to Open Space): a
  --       non-member sees it while linked and followers-only; once AUTHOR
  --       switches it to just_me, the SAME non-member no longer sees it
  --       (rule 1's `visibility <> 'just_me'` — the link row itself is
  --       never touched), but AUTHOR still sees their own post.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010005;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL non-member can''t see it while linked+followers' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0004"}', true);
  update public.posts set visibility = 'just_me' where posts.id = 900010005;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010005;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL non-member CAN still see it after just_me' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0004"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010005;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL author can''t see their own just_me post' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 11-14. Unlinked posts behave exactly as before: public readable by a
  --        stranger, followers-only readable by an accepted follower and
  --        not by a non-follower, own post always readable.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010006;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL stranger can''t see unlinked public post' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0005"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010007;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL follower can''t see unlinked followers post' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0003"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010007;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL non-follower CAN see unlinked followers post' end));

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000c0004"}', true);
  select count(*) into v_n from public.posts where posts.id = 900010007;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL author can''t see their own unlinked post' end));

  perform set_config('role', v_owner_role, true);

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends — the exception aborts the
  -- transaction (nothing above ever persists) and carries every result.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
