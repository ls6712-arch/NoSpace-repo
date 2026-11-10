-- A new Moment is visible right away; a hold is opt-in and at most 2 hours: 20261127000000_moments_visible_at_once.sql.
--
-- Not a migration. Run AFTER 20261127000000_moments_visible_at_once.sql; before it, case 1 fails.
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'.
-- No select-into, no returning-into, no delete (CLAUDE.md). Every lookup is scoped to the fixture's
-- user id and captions that start with 'VAO '.
--
-- Fixed id: user …9301.
--
-- Cases:
--   1  a Moment sent without visible_at is visible at once (visible_at = created_at)
--   2  a Moment that asks for 2 hours later is held exactly 2 hours
--   3  a Moment that asks for 5 hours later is still held at most 2 hours
--   4  a Moment that asks for a time before it was made becomes visible at created_at
--   5  the column default is now()

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_text text;
  v_owner_role text;
  results text[] := '{}';
  v_u uuid := '00000000-0000-4000-8000-000000009301';
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vao.u@acct-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  insert into public.profile_private (user_id, birthdate) values (v_u, (current_date - interval '25 years')::date);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_u), true);

  v_i := v_i + 1;
  begin
    insert into public.posts (user_id, type, media_url, caption, visibility, audience)
    values (v_u, 'written', '', 'VAO default', 'public', 'everyone');
    insert into public.posts (user_id, type, media_url, caption, visibility, audience, visible_at)
    values (v_u, 'written', '', 'VAO two hours', 'public', 'everyone', now() + interval '2 hours');
    insert into public.posts (user_id, type, media_url, caption, visibility, audience, visible_at)
    values (v_u, 'written', '', 'VAO five hours', 'public', 'everyone', now() + interval '5 hours');
    insert into public.posts (user_id, type, media_url, caption, visibility, audience, visible_at)
    values (v_u, 'written', '', 'VAO past', 'public', 'everyone', now() - interval '1 day');
  exception when others then
    results := results || (v_i || ' ERROR fixture insert ' || sqlstate || ': ' || sqlerrm);
  end;
  perform set_config('role', v_owner_role, true);

  v_n := (select count(*) from public.posts p where p.user_id = v_u and p.caption = 'VAO default' and p.visible_at = p.created_at);
  results := results || (v_i || case when v_n = 1 then ' PASS a Moment without visible_at is visible at once' else ' FAIL ' || v_n end);

  v_n := (select count(*) from public.posts p where p.user_id = v_u and p.caption = 'VAO two hours' and p.visible_at = p.created_at + interval '2 hours');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS Post in 2 hours holds exactly 2 hours' else ' FAIL ' || v_n end);

  v_n := (select count(*) from public.posts p where p.user_id = v_u and p.caption = 'VAO five hours' and p.visible_at = p.created_at + interval '2 hours');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a longer hold is capped at 2 hours' else ' FAIL ' || v_n end);

  v_n := (select count(*) from public.posts p where p.user_id = v_u and p.caption = 'VAO past' and p.visible_at = p.created_at);
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS a past visible_at becomes created_at' else ' FAIL ' || v_n end);

  v_text := (select c.column_default from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'visible_at');
  v_i := v_i + 1;
  results := results || (v_i || case when v_text = 'now()' then ' PASS the column default is now()' else ' FAIL default is ' || coalesce(v_text, 'none') end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
