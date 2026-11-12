-- Rollback for 20261130000000_rls_auth_once_per_query.sql.
--
-- That migration changes no rule, only how often auth.uid() runs, so there is nothing to undo for
-- correctness. This puts the per-row form back, for the unlikely case that a wrapped call is ever
-- suspected of a wrong plan. Warning: it unwraps every policy in public and storage, including the
-- ones that were already wrapped before the migration (the database does not record which were).
do $$
declare
  r record;
  v_q text;
  v_w text;
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
    v_q := regexp_replace(r.q, '\( SELECT auth\.(uid|role|jwt|email)\(\) AS \1\)', 'auth.\1()', 'g');
    v_w := regexp_replace(r.w, '\( SELECT auth\.(uid|role|jwt|email)\(\) AS \1\)', 'auth.\1()', 'g');
    continue when v_q is not distinct from r.q and v_w is not distinct from r.w;
    execute format('alter policy %I on %I.%I', r.polname, r.nspname, r.relname)
      || case when v_q is not null then ' using (' || v_q || ')' else '' end
      || case when v_w is not null then ' with check (' || v_w || ')' else '' end;
  end loop;
end
$$;
