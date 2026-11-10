-- A Pursuit made from a Moment counts as finished for everyone who can see that Moment (corner_wall).
--
-- Not a migration, nothing here changes the schema or the data for good. Run this AFTER
-- 20261128000000_corner_wall_from_moment.sql. Run before it, the script stops and says "NOT APPLIED"
-- and creates nothing.
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. The expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling; anything unexpected is
-- recorded as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (CLAUDE.md). Every lookup is scoped to the fixture's own ids and
-- captions that start with 'FM ', never to a whole live table.
--
-- A trigger sets posts.visible_at after created_at, so every fixture Moment is back-dated past that.
-- Fixed ids. Users: A …9201 (a stranger to B), B …9202 (makes), C …9203 (someone else), F …9206 (follows B).
-- All fixture Moments are in crafts-making/embroidery.
--
-- Pursuits, all B's, none shared unless said:
--   fm-p1  from_moment, finished. Its Moment is followers-only.      The case this migration is for.
--   fm-p2  made by hand (not from_moment), finished. Moment public.   Must stay as private as before.
--   fm-p3  from_moment, picked back up (not finished). Moment public.
--   fm-p4  shared, finished, made by hand. Moment public.             Unchanged behaviour.
--   fm-p5  from_moment, finished. Moment public.
--
-- Cases:
--   1  B sees their own followers-only Moment on Made it
--   2  a follower sees it on Made it, with its title and when it was finished
--   3  the follower does not see it on Still making
--   4  a private Pursuit made by hand stays on Still making for other people, title not shown
--   5  a from_moment Pursuit that was picked back up is on Still making, not Made it
--   6  a stranger sees the followers-only Moment on neither wall
--   7  a shared finished Pursuit is on Made it once, as before
--   8  a public Moment's from_moment Pursuit is on Made it for a stranger
--   9  someone else's Moment linked to B's from_moment Pursuit does not become Made it
--  10  a from_moment Pursuit inserted already finished earns no Finisher Stub
--  11  the column is boolean, not null, default false
--  12  the helper is security definer with a pinned search_path and anon cannot run it
--  13  corner_wall is still security invoker with a pinned search_path, same result columns
--  14  signed out (anon) still cannot call corner_wall

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_state text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009201';
  v_b uuid := '00000000-0000-4000-8000-000000009202';
  v_c uuid := '00000000-0000-4000-8000-000000009203';
  v_f uuid := '00000000-0000-4000-8000-000000009206';
  v_ts timestamptz;
