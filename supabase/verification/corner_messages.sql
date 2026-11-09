-- Soosh: Corner chat (20261124000000_corner_chat.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and everything
-- rolls back. Each expected failure is its own begin...exception...end sub-block with strict
-- sqlstate handling; anything else is recorded as ERROR. No select-into, no returning-into,
-- no delete (CLAUDE.md).
--
-- Fixed ids (…91xx): ME …9101, OTHER …9102, BLOCKED …9103 (blocked by ME), ADMIN …9104,
-- PENDING …9105 (signed in, access pending, so not a member), RATE …9106 (rate limit only).
-- Fixture Corner key 'vcheck-space:vcheck-corner'; every message body starts with 'vcheck-'.
-- Every count is scoped to that Corner key.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_me uuid := '00000000-0000-4000-8000-000000009101';
  v_other uuid := '00000000-0000-4000-8000-000000009102';
  v_blocked uuid := '00000000-0000-4000-8000-000000009103';
  v_admin uuid := '00000000-0000-4000-8000-000000009104';
  v_pending uuid := '00000000-0000-4000-8000-000000009105';
  v_rate uuid := '00000000-0000-4000-8000-000000009106';
  v_key text := 'vcheck-space:vcheck-corner';
  v_folder text := 'vcheck-space_vcheck-corner';
  v_mine bigint;
  v_theirs bigint;
  v_body text;
  v_media text[];
  v_removed timestamptz;
begin
  v_owner_role := current_user;

  if to_regclass('public.corner_messages') is null
     or to_regprocedure('public.remove_corner_message(bigint)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261124000000_corner_chat.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_me, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-me@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-other@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_blocked, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-blocked@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-admin@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_pending, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-pending@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_rate, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-rate@chat-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_me, v_other, v_blocked, v_admin, v_rate);
  update public.profiles set access = 'pending' where public.profiles.id = v_pending;
  -- A member is an active account with a birthdate (private.is_active); the pending account is not.
  insert into public.profile_private (user_id, birthdate)
  select u.id, date '1990-01-01' from unnest(array[v_me, v_other, v_blocked, v_admin, v_rate]) as u (id)
  on conflict (user_id) do update set birthdate = excluded.birthdate;
  update public.profiles set is_admin = true where public.profiles.id = v_admin;
  -- ME blocked BLOCKED.
  insert into public.blocks (blocker_id, blocked_id) values (v_me, v_blocked);

  -- 1. A member writes a message and another member reads it.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_me), true);
  insert into public.corner_messages (corner_key, body) values (v_key, '  vcheck-hello from me  ');
  v_mine := (select cm.id from public.corner_messages cm where cm.corner_key = v_key and cm.body like 'vcheck-hello%');
  v_i := v_i + 1;
  results := array_append(results, case when v_mine is not null then format('%s PASS (a member writes a message, as themselves)', v_i)
                                        else format('%s FAIL (message missing)', v_i) end);
  v_i := v_i + 1;
  v_body := (select cm.body from public.corner_messages cm where cm.id = v_mine);
  results := array_append(results, case when v_body = 'vcheck-hello from me' then format('%s PASS (the text is trimmed)', v_i)
                                        else format('%s FAIL (body is [%s])', v_i, v_body) end);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.id = v_mine and cm.user_id = v_me);
  results := array_append(results, case when v_n = 1 then format('%s PASS (user_id is the caller, set by the database)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key);
  results := array_append(results, case when v_n = 1 then format('%s PASS (another member reads the Corner chat)', v_i)
                                        else format('%s FAIL (member sees %s)', v_i, v_n) end);

  -- 2. A signed-out visitor can neither read nor write.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key);
    results := array_append(results, format('%s FAIL (a visitor read %s rows)', v_i, v_n));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a visitor cannot read)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-visitor');
    results := array_append(results, format('%s FAIL (a visitor wrote)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a visitor cannot write)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 3. A pending account (signed in, not a member) can neither read nor write.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_pending), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key);
  results := array_append(results, case when v_n = 0 then format('%s PASS (a pending account reads nothing)', v_i)
                                        else format('%s FAIL (pending sees %s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-pending');
    results := array_append(results, format('%s FAIL (a pending account wrote)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a pending account cannot write)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    perform public.remove_corner_message(v_mine);
    results := array_append(results, format('%s FAIL (a pending account called the removal)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a pending account cannot remove)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 4. A member cannot write as someone else, by id or by policy.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, user_id, body) values (v_key, v_me, 'vcheck-forged');
    results := array_append(results, format('%s FAIL (a member wrote as someone else)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot write as someone else)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    update public.corner_messages set body = 'vcheck-edited' where public.corner_messages.id = v_mine;
    results := array_append(results, format('%s FAIL (a member updated a row directly)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (no direct update, even on your own rows)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 5. Blocks hide messages both ways.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_blocked), true);
  insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-from the blocked one');
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key and cm.user_id = v_me);
  results := array_append(results, case when v_n = 0 then format('%s PASS (the blocked person does not see ME''s messages)', v_i)
                                        else format('%s FAIL (blocked sees %s)', v_i, v_n) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_me), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key and cm.user_id = v_blocked);
  results := array_append(results, case when v_n = 0 then format('%s PASS (ME does not see the person they blocked)', v_i)
                                        else format('%s FAIL (blocker sees %s)', v_i, v_n) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key and cm.user_id in (v_me, v_blocked));
  results := array_append(results, case when v_n = 2 then format('%s PASS (a third member sees both)', v_i)
                                        else format('%s FAIL (third member sees %s)', v_i, v_n) end);

  -- 6. Limits: 500 characters, 4 photos, words or a photo, and a photo only from your own folder.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-' || repeat('a', 493));
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key and char_length(cm.body) = 500);
  results := array_append(results, case when v_n = 1 then format('%s PASS (500 characters is allowed)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-' || repeat('a', 494));
    results := array_append(results, format('%s FAIL (501 characters was allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (501 characters is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_media := array[v_folder || '/' || v_other || '/a.jpg', v_folder || '/' || v_other || '/b.jpg', v_folder || '/' || v_other || '/c.jpg', v_folder || '/' || v_other || '/d.jpg'];
  insert into public.corner_messages (corner_key, body, media_paths) values (v_key, '', v_media);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key and cardinality(cm.media_paths) = 4);
  results := array_append(results, case when v_n = 1 then format('%s PASS (4 photos and no words is allowed)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body, media_paths)
    values (v_key, 'vcheck-five', v_media || array[v_folder || '/' || v_other || '/e.jpg']);
    results := array_append(results, format('%s FAIL (5 photos was allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (5 photos is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body) values (v_key, '   ');
    results := array_append(results, format('%s FAIL (an empty message was allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (no words and no photo is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body, media_paths)
    values (v_key, 'vcheck-borrowed', array[v_folder || '/' || v_me || '/a.jpg']);
    results := array_append(results, format('%s FAIL (a photo from someone else''s folder was allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (a photo path in someone else''s folder is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 7. Removing: the author, an admin, never anyone else; the content is gone for everyone.
  v_theirs := (select cm.id from public.corner_messages cm where cm.corner_key = v_key and cm.user_id = v_other and cm.body like 'vcheck-aaa%');
  v_i := v_i + 1;
  begin
    perform public.remove_corner_message(v_mine);
    results := array_append(results, format('%s FAIL (a member removed someone else''s message)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot remove someone else''s message)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  perform public.remove_corner_message(v_theirs);
  v_body := (select cm.body from public.corner_messages cm where cm.id = v_theirs);
  v_media := (select cm.media_paths from public.corner_messages cm where cm.id = v_theirs);
  v_removed := (select cm.removed_at from public.corner_messages cm where cm.id = v_theirs);
  v_i := v_i + 1;
  results := array_append(results, case when v_removed is not null and v_body = '' and cardinality(v_media) = 0
                                        then format('%s PASS (the author removes their message; text and photos are cleared)', v_i)
                                        else format('%s FAIL (removed_at %s, body [%s])', v_i, v_removed, v_body) end);
  v_i := v_i + 1;
  begin
    perform public.remove_corner_message(v_theirs);
    results := array_append(results, format('%s FAIL (a removed message was removed again)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a removed message cannot be removed again)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_me), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.id = v_theirs and (cm.body <> '' or cardinality(cm.media_paths) > 0));
  results := array_append(results, case when v_n = 0 then format('%s PASS (another member sees no content for a removed message)', v_i)
                                        else format('%s FAIL (content still readable)', v_i) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  perform public.remove_corner_message(v_mine);
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.id = v_mine and cm.removed_at is not null and cm.body = '');
  results := array_append(results, case when v_n = 1 then format('%s PASS (an admin removes any message)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);

  -- 8. Rate limit: 20 in 10 minutes, the 21st is refused.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_rate), true);
  for k in 1..20 loop
    insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-rate ' || k);
  end loop;
  v_i := v_i + 1;
  begin
    insert into public.corner_messages (corner_key, body) values (v_key, 'vcheck-rate 21');
    results := array_append(results, format('%s FAIL (a 21st message in 10 minutes was allowed)', v_i));
  exception
    when sqlstate '55000' then results := array_append(results, format('%s PASS (the 21st message in 10 minutes is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 9. Storage: members write inside their own folder only; a pending account cannot read.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  v_i := v_i + 1;
  v_n := (select count(*) from storage.buckets b where b.id = 'corner-chat' and b.public = false);
  results := array_append(results, case when v_n = 1 then format('%s PASS (the corner-chat bucket exists and is private)', v_i)
                                        else format('%s FAIL (bucket rows %s)', v_i, v_n) end);
  insert into storage.objects (bucket_id, name) values ('corner-chat', v_folder || '/' || v_other || '/vcheck-own.jpg');
  v_i := v_i + 1;
  v_n := (select count(*) from storage.objects o where o.bucket_id = 'corner-chat' and o.name = v_folder || '/' || v_other || '/vcheck-own.jpg');
  results := array_append(results, case when v_n = 1 then format('%s PASS (a member writes into their own folder)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into storage.objects (bucket_id, name) values ('corner-chat', v_folder || '/' || v_me || '/vcheck-foreign.jpg');
    results := array_append(results, format('%s FAIL (a write into someone else''s folder was allowed)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (storage refuses a write outside your own folder)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_me), true);
  v_i := v_i + 1;
  v_n := (select count(*) from storage.objects o where o.bucket_id = 'corner-chat' and o.name = v_folder || '/' || v_other || '/vcheck-own.jpg');
  results := array_append(results, case when v_n = 1 then format('%s PASS (another member reads the photo)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_pending), true);
  v_i := v_i + 1;
  v_n := (select count(*) from storage.objects o where o.bucket_id = 'corner-chat' and o.name = v_folder || '/' || v_other || '/vcheck-own.jpg');
  results := array_append(results, case when v_n = 0 then format('%s PASS (a pending account cannot read the photo)', v_i)
                                        else format('%s FAIL (pending sees %s)', v_i, v_n) end);

  -- 10. Reports take a corner_message target and nothing else new.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_other), true);
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, reason)
  values (v_other, v_me, 'corner_message', v_mine, 'spam');
  v_i := v_i + 1;
  v_n := (select count(*) from public.reports r where r.reporter_id = v_other and r.target_kind = 'corner_message' and r.target_id = v_mine);
  results := array_append(results, case when v_n = 1 then format('%s PASS (a member reports a Corner chat message)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  v_i := v_i + 1;
  begin
    insert into public.reports (reporter_id, target_user_id, target_kind, target_id, reason)
    values (v_other, v_me, 'corner_chat', v_mine, 'spam');
    results := array_append(results, format('%s FAIL (an unknown report kind was allowed)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an unknown report kind is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 11. Structure, read-only: messages go with their author (cascade), live updates and presence are on.
  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c
          where c.conrelid = 'public.corner_messages'::regclass and c.contype = 'f' and c.confdeltype = 'c');
  results := array_append(results, case when v_n = 1 then format('%s PASS (messages cascade with their author)', v_i)
                                        else format('%s FAIL (%s cascading foreign keys)', v_i, v_n) end);
  v_i := v_i + 1;
  v_n := (select count(*) from pg_publication_tables t
          where t.pubname = 'supabase_realtime' and t.schemaname = 'public' and t.tablename = 'corner_messages');
  results := array_append(results, case when v_n = 1 then format('%s PASS (corner_messages is in the Realtime publication)', v_i)
                                        else format('%s FAIL (%s)', v_i, v_n) end);
  v_i := v_i + 1;
  v_n := (select count(*) from pg_policies p
          where p.schemaname = 'realtime' and p.tablename = 'messages' and p.policyname like 'members join Corner chat presence%');
  results := array_append(results, case when v_n = 2 then format('%s PASS (presence policies exist for members)', v_i)
                                        else format('%s FAIL (%s presence policies)', v_i, v_n) end);

  -- Fixture-scoped leftovers, for the record (everything rolls back below).
  v_i := v_i + 1;
  v_n := (select count(*) from public.corner_messages cm where cm.corner_key = v_key);
  results := array_append(results, format('%s INFO (%s fixture messages before rollback)', v_i, v_n));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
