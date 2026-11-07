-- Verification for 20261121000000_thought_photos_private.sql.
--
-- Fixture (all rolled back): author A with a followers-only Moment and a
-- thought carrying a private photo path, F who follows A (accepted), S who does
-- not, and a second Moment by A, public, whose thought has a photo too.
-- Every lookup is scoped to the fixture's own ids and object names.
--
-- Expect, in order: 1 PASS column, 2 PASS policy (anon and authenticated), 3 PASS
-- owner reads, 4 PASS follower reads, 5 PASS stranger blocked, 6 PASS public
-- Moment's thought photo readable by a stranger, 7 PASS signed-out reads a
-- public Moment's thought photo, 8 PASS signed-out blocked on a followers-only
-- Moment's thought photo, 9 PASS another person's path refused, 10 PASS both
-- sources refused, 11 PASS photo closed when no thought names it (the state
-- after the thought is deleted).
begin;

do $$
declare
  v_i int := 0;
  v_bool boolean;
  v_n int;
  v_sqlstate text;
  v_owner_role text;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000009301';
  v_f uuid := '00000000-0000-4000-8000-000000009302';
  v_s uuid := '00000000-0000-4000-8000-000000009303';
  v_post_priv bigint;
  v_post_pub bigint;
  v_thought_priv bigint;
  v_obj_priv text;
  v_obj_pub text;
  v_obj_gone text;
  v_obj_other text;
begin
  v_owner_role := current_user;

  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'thoughts' and c.column_name = 'media_path'
  ) then
    raise exception 'RESULTS: NOT APPLIED (run 20261121000000_thought_photos_private.sql first, nothing was created)';
  end if;

  -- Fixture, as the connecting (owner) role, which bypasses RLS. -------------
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', '{}', false
  from (values
    (v_a, 'tp.a@acct-test.invalid'), (v_f, 'tp.f@acct-test.invalid'), (v_s, 'tp.s@acct-test.invalid')
  ) as u(id, email);

  -- Members only: the gate's restrictive policies pass an active account.
  update public.profiles p set is_private = false, access = 'active' where p.id in (v_a, v_f, v_s);

  insert into public.profile_follows (follower_id, followed_id, status) values (v_f, v_a, 'accepted');

  v_post_priv := (
    with ins as (
      insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
      values (v_a, 'writing', 'written', '', 'TP moment followers', 'followers', now())
      returning posts.id
    ) select ins.id from ins
  );
  v_post_pub := (
    with ins as (
      insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility, visible_at)
      values (v_a, 'writing', 'written', '', 'TP moment public', 'public', now())
      returning posts.id
    ) select ins.id from ins
  );

  v_obj_priv := v_a::text || '/' || gen_random_uuid()::text || '.jpg';
  v_obj_pub := v_a::text || '/' || gen_random_uuid()::text || '.jpg';
  v_obj_gone := v_a::text || '/' || gen_random_uuid()::text || '.jpg';
  v_obj_other := v_s::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into storage.objects (bucket_id, name, owner, owner_id) values
    ('moment-media', v_obj_priv, v_a, v_a::text),
    ('moment-media', v_obj_pub, v_a, v_a::text),
    ('moment-media', v_obj_gone, v_a, v_a::text);

  v_thought_priv := (
    with ins as (
      insert into public.thoughts (post_id, user_id, body, media_path)
      values (v_post_priv, v_a, 'TP thought followers', v_obj_priv)
      returning thoughts.id
    ) select ins.id from ins
  );
  insert into public.thoughts (post_id, user_id, body, media_path)
  values (v_post_pub, v_a, 'TP thought public', v_obj_pub);

  -- 1. The column exists, as text.
  v_bool := exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'thoughts' and c.column_name = 'media_path' and c.data_type = 'text'
  );
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS column' else 'FAIL column missing' end));

  -- 2. The storage policy exists, for select, for anon and authenticated (it follows the thought's own visibility).
  v_bool := exists (
    select 1 from pg_policies p
    where p.schemaname = 'storage' and p.tablename = 'objects'
      and p.policyname = 'moment-media: see photos on thoughts you can see'
      and p.cmd = 'SELECT' and p.roles::text[] @> array['anon', 'authenticated'] and cardinality(p.roles) = 2
  );
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS policy' else 'FAIL policy missing or not for anon and authenticated' end));

  perform set_config('role', 'authenticated', true);

  -- 3. The author reads their own photo.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS owner reads' else 'FAIL owner cannot read own thought photo' end));

  -- 4. A follower, who can see the followers-only Moment and its thought, reads it.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS follower reads' else 'FAIL follower cannot read' end));

  -- 5. A stranger cannot, even though the object name is known.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_s), true);
  v_bool := not exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS stranger blocked' else 'FAIL stranger CAN read a followers-only thought photo' end));

  -- 6. A thought under a public Moment: a stranger reads its photo.
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_pub);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS public Moment thought photo readable' else 'FAIL stranger cannot read a public Moment thought photo' end));

  -- 7. Signed out: the photo on a public Moment's thought is readable, as the thought's text is.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  v_bool := exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_pub);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS signed-out reads a public Moment thought photo' else 'FAIL signed-out cannot read a public Moment thought photo' end));

  -- 8. Signed out: the photo on a followers-only Moment's thought is not.
  v_bool := not exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_priv);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS signed-out blocked on a followers-only thought photo' else 'FAIL signed-out CAN read a followers-only thought photo' end));

  perform set_config('role', 'authenticated', true);

  -- 9 and 10 are table constraints, checked as the owner role: row level security
  -- runs before CHECK constraints, so as a member it would hide which one refused.
  perform set_config('role', v_owner_role, true);

  -- 9. A thought cannot point at someone else's folder.
  begin
    insert into public.thoughts (post_id, user_id, body, media_path)
    values (v_post_pub, v_f, 'TP thought bad path', v_obj_other);
    v_i := v_i + 1; results := array_append(results, format('%s FAIL another person''s path accepted', v_i));
  exception
    when check_violation then
      v_i := v_i + 1; results := array_append(results, format('%s PASS another person''s path refused', v_i));
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      v_i := v_i + 1; results := array_append(results, format('%s ERROR unexpected sqlstate %s on other-folder path', v_i, v_sqlstate));
  end;

  -- 10. A thought cannot carry a private path and a public URL at once.
  begin
    insert into public.thoughts (post_id, user_id, body, media_path, media_url)
    values (v_post_pub, v_a, 'TP thought both', v_a::text || '/x.jpg', 'https://example.invalid/x.jpg');
    v_i := v_i + 1; results := array_append(results, format('%s FAIL both sources accepted', v_i));
  exception
    when check_violation then
      v_i := v_i + 1; results := array_append(results, format('%s PASS both sources refused', v_i));
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      v_i := v_i + 1; results := array_append(results, format('%s ERROR unexpected sqlstate %s on both sources', v_i, v_sqlstate));
  end;

  -- 11. A photo no thought or Moment names is closed to everyone but its folder's owner:
  -- what a deleted thought's photo looks like to anyone else.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_f), true);
  v_bool := not exists (select 1 from storage.objects o where o.bucket_id = 'moment-media' and o.name = v_obj_gone);
  v_i := v_i + 1; results := array_append(results, format('%s %s', v_i, case when v_bool then 'PASS photo closed with no thought' else 'FAIL photo with no thought is readable' end));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