begin
  v_owner_role := current_user;

  if to_regprocedure('private.moment_pursuit(text,uuid)') is null
     or not exists (
       select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'pursuits' and c.column_name = 'from_moment'
     ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261128000000_corner_wall_from_moment.sql first, nothing was created)';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- Fixture, as the connecting (owner) role, which bypasses RLS.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values
    (v_a, 'fm.a@acct-test.invalid'), (v_b, 'fm.b@acct-test.invalid'),
    (v_c, 'fm.c@acct-test.invalid'), (v_f, 'fm.f@acct-test.invalid')
  ) as u(id, email);

  -- posts.corner is a foreign key to corners (space_slug, slug); the fixture's Corner goes in this transaction only.
  insert into public.corners (space_slug, slug, name) values ('crafts-making', 'embroidery', 'Embroidery')
  on conflict (space_slug, slug) do nothing;

  update public.profiles p set display_name = 'Viewer Fixture' where p.id = v_a;
  update public.profiles p set display_name = 'Maya Fixture' where p.id = v_b;
  update public.profiles p set display_name = 'Cal Fixture' where p.id = v_c;
  update public.profiles p set display_name = 'Fern Fixture' where p.id = v_f;

  -- A birthdate on file makes an account active (20261030144151), which is what the member gate checks.
  insert into public.profile_private (user_id, birthdate) values
    (v_a, (current_date - interval '25 years')::date), (v_b, (current_date - interval '25 years')::date),
    (v_c, (current_date - interval '25 years')::date), (v_f, (current_date - interval '25 years')::date);

  insert into public.profile_follows (follower_id, followed_id, status) values (v_f, v_b, 'accepted');

  -- Pursuits. The from_moment ones are inserted already finished, the way the app writes them.
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, shared, from_moment, started_at, finished_at) values
    ('fm-p1', v_b, 'FM a blue bowl', 'crafts-making', 'embroidery', false, true, now() - interval '2 days', now() - interval '2 days'),
    ('fm-p2', v_b, 'FM kept private', 'crafts-making', 'embroidery', false, false, now() - interval '9 days', now() - interval '3 days'),
    ('fm-p3', v_b, 'FM picked back up', 'crafts-making', 'embroidery', false, true, now() - interval '4 days', null),
    ('fm-p4', v_b, 'FM shared sampler', 'crafts-making', 'embroidery', true, false, now() - interval '20 days', now() - interval '5 days'),
    ('fm-p5', v_b, 'FM a green cup', 'crafts-making', 'embroidery', false, true, now() - interval '6 days', now() - interval '6 days');

  insert into public.posts (user_id, hobby_slug, sub_hobby, corner, type, media_url, caption, visibility, pursuit_id, created_at) values
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM followers made', 'followers', 'fm-p1', now() - interval '2 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM private pursuit', 'public', 'fm-p2', now() - interval '3 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM picked back up', 'public', 'fm-p3', now() - interval '4 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM shared made', 'public', 'fm-p4', now() - interval '5 days'),
    (v_b, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM public made', 'public', 'fm-p5', now() - interval '6 days'),
    -- C's own public Moment, pointed at B's from_moment Pursuit. Nothing in the database stops that link.
    (v_c, 'crafts-making', 'embroidery', 'embroidery', 'written', '', 'FM someone else', 'public', 'fm-p1', now() - interval '7 days');

  -- ───────────────────────────────────────────────────────────────────────
  -- As B, the maker.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);

  -- 1. the maker sees their own on Made it
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM followers made');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the maker sees their followers-only Moment on Made it' else ' FAIL maker Made it count is ' || v_n end);

  -- ───────────────────────────────────────────────────────────────────────
  -- As F, who follows B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);

  -- 2. the follower sees it on Made it, with its title and finished time
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM followers made');
  v_text := (select w.pursuit_title from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM followers made' limit 1);
  v_ts := (select w.finished_at from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM followers made' limit 1);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 and v_text = 'FM a blue bowl' and v_ts is not null
    then ' PASS a follower sees it on Made it with its title and finished time'
    else ' FAIL follower Made it count ' || v_n || ', title ' || coalesce(v_text, 'null') || ', finished ' || coalesce(v_ts::text, 'null') end);

  -- 3. and not on Still making
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM followers made');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS the follower does not see it on Still making' else ' FAIL it is still on Still making for the follower' end);

  -- 4. a private Pursuit made by hand: unchanged. Still making for others, no title.
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM private pursuit');
  v_text := (select coalesce(w.pursuit_title, 'null') from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM private pursuit' limit 1);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 and v_text = 'null'
    then ' PASS a private Pursuit made by hand stays on Still making for others, title not shown'
    else ' FAIL private Pursuit: Made it count ' || v_n || ', title on Still making ' || coalesce(v_text, 'not on the wall') end);

  -- 5. picked back up: Still making, not Made it
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM picked back up');
  v_text := (select count(*)::text from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM picked back up');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 and v_text = '1' then ' PASS a from_moment Pursuit picked back up is on Still making only' else ' FAIL picked back up: made ' || v_n || ', making ' || v_text end);

  -- ───────────────────────────────────────────────────────────────────────
  -- As A, a stranger to B.
  -- ───────────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);

  -- 6. the stranger sees the followers-only Moment nowhere
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM followers made')
       + (select count(*) from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM followers made');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a stranger sees the followers-only Moment on neither wall' else ' FAIL a stranger saw it ' || v_n || ' times' end);

  -- 7. a shared finished Pursuit: on Made it once, as before
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.pursuit_id = 'fm-p4' and w.pursuit_title = 'FM shared sampler');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a shared finished Pursuit is on Made it once, as before' else ' FAIL shared Pursuit Made it count is ' || v_n end);

  -- 8. a public Moment's from_moment Pursuit: Made it for a stranger
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM public made' and w.pursuit_title = 'FM a green cup');
  v_text := (select count(*)::text from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM public made');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 and v_text = '0' then ' PASS a public Moment made from a Moment is on Made it for a stranger' else ' FAIL public from_moment: made ' || v_n || ', making ' || v_text end);

  -- 9. someone else's Moment linked to B's from_moment Pursuit is not Made it
  v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption = 'FM someone else');
  v_text := (select coalesce(w.pursuit_title, 'null') from public.corner_wall('crafts-making/embroidery', 'making', null, 24) w where w.caption = 'FM someone else' limit 1);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 and v_text = 'null'
    then ' PASS someone else''s Moment linked to that Pursuit stays on Still making and learns no title'
    else ' FAIL linked Moment: made ' || v_n || ', title ' || coalesce(v_text, 'not on the wall') end);

  perform set_config('role', v_owner_role, true);

  -- 10. no Finisher Stub for a Pursuit inserted already finished
  v_n := (select count(*) from public.stubs s where s.pursuit_id in ('fm-p1', 'fm-p5'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS a Pursuit inserted already finished earns no Finisher Stub' else ' FAIL ' || v_n || ' Stubs were issued' end);

  -- 11. the column
  v_text := (select c.data_type || ' ' || c.is_nullable || ' ' || coalesce(c.column_default, 'none')
             from information_schema.columns c
             where c.table_schema = 'public' and c.table_name = 'pursuits' and c.column_name = 'from_moment');
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = 'boolean NO false' then ' PASS from_moment is boolean, not null, default false' else ' FAIL column is ' || coalesce(v_text, 'missing') end);

  -- 12. the helper: security definer, pinned search_path, not for anon
  v_n := (select count(*) from pg_proc p
          where p.oid = 'private.moment_pursuit(text,uuid)'::regprocedure
            and p.prosecdef
            and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c(setting) where c.setting like 'search_path=%')
            and not has_function_privilege('anon', p.oid, 'execute')
            and has_function_privilege('authenticated', p.oid, 'execute'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS the helper is security definer with a pinned search_path, and anon cannot run it' else ' FAIL helper settings are wrong' end);

  -- 13. corner_wall: still security invoker, pinned search_path, same result columns
  v_n := (select count(*) from pg_proc p
          where p.oid = 'public.corner_wall(text,text,timestamptz,integer)'::regprocedure
            and not p.prosecdef
            and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c(setting) where c.setting like 'search_path=%'));
  v_text := pg_get_function_result('public.corner_wall(text,text,timestamptz,integer)'::regprocedure);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1
      and v_text = 'TABLE(wall text, post_id bigint, author_id uuid, author_first_name text, author_avatar_url text, is_mine boolean, pursuit_id text, pursuit_title text, media_type text, media_url text, media_urls text[], media_paths text[], caption text, posted_at timestamp with time zone, finished_at timestamp with time zone, has_finisher_stub boolean, inspired_by_post_id bigint, inspired_by_first_name text, started_because text[])'
    then ' PASS corner_wall is still security invoker with a pinned search_path and the same columns'
    else ' FAIL corner_wall: invoker and pinned ' || v_n || ', columns ' || v_text end);

  -- 14. signed out cannot call corner_wall
  v_i := v_i + 1;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    v_n := (select count(*) from public.corner_wall('crafts-making/embroidery', 'made', null, 24) w where w.caption like 'FM %');
    results := results || (v_i || ' FAIL anon called corner_wall and got ' || v_n || ' rows');
  exception
    when insufficient_privilege then
      results := results || (v_i || ' PASS signed out cannot call corner_wall');
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_text = message_text;
      results := results || (v_i || ' ERROR ' || v_state || ': ' || v_text);
  end;
  perform set_config('role', v_owner_role, true);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
