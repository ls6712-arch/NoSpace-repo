-- Soosh: row level security policies ask who is signed in once per query, not once per row.
--
-- Rollback: rollback_20261130000000_rls_auth_once_per_query.sql.
-- Verification: supabase/verification/rls_auth_once_per_query_check.sql.
--
-- A policy that calls auth.uid() directly runs it again for every row the query looks at. Wrapped as
-- (select auth.uid()), Postgres runs it once and reuses the answer
-- (https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).
-- Supabase's advisor (auth_rls_initplan) listed 114 such policies on Nov 11, 2026 (launch audit); a
-- read of pg_policy the same day found 123 with a bare call, 115 in public and 8 on storage.objects.
--
-- This changes no rule: every policy keeps its name, command, roles and logic. Only the text
-- auth.uid() (and auth.role(), auth.jwt(), auth.email()) becomes ( SELECT auth.uid()) wherever it is
-- not already wrapped. The value is the same for every row of one query, so who can read or write
-- what is unchanged.
--
-- Done by reading each policy as the database prints it and altering it in place, rather than by
-- 123 copied statements: a policy edited between this file being written and it running is
-- rewritten from what it says then, never put back to an older text. Running it twice changes
-- nothing the second time.
--
-- storage.objects belongs to Supabase's storage role. If the role running this migration may not
-- alter its policies, those are skipped with a notice (the check then reports them) and the public
-- ones still go through.

do $$
declare
  r record;
  v_q text;
  v_w text;
  v_changed integer := 0;
  v_skipped integer := 0;
begin
  for r in
    select n.nspname, c.relname, pol.polname,
           pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) as q,
           pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) as w
      from pg_catalog.pg_policy pol
      join pg_catalog.pg_class c on c.oid = pol.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'storage')
     order by n.nspname, c.relname, pol.polname
  loop
    v_q := regexp_replace(r.q, '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)', '( SELECT auth.\1())', 'g');
    v_w := regexp_replace(r.w, '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)', '( SELECT auth.\1())', 'g');
    continue when v_q is not distinct from r.q and v_w is not distinct from r.w;
    begin
      execute format('alter policy %I on %I.%I', r.polname, r.nspname, r.relname)
        || case when v_q is not null then ' using (' || v_q || ')' else '' end
        || case when v_w is not null then ' with check (' || v_w || ')' else '' end;
      v_changed := v_changed + 1;
    exception when insufficient_privilege then
      if r.nspname <> 'storage' then
        raise;
      end if;
      v_skipped := v_skipped + 1;
      raise notice 'rls_auth_once_per_query: skipped storage policy "%" (not the owner)', r.polname;
    end;
  end loop;
  raise notice 'rls_auth_once_per_query: % policies rewritten, % storage policies skipped', v_changed, v_skipped;
end
$$;
