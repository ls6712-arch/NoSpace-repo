-- Sushii: Communication Phase 1 (Safety) — RLS simulation.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260925020000_communication_phase1_safety.sql has been applied.
--
-- Everything — fixture setup AND every check — runs inside ONE
-- begin ... do $$ ... $$ ... rollback, exactly like
-- supabase/verification/phase3_membership_access_check.sql: the do block
-- always ends by RAISE EXCEPTION'ing a single message carrying every
-- check's result, `'RESULTS: 1 PASS, 2 PASS, 3 FAIL, ...'`. That exception
-- IS the output (the SQL Editor shows it as the error text after "Failed
-- to run sql query:") and it also guarantees nothing here ever persists —
-- not the block, not the fixture follow rows, not the test participations,
-- messages or reports — whether every check passes or not. The trailing
-- `rollback;` is a defensive no-op for the (normally unreachable) case
-- where the block somehow returns without raising.
--
-- Uses three REAL existing accounts, read-only in the sense that nothing
-- about them persists after the rollback, per the task's instruction to
-- use existing profile ids rather than inserting fake ones:
--   A  0a653a11-cb43-40f5-be8e-b21efc57891f  (has Moments; is not admin)
--   B  87220a04-06fc-464a-860d-988713665fe0  (has Moments; is not admin;
--                                             already mutually follows A,
--                                             accepted, live — reused
--                                             below as the "known sender"
--                                             fixture and then as the
--                                             target of A's block)
--   C  38b4d8b3-9502-49d8-9b2f-79d387872127  (is an admin; A's only
--                                             existing follow of C is
--                                             'pending', not accepted, so
--                                             C is "unknown" to A — used
--                                             both as the stranger who
--                                             messages A and, later, as
--                                             the admin who reviews
--                                             reports)
--
-- Every check that attempts a write expected to be rejected is its own
-- begin...exception...end sub-block, so one failing attempt can't abort
-- the rest, and each classifies what it caught rather than treating any
-- error as a pass: PASS only for insufficient_privilege (42501, an RLS
-- policy), raise_exception (P0001, one of this migration's own
-- trigger-raised errors), undefined_function (42883, used for the one
-- check that a dropped function is actually gone) — or, for an
-- UPDATE/DELETE, affecting 0 rows with no error at all. A silently
-- dropped INSERT (the notifications trigger's RETURN NULL path) isn't
-- wrapped this way since it raises nothing to catch — those checks just
-- count rows afterward instead. Anything else is recorded as
-- 'N ERROR <sqlstate>: <message>', not PASS — a broken fixture or an
-- unrelated bug must never read as a security win.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_a uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_b uuid := '87220a04-06fc-464a-860d-988713665fe0';
  v_c uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';
  v_a_post bigint := 100104;
  v_b_post bigint;
  v_thread_ca bigint;   -- C -> A direct_message (unknown sender)
  v_thread_ba bigint;   -- B -> A direct_message (known sender, A follows B)
  v_thread_mt bigint;   -- make_together, C -> A
  v_thought_a bigint;   -- fixture Thought authored by A
  v_report_bt bigint;   -- report filed by B, reviewed by C as admin
begin
  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture — runs as the connecting (table-owner) role, which bypasses
  -- RLS by default. A real Moment of B's own, and an explicit (re-)set of
  -- the accepted follow this script's "known sender" and "block removes
  -- follows" checks both depend on, so this script's result doesn't drift
  -- if that live relationship ever changes.
  -- ───────────────────────────────────────────────────────────────────────
  select id into v_b_post from public.posts where user_id = v_b order by created_at desc limit 1;
  if v_b_post is null then
    raise exception 'Fixture error: % (B) has no Moment to test against.', v_b;
  end if;

  insert into public.profile_follows (follower_id, followed_id, status, responded_at)
  values (v_a, v_b, 'accepted', now()), (v_b, v_a, 'accepted', now())
  on conflict (follower_id, followed_id)
  do update set status = 'accepted', responded_at = now();

  insert into public.thoughts (post_id, user_id, body)
  values (v_a_post, v_a, 'Phase 1 safety check fixture thought — rolled back.')
  returning id into v_thought_a;

  -- ───────────────────────────────────────────────────────────────────────
  -- 1-12. Message request: C (unknown to A) messages A.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);

  -- 1. C's client lies and asks for status='accepted' up front — the
  -- server must ignore that and decide 'pending' itself, since A's only
  -- follow of C is 'pending', not accepted.
  insert into public.participations (kind, from_user, to_user, status, intent)
  values ('direct_message', v_c, v_a, 'accepted', 'Saying hi')
  returning id into v_thread_ca;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_ca) = 'pending' then 'PASS' else 'FAIL' end));

  -- 2. C sends the one message a pending thread allows.
  insert into public.messages (participation_id, from_user, body) values (v_thread_ca, v_c, 'Hey! Loved your work.');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i)); -- would have raised on failure

  -- 3. C tries a second message into the same pending thread — must fail.
  v_i := v_i + 1;
  begin
    insert into public.messages (participation_id, from_user, body) values (v_thread_ca, v_c, 'Hello? Anyone there?');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 4. C tries to accept their own request — only the recipient may.
  v_i := v_i + 1;
  begin
    update public.participations set status = 'accepted' where id = v_thread_ca;
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 5. A can preview the pending request's message.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  select count(*) into v_n from public.messages where participation_id = v_thread_ca;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 6. A declines the request.
  update public.participations set status = 'declined' where id = v_thread_ca;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_ca) = 'declined' then 'PASS' else 'FAIL' end));

  -- 7. C still sees their own message in the declined thread.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  select count(*) into v_n from public.messages where participation_id = v_thread_ca;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 8. A no longer sees it — the request was declined, never delivered.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  select count(*) into v_n from public.messages where participation_id = v_thread_ca;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 9. Fix 4: C can't delete their declined DM to A either — the old
  -- policy let a sender delete a declined (or still-pending) thread and
  -- immediately open a new one, defeating Ignore/Decline entirely.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    delete from public.participations where id = v_thread_ca;
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 10. C can't open a second direct_message thread to A — must reuse
  -- the existing (declined, still there since the delete above failed)
  -- one instead.
  v_i := v_i + 1;
  begin
    insert into public.participations (kind, from_user, to_user) values ('direct_message', v_c, v_a);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 11. A reverses the decline — declined -> accepted is an allowed
  -- transition (someone can change their mind).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  update public.participations set status = 'accepted' where id = v_thread_ca;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_ca) = 'accepted' then 'PASS' else 'FAIL' end));

  -- 11-12. Now accepted: both sides can message, without the one-message limit.
  insert into public.messages (participation_id, from_user, body) values (v_thread_ca, v_a, 'Sorry about that — hi!');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread_ca, v_c, 'No worries, hi!');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- ───────────────────────────────────────────────────────────────────────
  -- 13-15. Known sender: B messages A. A already follows B (accepted), so
  -- the thread must come out accepted immediately, no request step.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  insert into public.participations (kind, from_user, to_user) values ('direct_message', v_b, v_a)
  returning id into v_thread_ba;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_ba) = 'accepted' then 'PASS' else 'FAIL' end));

  insert into public.messages (participation_id, from_user, body) values (v_thread_ba, v_b, 'Hi! Fellow maker here.');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread_ba, v_a, 'Hey there!');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- ───────────────────────────────────────────────────────────────────────
  -- 16-21. Make together. Fix 1: the client lies and asks for
  -- status='accepted' up front (the bypass that used to open a message
  -- thread with no request step at all) — the server must force 'pending'
  -- regardless, and C must not be able to message until A actually
  -- accepts. Then the normal accept-and-message flow, unchanged.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  insert into public.participations (kind, from_user, to_user, status, intent)
  values ('make_together', v_c, v_a, 'accepted', 'Sourdough starter swap')
  returning id into v_thread_mt;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_mt) = 'pending' then 'PASS' else 'FAIL' end));

  -- 17. Still pending: C can't message into it yet (unlike direct_message,
  -- make_together/explore_together get no pending-preview allowance).
  v_i := v_i + 1;
  begin
    insert into public.messages (participation_id, from_user, body) values (v_thread_mt, v_c, 'Hi! Sourdough time?');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  update public.participations set status = 'accepted' where id = v_thread_mt;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (select status from public.participations where id = v_thread_mt) = 'accepted' then 'PASS' else 'FAIL' end));

  insert into public.messages (participation_id, from_user, body) values (v_thread_mt, v_a, 'Let''s do it!');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread_mt, v_c, 'Great, when works?');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- ───────────────────────────────────────────────────────────────────────
  -- 20-36. A blocks B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_b);
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i)); -- would have raised on failure

  -- 21. The trigger removed both directions of A<->B's accepted follow.
  select count(*) into v_n from public.profile_follows
  where (follower_id = v_a and followed_id = v_b) or (follower_id = v_b and followed_id = v_a);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 22. B can't ask A anything new (a fresh kind, so this isn't also
  -- exercising the direct_message "already exists" rule).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  v_i := v_i + 1;
  begin
    insert into public.participations (kind, from_user, to_user, status, intent)
    values ('explore_together', v_b, v_a, 'pending', 'Still trying, post-block');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 23. B can't message A any more, even in their existing accepted thread.
  v_i := v_i + 1;
  begin
    insert into public.messages (participation_id, from_user, body) values (v_thread_ba, v_b, 'Still there?');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 24. B can't follow A again.
  v_i := v_i + 1;
  begin
    insert into public.profile_follows (follower_id, followed_id, status) values (v_b, v_a, 'pending');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 25. B can't react to A's Moment.
  v_i := v_i + 1;
  begin
    insert into public.reactions (post_id, user_id, type) values (v_a_post, v_b, 'love');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 26. B can't leave a Thought on A's Moment.
  v_i := v_i + 1;
  begin
    insert into public.thoughts (post_id, user_id, body) values (v_a_post, v_b, 'Still trying, post-block');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 27-29. B can't see A's profile, posts, or the fixture Thought A wrote.
  select count(*) into v_n from public.profiles where id = v_a;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.posts where id = v_a_post;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.thoughts where id = v_thought_a;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 30. Symmetric: A can't ask B anything new either.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    insert into public.participations (kind, from_user, to_user, status, intent)
    values ('explore_together', v_a, v_b, 'pending', 'Still trying, post-block');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 31-32. A can't see B's profile or Moment either.
  select count(*) into v_n from public.profiles where id = v_b;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.posts where id = v_b_post;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 33. B can never see who blocked them.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  select count(*) into v_n from public.blocks where blocked_id = v_b;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 34. A can see their own block.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  select count(*) into v_n from public.blocks where blocker_id = v_a and blocked_id = v_b;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 35-39. Reports.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  insert into public.reports (reporter_id, target_user_id, target_kind, reason, note)
  values (v_c, v_b, 'profile', 'harassment', 'Test report, rolled back.');
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, reason)
  values (v_b, v_a, 'moment', v_a_post, 'spam')
  returning id into v_report_bt;
  v_i := v_i + 1; results := array_append(results, format('%s PASS', v_i));

  -- 36. B (not an admin) sees only their own report — not C's.
  select count(*) into v_n from public.reports where reporter_id = v_c;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  select count(*) into v_n from public.reports where id = v_report_bt;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 37. B (not an admin) can't mark their own report reviewed.
  v_i := v_i + 1;
  begin
    update public.reports set status = 'reviewed' where id = v_report_bt;
    get diagnostics v_n = row_count;
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 38. C (an admin) reads B's report, not just their own.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  select count(*) into v_n from public.reports where id = v_report_bt;
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 39. C (an admin) marks it reviewed; reviewed_by/reviewed_at are the
  -- server's own facts, not whatever the client sends.
  update public.reports set status = 'reviewed' where id = v_report_bt;
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when (
      select status = 'reviewed' and reviewed_by = v_c and reviewed_at is not null
      from public.reports where id = v_report_bt
    ) then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 40-44. Fix 2: notifications hardening.
  -- ───────────────────────────────────────────────────────────────────────

  -- 40. Blocked B still can't notify A — silently dropped, not an error
  -- (see the migration's section 8 header for why silent rather than
  -- raised: the same trigger also has to let a multi-recipient pursuit
  -- notification batch continue for everyone else).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
  insert into public.notifications (user_id, kind, body, href)
  values (v_a, 'message', 'Phase1 verify: blocked-notify marker', '/messages');
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_a and body = 'Phase1 verify: blocked-notify marker';
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL' end));

  -- 41. An absolute URL href is rejected.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  begin
    insert into public.notifications (user_id, kind, body, href) values (v_c, 'message', 'test', 'https://evil.example');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 42. A protocol-relative href ('//host/...') is rejected too — it's
  -- still an off-app destination in a browser, not an in-app path.
  v_i := v_i + 1;
  begin
    insert into public.notifications (user_id, kind, body, href) values (v_c, 'message', 'test', '//evil.example');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 42b. A backslash isn't in the allowed character class either.
  v_i := v_i + 1;
  begin
    insert into public.notifications (user_id, kind, body, href) values (v_c, 'message', 'test', '/\evil.example');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- 42c. Every href a real call site sends today still passes.
  insert into public.notifications (user_id, kind, body, href) values
    (v_c, 'hobby_follow', 'test', '/my-space'),
    (v_c, 'thought', 'test', '/you'),
    (v_c, 'message', 'test', '/messages'),
    (v_c, 'circle_invite', 'test', '/inbox'),
    (v_c, 'pursuit_joined', 'test', '/pursuit/123');
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'test'
    and href in ('/my-space', '/you', '/messages', '/inbox', '/pursuit/123');
  results := array_append(results, format('%s %s', v_i, case when v_n = 5 then 'PASS' else 'FAIL' end));

  -- 43. An unrecognized kind is rejected; 'space_invite' (added this round,
  -- on the app's intended list even though nothing inserts it live today)
  -- is accepted.
  v_i := v_i + 1;
  begin
    insert into public.notifications (user_id, kind, body) values (v_c, 'not_a_real_kind', 'test');
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when raise_exception then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;
  insert into public.notifications (user_id, kind, body) values (v_c, 'space_invite', 'Phase1 verify: space_invite marker');
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'Phase1 verify: space_invite marker';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 44. actor_id can't be spoofed — C inserts claiming to be A; the server
  -- must stamp C's own id regardless of what the client sent.
  insert into public.notifications (user_id, kind, body, actor_id)
  values (v_c, 'message', 'Phase1 verify: actor_id marker', v_a);
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'Phase1 verify: actor_id marker' and actor_id = v_c;
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 44b. actor_name can't be spoofed either — corrected to C's own current
  -- name (public.pursuit_person_name(v_c)), not rejected.
  insert into public.notifications (user_id, kind, body, actor_name)
  values (v_c, 'message', 'Phase1 verify: actor_name spoof marker', 'Definitely Not C');
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'Phase1 verify: actor_name spoof marker'
    and actor_name = public.pursuit_person_name(v_c)
    and actor_name <> 'Definitely Not C';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 44c. The 'Someone' placeholder (ConnectionsContext.tsx's own fallback)
  -- passes through untouched.
  insert into public.notifications (user_id, kind, body, actor_name)
  values (v_c, 'circle_invite', 'Phase1 verify: someone placeholder marker', 'Someone');
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'Phase1 verify: someone placeholder marker' and actor_name = 'Someone';
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- 44d. Sending your own real, current name also passes through untouched
  -- (no spurious correction of an honest caller).
  insert into public.notifications (user_id, kind, body, actor_name)
  values (v_c, 'message', 'Phase1 verify: honest name marker', public.pursuit_person_name(v_c));
  v_i := v_i + 1;
  select count(*) into v_n from public.notifications
  where user_id = v_c and body = 'Phase1 verify: honest name marker' and actor_name = public.pursuit_person_name(v_c);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 45. Fix 3: is_blocked_between is no longer reachable in `public` at
  -- all (moved to `private`, which PostgREST doesn't expose) — calling it
  -- the old way must fail as an unknown function, proving it's actually
  -- gone from there rather than merely hidden behind a revoked grant.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  begin
    perform public.is_blocked_between(v_a, v_b);
    results := array_append(results, format('%s FAIL', v_i));
  exception
    when undefined_function then results := array_append(results, format('%s PASS', v_i));
    when insufficient_privilege then results := array_append(results, format('%s PASS', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ───────────────────────────────────────────────────────────────────────
  -- 46. Fix 5: the one-direct_message-per-pair rule is backed by a real
  -- unique index now, not just the trigger's own `exists` check — a
  -- structural check, since actually racing two concurrent inserts isn't
  -- something one serial script can simulate.
  -- ───────────────────────────────────────────────────────────────────────
  select count(*) into v_n from pg_indexes
  where schemaname = 'public' and indexname = 'participations_one_direct_message_per_pair';
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
