-- Verifies 20261023000000_profiles_column_privacy.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally
-- in RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md); every value is assigned with :=, and each expected
-- failure is its own begin ... exception ... end sub-block with strict sqlstate
-- handling (an unexpected error is recorded as ERROR, never as a pass).
--
-- Fixed ids: ADMIN ...7c01, MEMBER ...7c02. Every read is scoped to these two.
-- Run BEFORE the migration it shows the leak (the privilege checks FAIL).

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner_role text;
  results text[] := '{}';
  v_admin uuid := '00000000-0000-4000-8000-000000007c01';
  v_member uuid := '00000000-0000-4000-8000-000000007c02';
  v_private text[] := array['access', 'invited_by', 'invite_allowance', 'onboarding_completed',
                            'onboarding_completed_at', 'theme_preference', 'is_admin',
                            'discoverable', 'show_this_corner'];
  v_public text[] := array['id', 'username', 'display_name', 'created_at', 'avatar_url', 'tagline',
                           'bio', 'cover_title', 'cover_tagline', 'cover_post_id', 'paused_at',
                           'deletion_requested_at'];
  v_col text;
  v_who text;
  v_bad text;
  v_flag boolean;
  v_text text;
begin
  v_owner_role := current_user;

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priv-admin@priv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priv-member@priv-test.invalid', '', now(), now(), now(), '{}', '{}', false);
  update public.profiles set is_admin = true, invite_allowance = 7 where public.profiles.id = v_admin;

  -- 1. Column privileges, for logged-out (anon) and logged-in (authenticated)
  --    visitors: the owner-only columns are not readable, the public ones are.
  foreach v_who in array array['anon', 'authenticated'] loop
    v_bad := '';
    foreach v_col in array v_private loop
      if has_column_privilege(v_who, 'public.profiles', v_col, 'SELECT') then
        v_bad := v_bad || v_col || ' ';
      end if;
    end loop;
    v_i := v_i + 1;
    results := array_append(results, format('%s %s', v_i,
      case when v_bad = '' then 'PASS ' || v_who || ' cannot read the owner-only columns' else 'FAIL ' || v_who || ' can read: ' || v_bad end));
    v_bad := '';
    foreach v_col in array v_public loop
      if not has_column_privilege(v_who, 'public.profiles', v_col, 'SELECT') then
        v_bad := v_bad || v_col || ' ';
      end if;
    end loop;
    v_i := v_i + 1;
    results := array_append(results, format('%s %s', v_i,
      case when v_bad = '' then 'PASS ' || v_who || ' can read the public columns' else 'FAIL ' || v_who || ' cannot read: ' || v_bad end));
  end loop;

  -- 2. Someone else's admin flag cannot be read by name: refused (42501), and so
  --    is a wildcard read, which is the shape that would put every column on the wire.
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  begin
    v_flag := (select p.is_admin from public.profiles p where p.id = v_admin);
    results := array_append(results, format('%s FAIL a member read another account''s is_admin = %s', v_i, v_flag));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS is_admin is refused to a member', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  v_i := v_i + 1;
  begin
    v_n := (select count(*) from (select p.* from public.profiles p where p.id = v_admin) q);
    results := array_append(results, format('%s FAIL a wildcard read of profiles worked', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS a wildcard read is refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  -- ...while the public columns still read fine.
  v_i := v_i + 1;
  begin
    v_text := (select p.display_name from public.profiles p where p.id = v_admin);
    results := array_append(results, format('%s %s', v_i, case when v_text is not null then 'PASS public columns still read' else 'FAIL no row' end));
  exception when others then
    results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  -- 3. A logged-out visitor is refused the same way.
  v_i := v_i + 1;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    v_flag := (select p.is_admin from public.profiles p where p.id = v_admin);
    results := array_append(results, format('%s FAIL anon read is_admin', v_i));
  exception
    when insufficient_privilege then
      results := array_append(results, format('%s PASS anon is refused is_admin', v_i));
    when others then
      results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  -- 4. my_profile_private(): the owner gets their own row, with their own values.
  if to_regprocedure('public.my_profile_private()') is null then
    v_i := v_i + 1;
    results := array_append(results, format('%s FAIL my_profile_private() does not exist', v_i));
  else
    v_i := v_i + 1;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
    v_n := (select count(*) from public.my_profile_private() m where m.is_admin and m.invite_allowance = 7);
    results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS owner reads own private columns' else 'FAIL rows=' || v_n end));
    perform set_config('role', v_owner_role, true);
    -- ...a member gets their own row, not the admin's.
    v_i := v_i + 1;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
    v_n := (select count(*) from public.my_profile_private() m where not m.is_admin);
    results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS member gets only their own row' else 'FAIL rows=' || v_n end));
    perform set_config('role', v_owner_role, true);
    -- ...with no session it returns nothing.
    v_i := v_i + 1;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', '{}', true);
    v_n := (select count(*) from public.my_profile_private());
    results := array_append(results, format('%s %s', v_i, case when v_n = 0 then 'PASS no session, no row' else 'FAIL rows=' || v_n end));
    perform set_config('role', v_owner_role, true);
    -- ...and anon cannot call it at all.
    v_i := v_i + 1;
    results := array_append(results, format('%s %s', v_i,
      case when has_function_privilege('authenticated', 'public.my_profile_private()', 'EXECUTE')
            and not has_function_privilege('anon', 'public.my_profile_private()', 'EXECUTE')
           then 'PASS authenticated only' else 'FAIL execute privileges' end));
  end if;

  -- 5. Admin-only policies keep working with the column hidden: private.is_admin
  --    reads it as its owner now, so a member asking about the admin gets the
  --    true answer without ever being able to read the column.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_proc p where p.oid = 'private.is_admin(uuid)'::regprocedure and p.prosecdef and p.proconfig is not null);
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS private.is_admin is security definer' else 'FAIL private.is_admin is not definer' end));
  v_i := v_i + 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_member), true);
  begin
    v_flag := private.is_admin(v_admin);
    results := array_append(results, format('%s %s', v_i, case when v_flag then 'PASS the admin policy path still answers true' else 'FAIL answered false' end));
  exception when others then
    results := array_append(results, format('%s ERROR sqlstate=%s %s', v_i, sqlstate, sqlerrm));
  end;
  perform set_config('role', v_owner_role, true);

  -- 6. What people can change about their own profile is unchanged: the column
  --    UPDATE grants were not touched.
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_column_privilege('authenticated', 'public.profiles', 'theme_preference', 'UPDATE')
          and has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')
         then 'PASS update grants unchanged' else 'FAIL update grants changed' end));

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
