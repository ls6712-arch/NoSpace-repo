-- Soosh core loop v1, PR 4: posts.audience and the session and gold Stubs.
--
-- Not a migration, nothing here alters the schema. Run this AFTER
-- 20261101000000_moment_audience_and_stubs.sql. Run before it, the script stops at
-- the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ends unconditionally in RAISE EXCEPTION
-- 'RESULTS: ...' so a rollback is guaranteed. Each expected failure is its own
-- begin...exception...end sub-block with strict sqlstate handling (23514 for a check,
-- 42501 for a privilege error, P0001 for a raised message); anything else is recorded
-- as 'N ERROR <sqlstate>: <message>', never as a pass. No select-into, no
-- returning-into, no delete (per CLAUDE.md). The cascade from a deleted Pursuit to its
-- Stubs is read from pg_constraint instead of exercised.
--
-- Fixed ids (a block no earlier script uses):
--   OWNER …7001, MEMBER …7002, FOLLOWER …7003 (follows OWNER, not in the Pursuit),
--   STRANGER …7004
--   Pursuit 'moment-audience-check-p1' (OWNER owns it, MEMBER joined)
--   Posts carry the caption 'audience check'.
-- Every count and lookup is scoped to those ids, never to a whole live table.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_s int;
  results text[] := '{}';
  v_owner_role text;
  v_post_group bigint;
  v_post_later bigint;
  v_owner uuid := '00000000-0000-4000-8000-000000007001';
  v_member uuid := '00000000-0000-4000-8000-000000007002';
  v_follower uuid := '00000000-0000-4000-8000-000000007003';
  v_stranger uuid := '00000000-0000-4000-8000-000000007004';
