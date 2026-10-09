-- Verifies 20261022000000_profile_links_url_scheme.sql. Run AFTER it.
--
-- Not a migration. One transaction, one do $$ ... $$ block, ends unconditionally
-- in RAISE EXCEPTION 'RESULTS: ...' and rolls back. No SELECT/RETURNING INTO and
-- no DELETE (see CLAUDE.md). Each expected failure is its own begin ... exception
-- ... end sub-block with strict sqlstate handling.
--
-- Fixed id: OWNER ...7b01. Every count is scoped to that user's rows.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_owner uuid := '00000000-0000-4000-8000-000000007b01';
  v_bad text;
  results text[] := '{}';
begin
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'links-owner@links-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  -- 1. The constraint exists on profile_links.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_constraint c
    where c.conrelid = 'public.profile_links'::regclass
      and c.conname = 'profile_links_url_http_check' and c.contype = 'c');
  results := array_append(results, format('%s %s', v_i, case when v_n = 1 then 'PASS constraint exists' else 'FAIL constraint exists found=' || v_n end));

  -- 2. https, http and upper-case schemes are accepted.
  v_i := v_i + 1;
  begin
    insert into public.profile_links (id, user_id, label, url, position) values
      ('verify-7b01-a', v_owner, 'a', 'https://github.com/name', 0),
      ('verify-7b01-b', v_owner, 'b', 'http://example.org', 1),
      ('verify-7b01-c', v_owner, 'c', 'HTTPS://Example.org/Path', 2);
    v_n := (select count(*) from public.profile_links p where p.user_id = v_owner);
    results := array_append(results, format('%s %s', v_i, case when v_n = 3 then 'PASS http(s) accepted' else 'FAIL http(s) accepted count=' || v_n end));
  exception when others then
    results := array_append(results, format('%s ERROR http(s) accepted %s %s', v_i, sqlstate, sqlerrm));
  end;

  -- 3-6. Script and other schemes are refused with check_violation (23514).
  foreach v_bad in array array['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)'] loop
    v_i := v_i + 1;
    begin
      insert into public.profile_links (id, user_id, label, url, position)
        values ('verify-7b01-bad-' || v_i, v_owner, 'bad', v_bad, 9);
      results := array_append(results, format('%s FAIL accepted %s', v_i, v_bad));
    exception
      when check_violation then
        results := array_append(results, format('%s PASS refused %s', v_i, v_bad));
      when others then
        results := array_append(results, format('%s ERROR %s %s %s', v_i, v_bad, sqlstate, sqlerrm));
    end;
  end loop;

  -- 7. An update to a script URL is refused too.
  v_i := v_i + 1;
  begin
    update public.profile_links set url = 'javascript:alert(1)' where profile_links.id = 'verify-7b01-a' and profile_links.user_id = v_owner;
    results := array_append(results, format('%s FAIL update accepted', v_i));
  exception
    when check_violation then
      results := array_append(results, format('%s PASS update refused', v_i));
    when others then
      results := array_append(results, format('%s ERROR update %s %s', v_i, sqlstate, sqlerrm));
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
