-- Read-only shape and privilege checks. Always rolls back.
begin;
do $$
declare results text[]:='{}';
begin
 results:=array_append(results,case when not has_function_privilege('anon','public.record_stubby_feedback(bigint,text,text,text)','execute') and has_function_privilege('authenticated','public.record_stubby_feedback(bigint,text,text,text)','execute') then 'PASS: caller access' else 'FAIL: RPC grants' end);
 results:=array_append(results,case when not has_column_privilege('authenticated','public.stubby_feedback','reason','insert') and not has_column_privilege('authenticated','public.stubby_feedback','scope','update') then 'PASS: details only via checked RPC' else 'FAIL: column grants' end);
 results:=array_append(results,case when exists(select 1 from pg_constraint as c where c.conrelid='public.stubby_feedback'::regclass and c.conname='feedback_scope_valid') then 'PASS: temporary defaults and valid scopes' else 'FAIL: constraints' end);
 raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
