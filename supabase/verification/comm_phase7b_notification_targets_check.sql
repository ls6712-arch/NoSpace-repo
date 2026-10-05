-- Communication Phase 7B · notification targets — verification.
--
-- Not a migration. Run AFTER 20261016000000_comm_phase7b_notification_targets.sql.
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md); every value is assigned with :=.
--
-- Fixed ids: ACTOR …7b01, TARGET (recipient) …7b02, MUTED …7b03, BLOCKED …7b04.
-- Every count is scoped to these users and to this script's body markers.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_actor uuid := '00000000-0000-4000-8000-000000007b01';
  v_target uuid := '00000000-0000-4000-8000-000000007b02';
  v_muted uuid := '00000000-0000-4000-8000-000000007b03';
  v_blocked uuid := '00000000-0000-4000-8000-000000007b04';
  v_pid text := 'p7b-fixture-pursuit';
  v_post bigint;
  v_missing_post bigint := 999999999999999;
  v_got_post bigint;
  v_got_pursuit text;
begin
  v_owner_role := current_user;

  -- Fixture
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p7b-actor@p7b-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_target, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p7b-target@p7b-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_muted, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p7b-muted@p7b-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_blocked, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p7b-blocked@p7b-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_target, 'pottery', 'photo', 'https://example.test/7b.jpg', 'p7b fixture moment', 'public');
  v_post := (select max(public.posts.id) from public.posts
    where public.posts.user_id = v_target and public.posts.caption = 'p7b fixture moment');

  insert into public.pursuits (id, user_id, title, shared)
  values (v_pid, v_target, 'p7b fixture pursuit', true);

  insert into public.profile_settings (user_id, notification_preferences)
  values (v_muted, '{"muted": ["thoughts"]}'::jsonb)
  on conflict (user_id) do update set notification_preferences = '{"muted": ["thoughts"]}'::jsonb;

  insert into public.blocks (blocker_id, blocked_id) values (v_blocked, v_actor);

  -- Sanity: the "missing" post id really is missing.
  v_n := (select count(*) from public.posts where public.posts.id = v_missing_post);
  if v_n <> 0 then
    results := array_append(results, 'SETUP FAIL missing post id exists');
  end if;

  -- 1. Both columns exist with the right types.
  v_i := v_i + 1;
  v_n := (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'notifications'
      and ((c.column_name = 'target_post_id' and c.data_type = 'bigint')
        or (c.column_name = 'target_pursuit_id' and c.data_type = 'text')));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL found=' || v_n end));

  -- 2. Both foreign keys point at the right table and are ON DELETE SET NULL
  --    (checked read-only; no DELETE in this script).
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.notifications'::regclass
      and c.contype = 'f' and c.confdeltype = 'n'
      and ((a.attname = 'target_post_id' and c.confrelid = 'public.posts'::regclass)
        or (a.attname = 'target_pursuit_id' and c.confrelid = 'public.pursuits'::regclass)));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL found=' || v_n end));

  -- 3. Both columns are indexed.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_indexes i
    where i.schemaname = 'public' and i.tablename = 'notifications'
      and (i.indexdef like '%(target_post_id)%' or i.indexdef like '%(target_pursuit_id)%'));
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL found=' || v_n end));

  -- Inserts, as the signed-in actor. Each row carries its own body marker.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_actor), true);

  insert into public.notifications (user_id, kind, body, href, target_post_id, target_pursuit_id) values
    (v_target, 'thought', 'p7b-moment', '/moment/' || v_post, null, null),
    (v_target, 'pursuit_progress', 'p7b-pursuit', '/pursuit/' || v_pid, null, null),
    (v_target, 'thought', 'p7b-reply', '/moment/' || v_post || '?reply=1', null, null),
    (v_target, 'thought', 'p7b-missing-moment', '/moment/' || v_missing_post, null, null),
    (v_target, 'pursuit_progress', 'p7b-missing-pursuit', '/pursuit/p7b-no-such-pursuit', null, null),
    (v_target, 'thought', 'p7b-overflow', '/moment/99999999999999999999999', null, null),
    (v_target, 'space_join_request', 'p7b-space', '/space/some-space?tab=manage', null, null),
    (v_target, 'thought', 'p7b-nohref', null, null, null),
    (v_target, 'space_join_request', 'p7b-overwrite-space', '/space/some-space', v_post, v_pid),
    (v_target, 'thought', 'p7b-overwrite-missing', '/moment/' || v_missing_post, v_post, v_pid);

  perform set_config('role', v_owner_role, true);

  -- 4. Moment href -> target_post_id; target_pursuit_id stays null.
  v_i := v_i + 1;
  v_got_post := (select public.notifications.target_post_id from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-moment');
  v_got_pursuit := (select public.notifications.target_pursuit_id from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-moment');
  results := array_append(results, format('%s %s', v_i, case when v_got_post = v_post and v_got_pursuit is null then 'PASS' else 'FAIL post=' || coalesce(v_got_post::text, 'null') end));

  -- 5. Pursuit href -> target_pursuit_id; target_post_id stays null.
  v_i := v_i + 1;
  v_got_post := (select public.notifications.target_post_id from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-pursuit');
  v_got_pursuit := (select public.notifications.target_pursuit_id from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-pursuit');
  results := array_append(results, format('%s %s', v_i, case when v_got_pursuit = v_pid and v_got_post is null then 'PASS' else 'FAIL pursuit=' || coalesce(v_got_pursuit, 'null') end));

  -- 6. A moment href with ?reply=1 still parses.
  v_i := v_i + 1;
  v_got_post := (select public.notifications.target_post_id from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-reply');
  results := array_append(results, format('%s %s', v_i, case when v_got_post = v_post then 'PASS' else 'FAIL post=' || coalesce(v_got_post::text, 'null') end));

  -- 7. Nonexistent moment / pursuit ids: the insert succeeded, targets null.
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target
      and public.notifications.body in ('p7b-missing-moment', 'p7b-missing-pursuit')
      and public.notifications.target_post_id is null
      and public.notifications.target_pursuit_id is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL null_rows=' || v_n end));

  -- 8. A moment id too large for bigint does not fail the insert; targets null.
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-overflow'
      and public.notifications.target_post_id is null
      and public.notifications.target_pursuit_id is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 9. A non-matching href (a Space) gets no target.
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-space'
      and public.notifications.target_post_id is null
      and public.notifications.target_pursuit_id is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 10. A null href gets no target.
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target and public.notifications.body = 'p7b-nohref'
      and public.notifications.target_post_id is null
      and public.notifications.target_pursuit_id is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 11. Values the client supplies are overwritten (both with a non-matching
  --     href and with a href that points at a missing moment).
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target
      and public.notifications.body in ('p7b-overwrite-space', 'p7b-overwrite-missing')
      and public.notifications.target_post_id is null
      and public.notifications.target_pursuit_id is null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 2 then 'PASS' else 'FAIL null_rows=' || v_n end));

  -- 12. Backfill rule: with the trigger off, insert rows with null targets,
  --     then run the migration's backfill statements (scoped to the fixture).
  execute 'alter table public.notifications disable trigger notifications_enforce_insert';
  insert into public.notifications (user_id, kind, body, href, actor_id) values
    (v_target, 'thought', 'p7b-backfill-moment', '/moment/' || v_post, v_actor),
    (v_target, 'pursuit_progress', 'p7b-backfill-pursuit', '/pursuit/' || v_pid, v_actor),
    (v_target, 'thought', 'p7b-backfill-overflow', '/moment/99999999999999999999999', v_actor),
    (v_target, 'thought', 'p7b-backfill-missing', '/moment/' || v_missing_post, v_actor);
  execute 'alter table public.notifications enable trigger notifications_enforce_insert';

  update public.notifications
  set target_post_id = (
    select public.posts.id from public.posts
    where public.posts.id = (
      case
        when char_length(substring(public.notifications.href from '^/moment/(\d+)')) <= 18
          then substring(public.notifications.href from '^/moment/(\d+)')::bigint
      end
    )
  )
  where public.notifications.href ~ '^/moment/\d+'
    and public.notifications.user_id = v_target and public.notifications.body like 'p7b-backfill-%';

  update public.notifications
  set target_pursuit_id = (
    select public.pursuits.id from public.pursuits
    where public.pursuits.id = substring(public.notifications.href from '^/pursuit/([^/?]+)')
  )
  where public.notifications.href ~ '^/pursuit/[^/?]+'
    and public.notifications.user_id = v_target and public.notifications.body like 'p7b-backfill-%';

  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_target
      and ((public.notifications.body = 'p7b-backfill-moment' and public.notifications.target_post_id = v_post)
        or (public.notifications.body = 'p7b-backfill-pursuit' and public.notifications.target_pursuit_id = v_pid)
        or (public.notifications.body in ('p7b-backfill-overflow', 'p7b-backfill-missing')
            and public.notifications.target_post_id is null
            and public.notifications.target_pursuit_id is null)));
  results := array_append(results, format('%s %s', v_i, case when v_n = 4 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 13. Mute still drops the insert (MUTED has muted "thoughts").
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_actor), true);
  insert into public.notifications (user_id, kind, body, href)
  values (v_muted, 'thought', 'p7b-muted', '/moment/' || v_post);
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_muted and public.notifications.body = 'p7b-muted');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));

  -- 14. Block still drops the insert (BLOCKED has blocked ACTOR).
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_actor), true);
  insert into public.notifications (user_id, kind, body, href)
  values (v_blocked, 'thought', 'p7b-blocked', '/moment/' || v_post);
  perform set_config('role', v_owner_role, true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications
    where public.notifications.user_id = v_blocked and public.notifications.body = 'p7b-blocked');
  results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS' else 'FAIL rows=' || v_n end));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
