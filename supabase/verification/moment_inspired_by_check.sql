-- Soosh: "Inspired by" (20261101134703_moment_inspired_by.sql).
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
--   A …9001 (made the Moment that inspires), B …9002 (the one who is inspired),
--   C …9003 (blocked by A). Corner 'sports-fitness/vcheck-insp'.
-- Fixture rows are written as the table owner with no signed-in user; each Moment is made visible
-- at once (visible_at is held to created_at), and the release effects are run by hand. Every count
-- is scoped to the fixture's own ids and hrefs.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_def text;
  v_body text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009001';
  v_b uuid := '00000000-0000-4000-8000-000000009002';
  v_c uuid := '00000000-0000-4000-8000-000000009003';
  v_src bigint;       -- A's public Moment
  v_src_fol bigint;   -- A's followers-only Moment
  v_mine bigint;      -- B's own Moment
  v_ok bigint;        -- B's public Moment inspired by v_src
  v_fol_no bigint;    -- B inspired by A's followers-only Moment, B not yet following A
  v_fol_yes bigint;   -- same, after B follows A
  v_ghost bigint;     -- B inspired by an id that does not exist
  v_self bigint;      -- B inspired by B's own Moment
  v_blocked bigint;   -- C inspired by v_src while blocked by A
  v_priv bigint;      -- B, just_me, inspired
  v_fo bigint;        -- B, followers only, A does not follow B
  v_other bigint;
  v_owner_role text;
