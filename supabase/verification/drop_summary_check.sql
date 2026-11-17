-- Soosh: drop_summary() (20261203000000_drop_summary.sql).
--
-- Not a migration, nothing here alters the schema. Run AFTER that migration.
-- Run before it, the script stops at the first check and says so ("NOT APPLIED").
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...', so results land in the error message and everything
-- rolls back. No select-into, no returning-into, no delete.
--
-- Fixed ids: A …8101 and B …8102. Drops 'vcheck-summary-open', 'vcheck-summary-soon',
-- 'vcheck-summary-closed'. Every count is scoped to those slugs.

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  results text[] := '{}';
  v_a uuid := '00000000-0000-4000-8000-000000008101';
  v_b uuid := '00000000-0000-4000-8000-000000008102';
  v_open bigint;
  v_closed bigint;
begin
  if to_regprocedure('public.drop_summary(text)') is null then
    raise exception 'RESULTS: NOT APPLIED (run 20261203000000_drop_summary.sql first, nothing was created)';
  end if;

  perform set_config('request.jwt.claims', '{}', true);

  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-a@drop-summary-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vcheck-b@drop-summary-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.drops (slug, title, corner_key, target_moments, opens_at, closes_at)
  values ('vcheck-summary-open', 'Vcheck open', 'crafts-making/vcheck-summary', 1, now() - interval '1 day', now() + interval '1 day'),
         ('vcheck-summary-soon', 'Vcheck soon', 'crafts-making/vcheck-summary', 1, now() + interval '1 day', now() + interval '2 days'),
         ('vcheck-summary-closed', 'Vcheck closed', 'crafts-making/vcheck-summary', 1, now() - interval '3 days', now() - interval '1 day');
  v_open := (select d.id from public.drops d where d.slug = 'vcheck-summary-open');
  v_closed := (select d.id from public.drops d where d.slug = 'vcheck-summary-closed');

  perform set_config('soosh.join_drop', 'on', true);
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode, drop_id)
  values ('vcheck-summary-a', v_a, 'Vcheck open', 'crafts-making', 'vcheck-summary', 1, true, 'friends', 'solo', v_open),
         ('vcheck-summary-b', v_b, 'Vcheck open', 'crafts-making', 'vcheck-summary', 1, true, 'friends', 'solo', v_open),
         ('vcheck-summary-c', v_a, 'Vcheck closed', 'crafts-making', 'vcheck-summary', 1, true, 'friends', 'solo', v_closed);
  perform set_config('soosh.join_drop', 'off', true);
  insert into public.stubs (user_id, kind, pursuit_id, drop_id, edition, corner_key)
  values (v_a, 'drop', 'vcheck-summary-a', v_open, 1, 'crafts-making/vcheck-summary');

  -- 1. An open drop, by slug: two people in, one Stub.
  v_i := v_i + 1;
  v_n := (select count(*) from public.drop_summary('vcheck-summary-open') ds where ds.people_in = 2 and ds.finished = 1 and ds.title = 'Vcheck open');
  results := array_append(results, case when v_n = 1 then format('%s PASS (open drop: 2 in, 1 Stub)', v_i)
                                        else format('%s FAIL (open drop rows matching %s)', v_i, v_n) end);

  -- 2. With no slug: the open drop is listed, the others are not.
  v_i := v_i + 1;
  v_n := (select count(*) from public.drop_summary() ds where ds.slug like 'vcheck-summary-%');
  results := array_append(results, case when v_n = 1 and exists (select 1 from public.drop_summary() ds where ds.slug = 'vcheck-summary-open')
                                        then format('%s PASS (only the open drop is listed)', v_i)
                                        else format('%s FAIL (listed fixture drops %s)', v_i, v_n) end);

  -- 3. A drop that has not opened is returned to nobody, even by slug.
  v_i := v_i + 1;
  v_n := (select count(*) from public.drop_summary('vcheck-summary-soon') ds);
  results := array_append(results, case when v_n = 0 then format('%s PASS (unopened drop is hidden)', v_i)
                                        else format('%s FAIL (unopened drop rows %s)', v_i, v_n) end);

  -- 4. A closed drop is still readable by slug, with its counts.
  v_i := v_i + 1;
  v_n := (select count(*) from public.drop_summary('vcheck-summary-closed') ds where ds.people_in = 1 and ds.finished = 0);
  results := array_append(results, case when v_n = 1 then format('%s PASS (closed drop by slug: 1 in, 0 Stubs)', v_i)
                                        else format('%s FAIL (closed drop rows matching %s)', v_i, v_n) end);

  -- 5. An unknown slug returns nothing.
  v_i := v_i + 1;
  v_n := (select count(*) from public.drop_summary('vcheck-summary-nope') ds);
  results := array_append(results, case when v_n = 0 then format('%s PASS (unknown slug: no rows)', v_i)
                                        else format('%s FAIL (unknown slug rows %s)', v_i, v_n) end);

  -- 6. Signed-out visitors and members may call it; nobody else was granted it by default.
  v_i := v_i + 1;
  results := array_append(results, case when has_function_privilege('anon', 'public.drop_summary(text)', 'execute')
                                         and has_function_privilege('authenticated', 'public.drop_summary(text)', 'execute')
                                        then format('%s PASS (anon and authenticated can execute)', v_i)
                                        else format('%s FAIL (execute grants missing)', v_i) end);

  -- 7. It is pinned to an empty search_path and runs as its owner.
  v_i := v_i + 1;
  v_n := (select count(*) from pg_catalog.pg_proc p
           where p.oid = to_regprocedure('public.drop_summary(text)')
             and p.prosecdef and p.proconfig @> array['search_path=""']);
  results := array_append(results, case when v_n = 1 then format('%s PASS (security definer, search_path pinned)', v_i)
                                        else format('%s FAIL (definer or search_path not as expected)', v_i) end);

  -- 8. It is on the deny-by-default list for a signed-out visitor and for a guest.
  v_i := v_i + 1;
  v_n := (select count(*) from private.access_allowlist al where al.name = 'drop_summary' and al.kind in ('rpc_anon', 'rpc_guest'));
  results := array_append(results, case when v_n = 2 then format('%s PASS (listed for anon and guest)', v_i)
                                        else format('%s FAIL (allowlist rows %s)', v_i, v_n) end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
