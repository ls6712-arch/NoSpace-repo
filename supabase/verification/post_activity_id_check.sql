-- Soosh: posts.activity_id (20261122000000_post_activity_id.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...', so results land in
-- the error message and everything rolls back. Each expected failure is its own begin...exception...end sub-block with
-- strict sqlstate handling; anything else is recorded as ERROR. No select-into, no returning-into, no delete (CLAUDE.md).
-- Fixtures use type 'photo' with a media_url (posts.media_url is NOT NULL on production).
--
-- Fixed ids: A …d001 (author), C …d002 (another member). Corner 'sports-fitness/vcheck-activity'. Every count is
-- scoped to these ids and to this script's captions.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_owner_role text;
  v_a uuid := '00000000-0000-4000-8000-00000000d001';
  v_c uuid := '00000000-0000-4000-8000-00000000d002';
  v_val text;
begin
  v_owner_role := current_user;

  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'activity_id') then
    raise exception 'RESULTS: NOT APPLIED (run 20261122000000_post_activity_id.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@activity-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-c@activity-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_private = false, access = 'active' where public.profiles.id in (v_a, v_c);
  insert into public.corners (space_slug, slug, name) values ('sports-fitness', 'vcheck-activity', 'Vcheck activity');

  -- 1. The column is nullable text, and an ordinary Moment has none.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at)
  values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a1.jpg', 'vcheck plain', 'public', now());
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts po where po.user_id = v_a and po.caption = 'vcheck plain' and po.activity_id is null)
       + (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'activity_id' and c.is_nullable = 'YES' and c.data_type = 'text') * 10;
  results := array_append(results, case when v_n = 11 then format('%s PASS (a Moment with no activity has null, and the column is nullable text)', v_i)
                                        else format('%s FAIL (score %s)', v_i, v_n) end);

  -- 2. A Moment logged from an activity keeps its id.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, activity_id)
  values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a2.jpg', 'vcheck from activity', 'public', now(), 'origami-1');
  v_val := (select po.activity_id from public.posts po where po.user_id = v_a and po.caption = 'vcheck from activity');
  v_i := v_i + 1;
  results := array_append(results, case when v_val = 'origami-1' then format('%s PASS (the activity id is saved on the Moment)', v_i)
                                        else format('%s FAIL (got %s)', v_i, coalesce(v_val, 'null')) end);

  -- 3. An empty id and an id of 81 characters are refused.
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, activity_id)
    values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a3.jpg', 'vcheck empty id', 'public', now(), '');
    results := array_append(results, format('%s FAIL (an empty id was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an empty id is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, activity_id)
    values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a4.jpg', 'vcheck long id', 'public', now(), repeat('x', 81));
    results := array_append(results, format('%s FAIL (an 81 character id was accepted)', v_i));
  exception
    when check_violation then results := array_append(results, format('%s PASS (an 81 character id is refused)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  -- 4. The column follows the row's own policies. A just_me Moment's activity is not readable by another member;
  --    a public Moment's is.
  insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, visible_at, activity_id)
  values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a5.jpg', 'vcheck private', 'just_me', now(), 'origami-2');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_c), true);
  v_i := v_i + 1;
  v_n := (select count(*) from public.posts po where po.user_id = v_a and po.caption = 'vcheck from activity' and po.activity_id = 'origami-1')
       + (select count(*) from public.posts po where po.user_id = v_a and po.caption = 'vcheck private') * 10;
  results := array_append(results, case when v_n = 1 then format('%s PASS (another member reads the public Moment''s activity and sees nothing of the just_me one)', v_i)
                                        else format('%s FAIL (score %s)', v_i, v_n) end);

  -- 5. A member can log their own Moment with an activity, and cannot write one for someone else.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_a), true);
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, activity_id)
    values (v_a, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a6.jpg', 'vcheck own via rls', 'just_me', 'origami-3');
    results := array_append(results, format('%s PASS (a member saves their own Moment with an activity)', v_i));
  exception
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, hobby_slug, corner, type, media_url, caption, visibility, activity_id)
    values (v_c, 'sports-fitness', 'vcheck-activity', 'photo', 'https://example.invalid/a7.jpg', 'vcheck forged', 'just_me', 'origami-4');
    results := array_append(results, format('%s FAIL (a member wrote a Moment for someone else)', v_i));
  exception
    when insufficient_privilege then results := array_append(results, format('%s PASS (a member cannot write a Moment for someone else)', v_i));
    when others then results := array_append(results, format('%s ERROR (%s %s)', v_i, sqlstate, sqlerrm));
  end;

  perform set_config('role', v_owner_role, true);
  v_n := (select count(*) from public.posts po where po.user_id in (v_a, v_c) and po.caption like 'vcheck%');
  results := array_append(results, format('fixture Moments created: %s (all roll back)', v_n));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
