-- 20261111000200_gate_service_role.sql: the server role gets through the RPC gate.
--
-- Not a migration, nothing here changes the schema or the data for good. Run AFTER the migration;
-- run before it, checks 1 to 3 FAIL (that is the bug: on Nov 3 the gate refused the real
-- service_role with 42501).
--
-- One transaction, one do $$ ... $$ block, ending unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' so a rollback is guaranteed. Each case is its own
-- begin...exception...end sub-block with strict sqlstate handling. No select-into, no
-- returning-into, no delete, no fixtures: it reads only the catalog and runs the gate (CLAUDE.md).
--
-- Unlike the earlier scripts, the gate runs as the real roles (set role), not only with the JWT
-- claim set, so a missing schema grant shows up here.

begin;

do $$
declare
  v_i int := 0;
  results text[] := '{}';
  v_owner text := current_user;
  c record;
begin
  if to_regprocedure('private.request_gate()') is null then
    raise exception 'RESULTS: NOT APPLIED (the RPC gate, 20261111000010, is not in this database)';
  end if;

  -- 1. The grant itself.
  v_i := v_i + 1;
  results := results || (v_i || case when has_schema_privilege('service_role', 'private', 'usage')
                                     then ' PASS service_role can use the private schema'
                                     else ' FAIL service_role has no USAGE on private' end);

  -- 2 to 6. The gate as each real role: who, path, allowed?
  for c in
    select * from (values
      ('service_role', '/rpc/claim_stubby_ask', true, 'the server role passes an RPC'),
      ('service_role', '/stubby_asks', true, 'the server role passes a table path'),
      ('anon', '/rpc/get_profile', true, 'signed out still reads a public Shelf'),
      ('anon', '/rpc/create_space', false, 'signed out still can''t call a member RPC'),
      ('authenticated', '/rpc/some_future_function', false, 'a signed-in non-member is still refused an unlisted RPC')
    ) as t(role, path, allowed, label)
  loop
    v_i := v_i + 1;
    perform set_config('request.jwt.claims', format('{"role":"%s","sub":"00000000-0000-4000-8000-000000009901"}', c.role), true);
    perform set_config('request.path', c.path, true);
    perform set_config('role', c.role, true);
    begin
      perform private.request_gate();
      results := results || (v_i || case when c.allowed then ' PASS ' else ' FAIL ' end || c.label);
    exception
      when insufficient_privilege then results := results || (v_i || case when c.allowed then ' FAIL (' || sqlerrm || ') ' else ' PASS ' end || c.label);
      when others then results := results || (v_i || ' ERROR ' || sqlstate || ': ' || sqlerrm);
    end;
    perform set_config('role', v_owner, true);
  end loop;
  perform set_config('request.path', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  -- 7. USAGE only: no private table was handed to the server role by this.
  v_i := v_i + 1;
  results := results || (v_i || case when not has_table_privilege('service_role', 'private.access_allowlist', 'insert, update, delete')
                                     then ' PASS no write on a private table came with it'
                                     else ' FAIL service_role can write private.access_allowlist' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
