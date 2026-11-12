-- APPROVED TEST PROJECT ONLY. All fixture changes roll back unconditionally.
begin;
do $$
declare results text[] := '{}'; owner_id uuid := (select u.id from auth.users as u where not coalesce(u.is_anonymous,false) order by u.id limit 1);
  other_id uuid := (select u.id from auth.users as u where not coalesce(u.is_anonymous,false) order by u.id offset 1 limit 1);
  rev bigint; saved jsonb;
begin
  if owner_id is null or other_id is null then results := array_append(results,'BLOCKED: two test accounts required');
  else
    rev := coalesce((select c.revision from public.stubby_capabilities as c where c.user_id=owner_id),0);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',false)::text,true);
    set local role authenticated;
    saved := public.save_personalization(owner_id,rev,'{"motivations":["make"]}'::jsonb);
    results := array_append(results,case when saved->'value'->'motivations'='["make"]'::jsonb then 'PASS: owner save' else 'FAIL: owner save' end);
    begin
      perform public.save_personalization(owner_id,rev,'{}');
      results := array_append(results,'FAIL: stale revision accepted');
    exception when serialization_failure then results := array_append(results,'PASS: stale revision denied');
      when others then results := array_append(results,'ERROR: stale revision SQLSTATE '||sqlstate); end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','is_anonymous',false)::text,true);
    results := array_append(results,case when not exists(select 1 from public.stubby_capabilities as c where c.user_id=owner_id) then 'PASS: owner isolation' else 'FAIL: owner isolation' end);
    begin
      perform public.save_personalization(owner_id,rev+1,'{}');
      results := array_append(results,'FAIL: wrong account accepted');
    exception when insufficient_privilege then results := array_append(results,'PASS: wrong account denied');
      when others then results := array_append(results,'ERROR: wrong account SQLSTATE '||sqlstate); end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',true)::text,true);
    begin
      perform public.save_personalization(owner_id,rev+1,'{}');
      results := array_append(results,'FAIL: guest accepted');
    exception when insufficient_privilege then results := array_append(results,'PASS: guest denied');
      when others then results := array_append(results,'ERROR: guest SQLSTATE '||sqlstate); end;
    reset role;
  end if;
  raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