begin
  v_owner_role := current_user;

  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'audience'
  ) or not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'stubs' and c.column_name = 'kind'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261101000000_moment_audience_and_stubs.sql first, nothing was created)';
  end if;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ma-owner@ma-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ma-member@ma-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_follower, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ma-follower@ma-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ma-stranger@ma-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  update public.profiles p set access = 'active' where p.id in (v_owner, v_member, v_follower, v_stranger);

  insert into public.pursuits (id, user_id, title, mode, shared) values
    ('moment-audience-check-p1', v_owner, 'Audience check', 'together', false);
  insert into public.pursuit_members (pursuit_id, user_id, role, status, invited_by) values
    ('moment-audience-check-p1', v_owner, 'owner', 'joined', v_owner),
    ('moment-audience-check-p1', v_member, 'member', 'joined', v_owner);
  insert into public.profile_follows (follower_id, followed_id, status) values (v_follower, v_owner, 'accepted');

  -- ── audience values ─────────────────────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);

  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience)
      values (v_owner, 'check-hobby', 'written', '', 'audience check', 'public', 'everybody');
    results := array_append(results, format('%s FAIL (an unknown audience was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an unknown audience is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience)
      values (v_owner, 'check-hobby', 'written', '', 'audience check', 'followers', 'group');
    results := array_append(results, format('%s FAIL (a group Moment with no Pursuit was accepted)', v_i));
  exception
    when raise_exception then results := array_append(results, format('%s PASS (a group Moment needs a Pursuit)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience, pursuit_id)
      values (v_stranger, 'check-hobby', 'written', '', 'audience check', 'followers', 'group', 'moment-audience-check-p1');
    results := array_append(results, format('%s FAIL (a stranger posted to the group)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (only people in the Pursuit post to its group)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  -- ── a group Moment: stored as just me, read by the group only ────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience, pursuit_id)
      values (v_owner, 'check-hobby', 'written', '', 'audience check', 'public', 'group', 'moment-audience-check-p1');
    v_n := (select count(*) from public.posts x where x.user_id = v_owner and x.caption = 'audience check' and x.audience = 'group' and x.visibility = 'just_me');
    results := array_append(results, case when v_n = 1 then format('%s PASS (a group Moment is stored as just me, even if asked to be public)', v_i)
                                          else format('%s FAIL (stored %s rows as just me)', v_i, v_n) end);
  exception when others then
    results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;
  v_post_group := (select x.id from public.posts x where x.user_id = v_owner and x.audience = 'group' and x.caption = 'audience check' order by x.id limit 1);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts x where x.id = v_post_group);
  results := array_append(results, case when v_n = 1 then format('%s PASS (a member of the Pursuit reads the group Moment)', v_i)
                                        else format('%s FAIL (member sees %s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_follower), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts x where x.id = v_post_group);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a follower outside the Pursuit does not read it)', v_i)
                                        else format('%s FAIL (follower sees %s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts x where x.id = v_post_group);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a stranger does not read it)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  -- ── friends and everyone ride on the existing visibility ─────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience)
    values (v_owner, 'check-hobby', 'written', '', 'audience check friends', 'followers', 'friends'),
           (v_owner, 'check-hobby', 'written', '', 'audience check everyone', 'public', 'everyone');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_follower), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts x where x.user_id = v_owner and x.caption in ('audience check friends', 'audience check everyone'));
  results := array_append(results, case when v_n = 2 then format('%s PASS (a follower reads the friends and everyone Moments)', v_i)
                                        else format('%s FAIL (follower sees %s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts x where x.user_id = v_owner and x.caption in ('audience check friends', 'audience check everyone'));
  results := array_append(results, case when v_n = 1 then format('%s PASS (a stranger reads only the everyone Moment)', v_i)
                                        else format('%s FAIL (stranger sees %s)', v_i, v_n) end);

  -- ── session Stubs: issued by the database, one per Moment, numbered per person ──
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.post_id = v_post_group and s.kind = 'session' and s.user_id = v_owner and s.serial = 1 and s.pursuit_id = 'moment-audience-check-p1');
  results := array_append(results, case when v_n = 1 then format('%s PASS (the group Moment issued a session Stub, serial 1)', v_i)
                                        else format('%s FAIL (matched %s)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id in (v_owner, v_member, v_follower, v_stranger) and s.post_id in (select x.id from public.posts x where x.caption in ('audience check friends', 'audience check everyone')));
  results := array_append(results, case when v_n = 0 then format('%s PASS (Moments with no Pursuit issue no Stub)', v_i)
                                        else format('%s FAIL (%s Stubs)', v_i, v_n) end);

  -- A member's Moment counts toward the Pursuit; so does a Moment attached later.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, audience, pursuit_id)
    values (v_member, 'check-hobby', 'written', '', 'audience check member', 'public', 'everyone', 'moment-audience-check-p1');
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
    values (v_member, 'check-hobby', 'written', '', 'audience check later', 'public');
  v_post_later := (select x.id from public.posts x where x.user_id = v_member and x.caption = 'audience check later');
  update public.posts x set pursuit_id = 'moment-audience-check-p1' where x.id = v_post_later;

  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_member and s.kind = 'session' and s.pursuit_id = 'moment-audience-check-p1');
  v_s := (select max(s.serial) from public.stubs s where s.user_id = v_member);
  results := array_append(results, case when v_n = 2 and v_s = 2 then format('%s PASS (a Moment posted with a Pursuit and one attached later each issue a Stub, serials 1 and 2)', v_i)
                                        else format('%s FAIL (stubs %s, top serial %s)', v_i, v_n, v_s) end);

  -- Attaching the same Pursuit again changes nothing.
  update public.posts x set pursuit_id = 'moment-audience-check-p1' where x.id = v_post_later;
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.post_id = v_post_later);
  results := array_append(results, case when v_n = 1 then format('%s PASS (one Stub per Moment, however often it is attached)', v_i)
                                        else format('%s FAIL (%s Stubs for one Moment)', v_i, v_n) end);

  -- A stranger's Moment tagged with a Pursuit they are not in issues nothing.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, pursuit_id)
    values (v_stranger, 'check-hobby', 'written', '', 'audience check stranger', 'public', 'moment-audience-check-p1');
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_stranger);
  results := array_append(results, case when v_n = 0 then format('%s PASS (no Stub for a Pursuit you are not in)', v_i)
                                        else format('%s FAIL (stranger got %s)', v_i, v_n) end);

  -- ── nobody gives themselves a Stub ──────────────────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_stranger), true);
  v_i := v_i + 1;
  begin
    insert into public.stubs (user_id, kind, post_id, pursuit_id) values (v_stranger, 'session', v_post_later, 'moment-audience-check-p1');
    results := array_append(results, format('%s FAIL (a client inserted a Stub)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a client cannot insert a Stub)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  v_i := v_i + 1;
  begin
    update public.stubs s set serial = 99 where s.user_id = v_stranger;
    results := array_append(results, format('%s FAIL (a client updated a Stub)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a client cannot change a Stub)', v_i));
    when others then results := array_append(results, format('%s ERROR %s: %s', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.pursuit_id = 'moment-audience-check-p1');
  results := array_append(results, case when v_n = 1 then format('%s PASS (you read your own Stubs and no one else''s)', v_i)
                                        else format('%s FAIL (owner reads %s)', v_i, v_n) end);

  -- ── gold: everyone who logged, when the Pursuit is finished ──────────────
  update public.pursuits p set finished_at = now() where p.id = 'moment-audience-check-p1';
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'gold' and s.pursuit_id = 'moment-audience-check-p1' and s.user_id in (v_owner, v_member));
  v_s := (select count(*) from public.stubs s where s.kind = 'gold' and s.pursuit_id = 'moment-audience-check-p1' and s.user_id in (v_follower, v_stranger));
  results := array_append(results, case when v_n = 2 and v_s = 0 then format('%s PASS (finishing issues a gold Stub to each person who logged, and no one else)', v_i)
                                        else format('%s FAIL (gold for loggers %s, for others %s)', v_i, v_n, v_s) end);

  -- Finishing again (reopen then finish) issues no second gold Stub.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_owner), true);
  update public.pursuits p set finished_at = null where p.id = 'moment-audience-check-p1';
  update public.pursuits p set finished_at = now() where p.id = 'moment-audience-check-p1';
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.kind = 'gold' and s.pursuit_id = 'moment-audience-check-p1');
  results := array_append(results, case when v_n = 2 then format('%s PASS (one gold Stub each, however often it is finished)', v_i)
                                        else format('%s FAIL (%s gold Stubs)', v_i, v_n) end);

  v_i := v_i + 1;
  v_n := (select count(*) from public.stubs s where s.user_id = v_owner and s.serial is not null);
  v_s := (select count(distinct s.serial) from public.stubs s where s.user_id = v_owner);
  results := array_append(results, case when v_n = v_s and v_n = 2 then format('%s PASS (the owner''s two Stubs are numbered 1 and 2)', v_i)
                                        else format('%s FAIL (owner has %s Stubs, %s distinct serials)', v_i, v_n, v_s) end);

  -- ── shape: deleting a Pursuit or a Moment takes its Stubs with it ────────
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c where c.conrelid = 'public.stubs'::regclass and c.contype = 'f' and c.confdeltype = 'c'
                 and c.confrelid in ('public.posts'::regclass, 'public.pursuits'::regclass));
  results := array_append(results, case when v_n = 2 then format('%s PASS (Stubs cascade from their Moment and their Pursuit)', v_i)
                                        else format('%s FAIL (%s cascading keys)', v_i, v_n) end);

  v_i := v_i + 1;
  results := array_append(results, case when not has_table_privilege('anon', 'public.stubs', 'SELECT')
                                          and not has_table_privilege('authenticated', 'public.stubs', 'INSERT')
                                          and not has_table_privilege('authenticated', 'public.stubs', 'UPDATE')
                                          and not has_table_privilege('authenticated', 'public.stubs', 'DELETE')
                                        then format('%s PASS (stubs: select for people signed in, nothing else for anyone)', v_i)
                                        else format('%s FAIL (stubs privileges are wrong)', v_i) end);

  perform set_config('role', v_owner_role, true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
