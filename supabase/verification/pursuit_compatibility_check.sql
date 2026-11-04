-- Run after 20261115000000_pursuit_compatibility.sql. Expected RESULTS exception rolls every fixture back.
begin;
do $$
declare
 results text[]:='{}'; owner_role text:=current_user;
 host uuid:='00000000-0000-4000-8000-00000000d101';
 friend uuid:='00000000-0000-4000-8000-00000000d102';
 outsider uuid:='00000000-0000-4000-8000-00000000d103';
 pending uuid:='00000000-0000-4000-8000-00000000d104';
 measure0 jsonb:='{"kind":"count","target":10,"unit":"paintings","allowPartial":false,"allowDecimals":false,"startingAmount":2,"defaultAmount":1}';
 summary0 jsonb; session0 bigint; cnt integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_anonymous)
 select u.id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u.email,'',now(),now(),now(),'{}','{}',false,false
 from (values(host,'pc.host@fixture.invalid'),(friend,'pc.friend@fixture.invalid'),(outsider,'pc.outsider@fixture.invalid'),(pending,'pc.pending@fixture.invalid')) u(id,email);
 insert into public.profile_private(user_id,birthdate) select u.id,(current_date-interval '30 years')::date from unnest(array[host,friend,outsider,pending]) u(id) on conflict(user_id) do update set birthdate=excluded.birthdate;
 update public.profiles p set access='active',onboarding_completed=true where p.id in(host,friend,outsider,pending);
 insert into public.pursuits(id,user_id,title,mode,measure,shared,started_at) values('compatibility-check-measure',host,'Paintings','together',measure0,true,now());
 insert into public.pursuits(id,user_id,title,mode,goal_shape,goal_target_number,goal_current,started_at) values('compatibility-check-goal',host,'Numeric goal','solo','number',10,4,now());
 insert into public.pursuits(id,user_id,title,mode,target_moments,started_at) values('compatibility-check-moments',host,'Ten Moments','solo',10,now());
 insert into public.pursuits(id,user_id,title,mode,started_at) values('compatibility-check-updates',host,'Keep going','solo',now());
 insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values('compatibility-check-measure',friend,'member','joined',host),('compatibility-check-measure',pending,'member','invited',host);
 insert into public.pursuit_progress(id,pursuit_id,user_id,amount,note,image_url,created_at) values('compatibility-original-entry','compatibility-check-measure',host,3,'Original','original.jpg','2026-09-01T12:00:00Z');
 insert into public.pursuit_sessions(pursuit_id,created_by,starts_at,place,note) values('compatibility-check-measure',host,now()+interval '1 day','Original place','Original plan');
 session0:=(select s.id from public.pursuit_sessions s where s.pursuit_id='compatibility-check-measure');
 results:=array_append(results,case when private.compatible_pursuit_definition((select p from public.pursuits p where p.id='compatibility-check-measure'))->>'unit'='paintings' then 'PASS old units retained' else 'FAIL original unit' end);
 results:=array_append(results,case when private.compatible_pursuit_definition((select p from public.pursuits p where p.id='compatibility-check-goal'))->>'startingAmount'='4' then 'PASS numeric baseline retained' else 'FAIL numeric baseline' end);
 results:=array_append(results,case when private.compatible_pursuit_definition((select p from public.pursuits p where p.id='compatibility-check-updates'))->>'tracking'='updates' then 'PASS unmeasured stays updates' else 'FAIL unmeasured goal' end);
 perform set_config('request.jwt.claim.sub',host::text,true);
 set local role authenticated;
 insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000e101','compatibility-check-measure',host,1,now());
 summary0:=(select r from jsonb_array_elements(public.get_compatible_profile_pursuits(host)) r where r->>'id'='compatibility-check-measure');
 results:=array_append(results,case when summary0->'workflow'->>'current'='6' and summary0->'workflow'->>'unit'='paintings' then 'PASS old and new amounts combined' else 'FAIL combined progress '||summary0::text end);
 summary0:=(select r from jsonb_array_elements(public.get_compatible_profile_pursuits(host)) r where r->>'id'='compatibility-check-goal');
 results:=array_append(results,case when summary0->'workflow'->>'current'='4' then 'PASS owner numeric summary' else 'FAIL owner numeric summary' end);
 perform public.edit_legacy_pursuit_progress('compatibility-check-measure','compatibility-original-entry',4,'Corrected',false);
 execute format('set local role %I',owner_role);
 cnt:=(select count(*) from public.pursuit_progress e where e.id='compatibility-original-entry' and e.user_id=host and e.amount=4 and e.note='Corrected' and e.image_url='original.jpg' and e.created_at='2026-09-01T12:00:00Z');
 results:=array_append(results,case when cnt=1 then 'PASS correction preserves identity date author media' else 'FAIL changed original metadata' end);
 set local role authenticated;
 begin
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000e102','compatibility-check-measure',host,1.5,now());
  results:=array_append(results,'FAIL fractional legacy amount');
 exception when check_violation then results:=array_append(results,'PASS whole-amount rule preserved'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 begin
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000e103','compatibility-check-moments',host,1,now());
  results:=array_append(results,'FAIL manual amount for Moments target');
 exception when check_violation then results:=array_append(results,'PASS Moments goals require actual Moments'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 perform public.edit_legacy_pursuit_session('compatibility-check-measure',jsonb_build_array(jsonb_build_object('legacy_id',session0,'starts_at',now()+interval '2 days','place','New place','note','Same session')));
 perform public.legacy_pursuit_rsvp('compatibility-check-measure',session0,true);
 perform public.legacy_pursuit_rsvp('compatibility-check-measure',session0,true);
 execute format('set local role %I',owner_role);
 cnt:=(select count(*) from public.pursuit_session_rsvps r where r.session_id=session0 and r.user_id=host);
 results:=array_append(results,case when cnt=1 and exists(select 1 from public.pursuit_sessions s where s.id=session0 and s.place='New place' and s.created_by=host) then 'PASS original session and idempotent attendance' else 'FAIL historical session' end);
 set local role authenticated;
 -- Root edits store metadata only on explicit save, retaining the original measure and progress.
 perform public.edit_pursuit_workflow('compatibility-check-measure','Paintings',measure0 || jsonb_build_object('workflow',jsonb_build_object('version',2,'tracking','total','target',12,'unit','paintings','items','[]'::jsonb,'legacy',jsonb_build_object('kind','measure','measure',measure0))),null,null);
 perform public.edit_pursuit_workflow('compatibility-check-goal','Numeric goal',jsonb_build_object('workflow',jsonb_build_object('version',2,'tracking','total','target',12,'unit','','items','[]'::jsonb,'legacy',jsonb_build_object('kind','goal'))),null,null);
 results:=array_append(results,'PASS explicit edits retain legacy sources including unitless goals');
 begin
  perform public.edit_pursuit_workflow('compatibility-check-measure','Paintings',measure0 || jsonb_build_object('workflow',jsonb_build_object('version',2,'tracking','sessions','target',12,'unit','sessions','items','[]'::jsonb,'legacy',jsonb_build_object('kind','measure','measure',measure0))),null,null);
  results:=array_append(results,'FAIL changed old amounts to sessions');
 exception when check_violation then results:=array_append(results,'PASS legacy tracking cannot be reinterpreted'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 perform set_config('request.jwt.claim.sub',friend::text,true);
 insert into public.pursuit_discussion(id,pursuit_id,user_id,body,thread) values('00000000-0000-4000-8000-00000000e104','compatibility-check-measure',friend,'Well done','legacy-entry:compatibility-original-entry');
 results:=array_append(results,'PASS joined friend comments on old progress');
 begin
  perform public.edit_legacy_pursuit_progress('compatibility-check-measure','compatibility-original-entry',99,'Changed',false);
  results:=array_append(results,'FAIL friend edited another entry');
 exception when insufficient_privilege then results:=array_append(results,'PASS friend cannot edit another entry'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 begin
  insert into public.pursuit_discussion(id,pursuit_id,user_id,body,thread) values('00000000-0000-4000-8000-00000000e105','compatibility-check-measure',friend,'Wrong thread','legacy-entry:missing-entry');
  results:=array_append(results,'FAIL invalid historical thread');
 exception when check_violation then results:=array_append(results,'PASS invalid historical thread refused'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 summary0:=public.get_compatible_profile_pursuits(host);
 results:=array_append(results,case when not exists(select 1 from jsonb_array_elements(summary0) r where r ? 'workflow') then 'PASS other profile visibility and redaction unchanged' else 'FAIL exposed owner summary' end);
 perform set_config('request.jwt.claim.sub',pending::text,true);
 begin
  perform public.legacy_pursuit_rsvp('compatibility-check-measure',session0,true);
  results:=array_append(results,'FAIL pending attendee wrote');
 exception when insufficient_privilege then results:=array_append(results,'PASS invited member cannot RSVP'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.edit_legacy_pursuit_progress('compatibility-check-measure','compatibility-original-entry',99,'Changed',false);
  results:=array_append(results,'FAIL outsider edited');
 exception when insufficient_privilege then results:=array_append(results,'PASS outsider cannot edit history'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
 perform set_config('request.jwt.claim.sub','',true);
 set local role anon;
 summary0:=public.get_compatible_profile_pursuits(host);
 results:=array_append(results,case when summary0=public.get_profile_pursuits(host) then 'PASS anonymous profile contract unchanged' else 'FAIL anonymous profile contract' end);
 raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
