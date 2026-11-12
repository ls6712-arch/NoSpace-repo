-- Run only in the approved isolated test project; writes roll back unconditionally.
begin;
do $$
declare results text[]:='{}'; person uuid; revision bigint; saved jsonb;
begin
 person:=(select u.id from auth.users as u where coalesce(u.is_anonymous,false)=false order by u.id limit 1);
 if person is null then raise exception 'RESULTS: BLOCKED: test account required'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',person,'role','authenticated','is_anonymous',false)::text,true);
 revision:=coalesce((select c.revision from public.stubby_capabilities as c where c.user_id=person),0);
 saved:=public.save_personalization(person,revision,'{"motivations":[]}');
 results:=array_append(results,case when saved->'value'->'answerStates'->>'motivations'='removed' then 'PASS: explicit removal recorded' else 'FAIL: removal state' end);
 saved:=public.save_personalization(person,(saved->>'revision')::bigint,'{"motivations":["learn"]}');
 results:=array_append(results,case when saved->'value'->'answerStates'->>'motivations'='answered' then 'PASS: explicit answer recorded' else 'FAIL: answer state' end);
 raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
