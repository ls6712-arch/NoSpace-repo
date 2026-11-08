-- Corner walls, PR 1: corner_wall() and corner_passed_along().
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261123000000_corner_walls.sql. Run before it, the script stops and says "NOT APPLIED"
-- and creates nothing.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling; anything unexpected is
-- recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (CLAUDE.md). Every lookup is scoped to the fixture's own ids and
-- captions that start with 'CW ', never to a whole live table.
--
-- Fixed ids. Users: A …9101 (the viewer), B …9102 (Maya, makes), C …9103 (Priya, starts because
-- of B), D …9104 (Sam, finished), E …9105 (blocked by A), F …9106 (follows B), G …9107 (starts
-- because of a private Moment of B). All fixture Moments are in crafts-making/embroidery, except one
-- in the merged-away food-cooking/espresso.
--
-- Cases:
--   1  a private Moment never appears
--   2  a followers-only Moment appears for a follower (F) and not for a stranger (A)
--   3  a finished Pursuit is on Made it and not on Still making
--   4  one card per Pursuit on Still making, its newest Moment
--   5  "Started because of" shows when the source Moment is readable
--   6  "Started because of" is hidden when the source Moment is private
--   7  "{Name} started because of this" names C and not G (G's source is private)
--   8  a blocked person's Moment does not appear
--   9  a Moment in a merged-away Corner counts under the Corner it was merged into
--  10  unknown wall name raises 22023
--  11  signed out (anon) cannot call either function
--  12  Passed along: B to C chain, cut where the source is private, Pursuit title up to 24 characters
--  13  the result has no count, member or follower column
--  14  both functions are security invoker with a pinned search_path

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_state text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009101';
  v_b uuid := '00000000-0000-4000-8000-000000009102';
  v_c uuid := '00000000-0000-4000-8000-000000009103';
  v_d uuid := '00000000-0000-4000-8000-000000009104';
  v_e uuid := '00000000-0000-4000-8000-000000009105';
  v_f uuid := '00000000-0000-4000-8000-000000009106';
  v_g uuid := '00000000-0000-4000-8000-000000009107';
  v_m1 bigint;
  v_m3 bigint;
  v_mpriv bigint;
  v_cols text;
begin
  v_owner_role := current_user;

  if to_regprocedure('public.corner_wall(text,text,timestamptz,integer)') is null
     or to_regprocedure('public.corner_passed_along(text,integer)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261123000000_corner_walls.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (owner) role, which bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values
    (v_a, 'cw.a@acct-test.invalid'), (v_b, 'cw.b@acct-test.invalid'), (v_c, 'cw.c@acct-test.invalid'),
    (v_d, 'cw.d@acct-test.invalid'), (v_e, 'cw.e@acct-test.invalid'), (v_f, 'cw.f@acct-test.invalid'),
    (v_g, 'cw.g@acct-test.invalid')
  ) as u(id, email);

  update public.profiles p set display_name = 'Viewer Fixture' where p.id = v_a;
  update public.profiles p set display_name = 'Maya Fixture' where p.id = v_b;
  update public.profiles p set display_name = 'Priya Fixture' where p.id = v_c;
  update public.profiles p set display_name = 'Sam Fixture' where p.id = v_d;
  update public.profiles p set display_name = 'Erin Fixture' where p.id = v_e;
  update public.profiles p set display_name = 'Fern Fixture' where p.id = v_f;
  update public.profiles p set display_name = 'Gus Fixture' where p.id = v_g;

  -- A birthdate on file makes an account active (20261030144151), which is what the member gate checks.
  insert into public.profile_private (user_id, birthdate) values
    (v_a, (current_date - interval '25 years')::date), (v_b, (current_date - interval '25 years')::date),
    (v_c, (current_date - interval '25 years')::date), (v_d, (current_date - interval '25 years')::date),
    (v_e, (current_date - interval '25 years')::date), (v_f, (current_date - interval '25 years')::date),
    (v_g, (current_date - interval '25 years')::date);

  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_e);
  insert into public.profile_follows (follower_id, followed_id, status) values (v_f, v_b, 'accepted');

  -- Pursuits. cw-pb (B, long title), cw-pc (C), cw-pd (D, finished), cw-pg (G), cw-pe (E).
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, shared, started_at, finished_at) values
    ('cw-pb', v_b, 'Embroider a jacket for the whole winter', 'crafts-making', 'embroidery', true, now() - interval '10 days', null),
    ('cw-pc', v_c, 'Priya cushion', 'crafts-making', 'embroidery', true, now() - interval '5 days', null),
    ('cw-pd', v_d, 'Sam sampler', 'crafts-making', 'embroidery', true, now() - interval '20 days', null),
    ('cw-pg', v_g, 'Gus patch', 'crafts-making', 'embroidery', true, now() - interval '4 days', null),
    ('cw-pe', v_e, 'Erin hoop', 'crafts-making', 'embroidery', true, now() - interval '3 days', null);

  -- Moments.
  insert into public.posts (user_id, hobby_slug, sub_hobby, corner, type, caption, visibility, pursuit_id, created_at) values
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW b first', 'public', 'cw-pb', now() - interval '3 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW b second', 'public', 'cw-pb', now() - interval '2 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW b newest', 'public', 'cw-pb', now() - interval '1 day'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW b private', 'private', null, now() - interval '30 minutes'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW b followers', 'followers', null, now() - interval '40 minutes'),
    (v_c, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW c one', 'public', 'cw-pc', now() - interval '1 hour'),
    (v_d, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW d done', 'public', 'cw-pd', now() - interval '6 days'),
    (v_g, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW g one', 'public', 'cw-pg', now() - interval '2 hours'),
    (v_e, 'crafts-making', 'embroidery', 'embroidery', 'written', 'CW e one', 'public', 'cw-pe', now() - interval '3 hours'),
    (v_b, 'food-cooking', 'espresso', 'espresso', 'written', 'CW espresso', 'public', null, now() - interval '50 minutes');

  v_m1 := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'CW b first');
  v_m3 := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'CW b newest');
  v_mpriv := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'CW b private');

  -- C started because of B's public first Moment; G because of B's private Moment; E (blocked by A) of the public one.
  update public.pursuits pu set inspired_by_post_id = v_m1 where pu.id in ('cw-pc', 'cw-pe');
  update public.pursuits pu set inspired_by_post_id = v_mpriv where pu.id = 'cw-pg';

  -- D finishes. Any Finisher Stub the existing triggers issue stays inside this transaction.
  update public.pursuits pu set finished_at = now() - interval '1 day' where pu.id = 'cw-pd';

  -- ───────────────────────────────────────────────────────────────────────
  -- As A, a stranger to B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  -- 1. private Moment never appears
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'CW b private');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a private Moment never appears' else ' FAIL private Moment appeared ' || v_n || ' times' end);

  -- 2. followers-only: not for the stranger
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'CW b followers');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a followers-only Moment is hidden from a stranger' else ' FAIL followers-only Moment shown to a stranger' end);

  -- 3. finished Pursuit is on Made it, not on Still making
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.pursuit_id = 'cw-pd' and w.finished_at is not null);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the finished Pursuit is on Made it once' else ' FAIL Made it count for the finished Pursuit is ' || v_n end);
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.pursuit_id = 'cw-pd');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS the finished Pursuit is not on Still making' else ' FAIL finished Pursuit also on Still making' end);

  -- 4. one card per Pursuit, newest Moment
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.pursuit_id = 'cw-pb');
  v_text := (select w.caption from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.pursuit_id = 'cw-pb' limit 1);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 and v_text = 'CW b newest' then ' PASS no Pursuit twice on Still making, and it is the newest Moment' else ' FAIL ' || v_n || ' cards, caption ' || coalesce(v_text, 'none') end);

  -- 5. Started because of, readable source (C inspired by B's public Moment)
  v_text := (select w.inspired_by_first_name from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.pursuit_id = 'cw-pc');
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = 'Maya' then ' PASS Started because of shows Maya when the source is readable' else ' FAIL got ' || coalesce(v_text, 'null') end);

  -- 6. Started because of, private source (G inspired by B's private Moment)
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w
          where w.pursuit_id = 'cw-pg' and (w.inspired_by_post_id is not null or w.inspired_by_first_name is not null));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS Started because of is hidden when the source Moment is private' else ' FAIL a private source was revealed' end);

  -- 7. started_because names C, not G, not E (blocked by A)
  v_text := (select array_to_string(w.started_because, ',') from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.pursuit_id = 'cw-pb');
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = 'Priya' then ' PASS only Priya started because of this (not the private-source or blocked one)' else ' FAIL started_because = ' || coalesce(v_text, 'null') end);

  -- 8. blocked person's Moment
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.author_id = v_e);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a blocked person does not appear' else ' FAIL blocked person appeared' end);

  -- 9. alias: a food-cooking/espresso Moment counts under food-cooking/coffee
  v_n := (select count(*) from public.corner_wall('food-cooking/coffee', 'making', null, 24) w where w.caption = 'CW espresso');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a merged-away Corner Moment shows under the kept Corner' else ' FAIL alias count ' || v_n end);

  -- 12. Passed along as A: the B to C chain, cut where G's source is private
  v_n := (select count(*) from public.corner_passed_along('crafts-making/embroidery', 6) c where c.pursuit_id in ('cw-pb', 'cw-pc'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS the Maya to Priya chain shows both people' else ' FAIL chain rows ' || v_n end);
  v_n := (select count(*) from public.corner_passed_along('crafts-making/embroidery', 6) c where c.pursuit_id in ('cw-pg', 'cw-pe'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS the chain is cut at a private source and at a blocked person' else ' FAIL cut links appeared: ' || v_n end);
  v_text := (select c.pursuit_title from public.corner_passed_along('crafts-making/embroidery', 6) c where c.pursuit_id = 'cw-pb' and c.pos = 1);
  v_i := v_i + 1;
  results := results || (v_i || case when char_length(v_text) <= 24 then ' PASS the source Pursuit title is cut to 24 characters' else ' FAIL title length ' || coalesce(char_length(v_text), -1) end);

  -- ───────────────────────────────────────────────────────────────────────
  -- As F, who follows B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'CW b followers');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a followers-only Moment is shown to a follower' else ' FAIL follower saw ' || v_n end);
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'CW b private');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a private Moment is hidden from a follower too' else ' FAIL private shown to a follower' end);

  -- 10. unknown wall name
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    perform 1 from public.corner_wall('crafts-making/embroidery', 'bogus', null, 8);
    results := results || (v_i || ' FAIL an unknown wall name did not raise');
  exception
    when sqlstate '22023' then results := results || (v_i || ' PASS an unknown wall name raises 22023');
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_text = message_text;
      results := results || (v_i || ' ERROR ' || v_state || ': ' || v_text);
  end;

  -- 11. signed out (anon) cannot call either function
  perform set_config('role', 'anon', true);
  v_i := v_i + 1;
  begin
    perform 1 from public.corner_wall('crafts-making/embroidery', 'making', null, 8);
    results := results || (v_i || ' FAIL anon could call corner_wall');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS anon cannot call corner_wall');
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_text = message_text;
      results := results || (v_i || ' ERROR ' || v_state || ': ' || v_text);
  end;
  v_i := v_i + 1;
  begin
    perform 1 from public.corner_passed_along('crafts-making/embroidery', 3);
    results := results || (v_i || ' FAIL anon could call corner_passed_along');
  exception
    when insufficient_privilege then results := results || (v_i || ' PASS anon cannot call corner_passed_along');
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_text = message_text;
      results := results || (v_i || ' ERROR ' || v_state || ': ' || v_text);
  end;
  perform set_config('role', v_owner_role, true);

  -- 13. no count, member or follower column
  v_cols := pg_get_function_result('public.corner_wall(text,text,timestamptz,integer)'::regprocedure)
         || ' ' || pg_get_function_result('public.corner_passed_along(text,integer)'::regprocedure);
  v_i := v_i + 1;
  results := results || (v_i || case when v_cols !~* '(count|member|follower)' then ' PASS the results have no count, member or follower column' else ' FAIL result columns: ' || v_cols end);

  -- 14. security invoker, pinned search_path
  v_n := (select count(*) from pg_proc p
          where p.oid in ('public.corner_wall(text,text,timestamptz,integer)'::regprocedure, 'public.corner_passed_along(text,integer)'::regprocedure)
            and not p.prosecdef
            and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c(setting) where c.setting like 'search_path=%'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 2 then ' PASS both functions are security invoker with a pinned search_path' else ' FAIL ' || v_n || ' of 2' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