begin
  v_owner_role := current_user;

  if to_regprocedure('private.notify_inspired(bigint)') is null
     or not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'inspired_by') then
    raise exception 'RESULTS: NOT APPLIED (run 20261101134703_moment_inspired_by.sql first, nothing was created)';
  end if;

  v_i := v_i + 1;
  v_def := pg_get_functiondef('public.enforce_notification_insert'::regproc);
  results := array_append(results, case when v_def like '%''inspired''%' and v_def like '%''stub_earned''%' and v_def like '%''plan_invite''%'
                                        then format('%s PASS (inspired is an allowed kind and the earlier kinds are still there)', v_i)
                                        else format('%s FAIL (kind list)', v_i) end);

  -- Fixture
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@inspired-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-b@inspired-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-c@inspired-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_a, v_b, v_c);
  insert into public.corners (space_slug, slug, name) values ('sports-fitness', 'vcheck-insp', 'Vcheck inspired');
  insert into public.blocks (blocker_id, blocked_id) values (v_a, v_c);

  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at) values
    (v_a, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/a1.jpg', 'vcheck src', 'public', now()),
    (v_a, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/a2.jpg', 'vcheck src followers', 'followers', now()),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b0.jpg', 'vcheck mine', 'public', now());
  v_src := (select p.id from public.posts p where p.user_id = v_a and p.caption = 'vcheck src');
  v_src_fol := (select p.id from public.posts p where p.user_id = v_a and p.caption = 'vcheck src followers');
  v_mine := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck mine');

  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, inspired_by) values
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b1.jpg', 'vcheck ok', 'public', now(), v_src),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b2.jpg', 'vcheck fol no', 'public', now(), v_src_fol),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b3.jpg', 'vcheck ghost', 'public', now(), 999999999),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b4.jpg', 'vcheck self', 'public', now(), v_mine),
    (v_c, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/c1.jpg', 'vcheck blocked', 'public', now(), v_src),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b5.jpg', 'vcheck priv', 'just_me', now(), v_src),
    (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b6.jpg', 'vcheck fo', 'followers', now(), v_src);
  v_ok := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck ok');
  v_fol_no := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck fol no');
  v_ghost := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck ghost');
  v_self := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck self');
  v_blocked := (select p.id from public.posts p where p.user_id = v_c and p.caption = 'vcheck blocked');
  v_priv := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck priv');
  v_fo := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck fo');

  -- B follows A, then a second Moment inspired by A's followers-only Moment is kept.
  insert into public.profile_follows (follower_id, followed_id, status) values (v_b, v_a, 'accepted');
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, inspired_by)
  values (v_b, 'sports-fitness', 'vcheck-insp', 'photo', 'https://example.invalid/b7.jpg', 'vcheck fol yes', 'public', now(), v_src_fol);
  v_fol_yes := (select p.id from public.posts p where p.user_id = v_b and p.caption = 'vcheck fol yes');

  v_i := v_i + 1;
  results := array_append(results, case when (select p.inspired_by from public.posts p where p.id = v_ok) = v_src
                                        then format('%s PASS (a Moment inspired by a public Moment keeps the link)', v_i)
                                        else format('%s FAIL', v_i) end);
  v_i := v_i + 1;
  results := array_append(results, case when (select p.inspired_by from public.posts p where p.id = v_fol_no) is null
                                          and (select p.inspired_by from public.posts p where p.id = v_fol_yes) = v_src_fol
                                        then format('%s PASS (a followers-only source counts only for someone who follows its author)', v_i)
                                        else format('%s FAIL', v_i) end);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts p where p.id in (v_ghost, v_self, v_blocked) and p.inspired_by is not null);
  results := array_append(results, case when v_n = 0 then format('%s PASS (an unknown id, your own Moment and a blocked pair are stored as no link, and posting did not fail)', v_i)
                                        else format('%s FAIL (%s kept)', v_i, v_n) end);

  -- Set once: changing it is ignored, clearing it is allowed.
  update public.posts set inspired_by = v_src_fol where public.posts.id = v_ok;
  v_i := v_i + 1;
  results := array_append(results, case when (select p.inspired_by from public.posts p where p.id = v_ok) = v_src
                                        then format('%s PASS (the link cannot be changed after posting)', v_i)
                                        else format('%s FAIL', v_i) end);

  -- The notice, at release.
  perform private.apply_release_effects(v_ok);
  perform private.apply_release_effects(v_ok);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications n where n.user_id = v_a and n.kind = 'inspired' and n.href = '/moment/' || v_ok);
  results := array_append(results, case when v_n = 1 then format('%s PASS (A gets exactly one notice for the Moment, even if release runs twice)', v_i)
                                        else format('%s FAIL (%s notices)', v_i, v_n) end);
  v_body := (select n.body from public.notifications n where n.user_id = v_a and n.kind = 'inspired' and n.href = '/moment/' || v_ok);
  v_i := v_i + 1;
  results := array_append(results, case when v_body like '% tried vcheck inspired after seeing yours.' and char_length(v_body) < 300
                                        then format('%s PASS (the body names the person and the Corner, under 300 characters, and has no count)', v_i)
                                        else format('%s FAIL (body: %s)', v_i, v_body) end);

  -- Not told: a Moment only the author sees, a followers-only Moment A does not follow, a blocked pair, no link, your own.
  perform private.apply_release_effects(v_priv);
  perform private.apply_release_effects(v_fo);
  perform private.apply_release_effects(v_blocked);
  perform private.apply_release_effects(v_ghost);
  perform private.apply_release_effects(v_self);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications n
           where n.kind = 'inspired' and n.href in ('/moment/' || v_priv, '/moment/' || v_fo, '/moment/' || v_blocked, '/moment/' || v_ghost, '/moment/' || v_self));
  results := array_append(results, case when v_n = 0 then format('%s PASS (no notice for a just-me Moment, a followers-only Moment A does not follow, a blocked pair, no link or your own)', v_i)
                                        else format('%s FAIL (%s notices)', v_i, v_n) end);

  -- A follows B: a followers-only Moment now reaches A.
  insert into public.profile_follows (follower_id, followed_id, status) values (v_a, v_b, 'accepted');
  v_other := v_fo;
  update public.posts set notified_at = null where public.posts.id = v_other;
  perform private.apply_release_effects(v_other);
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications n where n.user_id = v_a and n.kind = 'inspired' and n.href = '/moment/' || v_other);
  results := array_append(results, case when v_n = 1 then format('%s PASS (a followers-only Moment tells A once A follows the poster)', v_i)
                                        else format('%s FAIL (%s notices)', v_i, v_n) end);

  -- Nobody else is told, and a Moment still held back tells nobody.
  v_i := v_i + 1;
  v_n := (select count(*) from public.notifications n where n.kind = 'inspired' and n.user_id <> v_a
           and n.href in ('/moment/' || v_ok, '/moment/' || v_fo));
  results := array_append(results, case when v_n = 0 then format('%s PASS (only the author of the inspiring Moment is told)', v_i)
                                        else format('%s FAIL', v_i) end);

  -- A kind that is not on the list is still refused (strict: only the trigger's own exception counts).
  v_i := v_i + 1;
  begin
    perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_b), true);
    insert into public.notifications (user_id, kind, body, href) values (v_a, 'vcheck-bogus', 'x', '/my-space');
    results := array_append(results, format('%s FAIL (an unknown kind was accepted)', v_i));
  exception
    when raise_exception then
      results := array_append(results, format('%s PASS (an unknown kind is still refused)', v_i));
    when others then
      results := array_append(results, format('%s ERROR (sqlstate %s: %s)', v_i, sqlstate, sqlerrm));
  end;

  -- Deleting the inspiring Moment clears the link, not the Moment (on delete set null).
  perform set_config('request.jwt.claims', '{}', true);
  v_i := v_i + 1;
  results := array_append(results, case when exists (
      select 1 from pg_constraint c
       where c.conrelid = 'public.posts'::regclass and c.contype = 'f' and c.confrelid = 'public.posts'::regclass and c.confdeltype = 'n')
    then format('%s PASS (posts.inspired_by is on delete set null)', v_i)
    else format('%s FAIL', v_i) end);

  perform set_config('role', v_owner_role, true);
  perform set_config('request.jwt.claims', '{}', true);
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
