-- Run after both 20261112000000_pursuit_workflow.sql and 20261112000100_pursuit_workflow_reminders.sql in an authorized test environment.
-- One transaction; RESULTS exception guarantees rollback. No SELECT/RETURNING INTO, no DELETE.
begin;
do $$
declare
  results text[] := '{}'; owner_role text := current_user;
  host uuid := '00000000-0000-4000-8000-00000000a101';
  friend uuid := '00000000-0000-4000-8000-00000000a102';
  outsider uuid := '00000000-0000-4000-8000-00000000a103';
  pending uuid := '00000000-0000-4000-8000-00000000a104';
  w jsonb := '{"version":2,"tracking":"sessions","target":10,"unit":"sessions","items":[]}';
  cnt integer;
begin
  if to_regclass('public.pursuit_contributions') is null or to_regprocedure('private.dispatch_pursuit_reminders()') is null then raise exception 'RESULTS: NOT APPLIED'; end if;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_anonymous)
  select u.id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u.email,'',now(),now(),now(),'{}','{}',false,false
  from (values(host,'pw.host@fixture.invalid'),(friend,'pw.friend@fixture.invalid'),(outsider,'pw.outsider@fixture.invalid'),(pending,'pw.pending@fixture.invalid')) u(id,email);
  insert into public.profile_private(user_id,birthdate)
    select u.id,(current_date-interval '30 years')::date from unnest(array[host,friend,outsider]) u(id)
    on conflict(user_id) do update set birthdate=excluded.birthdate;
  update public.profiles p set access='active',onboarding_completed=true where p.id in(host,friend,outsider);
  perform set_config('request.jwt.claim.sub',host::text,true);
  set local role authenticated;
  perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-individual','title','Fixture','mode','together','measure',jsonb_build_object('workflow',w)),array[friend]);
  perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-individual','title','Fixture','mode','together','measure',jsonb_build_object('workflow',w)),array[friend]);
  results:=array_append(results,'PASS atomic idempotent creation');
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000b101','workflow-check-individual',host,1,now());
  results:=array_append(results,'PASS host records progress');
  perform set_config('request.jwt.claim.sub',friend::text,true);
  cnt:=(select count(*) from public.pursuit_contributions e where e.pursuit_id='workflow-check-individual');
  results:=array_append(results,case when cnt=0 then 'PASS pending invite cannot read progress' else 'FAIL pending invite read progress' end);
  begin
    insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000b102','workflow-check-individual',friend,1,now());
    results:=array_append(results,'FAIL pending invite wrote progress');
  exception when insufficient_privilege then results:=array_append(results,'PASS pending invite cannot write'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  execute format('set local role %I',owner_role);
  update public.pursuit_members m set status='joined' where m.pursuit_id='workflow-check-individual' and m.user_id=friend;
  set local role authenticated;
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000b102','workflow-check-individual',friend,1,now());
  insert into public.pursuit_personal_goals(pursuit_id,user_id,target,status) values('workflow-check-individual',friend,6,'finished');
  results:=array_append(results,'PASS joined member records progress and finishes independently');
  begin
    update public.pursuit_contributions set user_id=friend where pursuit_contributions.id='00000000-0000-4000-8000-00000000b101';
    cnt:=(select count(*) from public.pursuit_contributions e where e.id='00000000-0000-4000-8000-00000000b101' and e.user_id=host);
    results:=array_append(results,case when cnt=1 then 'PASS cannot edit another contribution' else 'FAIL changed another contribution' end);
  exception when insufficient_privilege then results:=array_append(results,'PASS cannot edit another contribution'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  perform set_config('request.jwt.claim.sub',host::text,true);
  begin
    insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000b103','workflow-check-individual',host,1.5,now());
    results:=array_append(results,'FAIL fractional session');
  exception when check_violation then results:=array_append(results,'PASS sessions use whole actions'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  begin
    perform public.edit_pursuit_workflow('workflow-check-individual','Fixture',jsonb_build_object('workflow',w||'{"tracking":"total","unit":"hours"}'::jsonb),null,null);
    results:=array_append(results,'FAIL changed tracking after progress');
  exception when check_violation then results:=array_append(results,'PASS tracking locks after progress'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  perform public.edit_pursuit_workflow('workflow-check-individual','Fixture',jsonb_build_object('workflow',w||'{"target":8}'::jsonb),null,null);
  results:=array_append(results,'PASS target changes preserve entries');
  insert into public.pursuit_discussion(id,pursuit_id,user_id,body,thread,mentions) values('00000000-0000-4000-8000-00000000c101','workflow-check-individual',host,'Thanks @friend','chat',array[friend]);
  perform set_config('request.jwt.claim.sub',friend::text,true);
  cnt:=(select count(*) from public.pursuit_notices n where n.pursuit_id='workflow-check-individual' and n.user_id=friend and n.event_id='message:00000000-0000-4000-8000-00000000c101');
  results:=array_append(results,case when cnt=1 then 'PASS mention notice delivered once' else 'FAIL missing mention notice' end);
  perform set_config('request.jwt.claim.sub',host::text,true);
  cnt:=(select count(*) from public.pursuit_notices n where n.pursuit_id='workflow-check-individual' and n.user_id=friend);
  results:=array_append(results,case when cnt=0 then 'PASS notices private to recipient' else 'FAIL another recipient notice exposed' end);
  begin
    insert into public.pursuit_discussion(id,pursuit_id,user_id,body,thread,parent_id) values('00000000-0000-4000-8000-00000000c102','workflow-check-individual',host,'Invalid reply','entry:00000000-0000-4000-8000-00000000b101','00000000-0000-4000-8000-00000000c101');
    results:=array_append(results,'FAIL cross-thread reply');
  exception when check_violation then results:=array_append(results,'PASS cross-thread reply refused'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-shared','title','Shared fixture','mode','group','measure',jsonb_build_object('workflow',w)),array[friend]);
  execute format('set local role %I',owner_role);
  update public.pursuit_members m set status='joined' where m.pursuit_id='workflow-check-shared' and m.user_id=friend;
  set local role authenticated;
  insert into public.pursuit_meetings(id,pursuit_id,user_id,title,starts_at,series_id,timezone) values('00000000-0000-4000-8000-00000000d101','workflow-check-shared',host,'Sunday',now()+interval '2 days','00000000-0000-4000-8000-00000000d100','America/New_York');
  insert into public.pursuit_attendance(pursuit_id,session_id,user_id,going) values('workflow-check-shared','00000000-0000-4000-8000-00000000d101',host,true);
  cnt:=(select count(*) from public.pursuit_contributions e where e.pursuit_id='workflow-check-shared');
  results:=array_append(results,case when cnt=0 then 'PASS attendance is not progress' else 'FAIL attendance counted' end);
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at,session_id) values('00000000-0000-4000-8000-00000000b104','workflow-check-shared',host,1,now(),'00000000-0000-4000-8000-00000000d101');
  perform set_config('request.jwt.claim.sub',friend::text,true);
  begin
    insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at,session_id) values('00000000-0000-4000-8000-00000000b105','workflow-check-shared',friend,1,now(),'00000000-0000-4000-8000-00000000d101');
    results:=array_append(results,'FAIL shared session counted twice');
  exception when unique_violation then results:=array_append(results,'PASS shared session counts once'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  perform set_config('request.jwt.claim.sub',host::text,true);
  insert into public.pursuit_personal_goals(pursuit_id,user_id,reminder_minutes) values('workflow-check-shared',host,30);
  update public.pursuit_meetings set starts_at=now()+interval '20 minutes' where pursuit_meetings.id='00000000-0000-4000-8000-00000000d101';
  execute format('set local role %I',owner_role);
  perform private.dispatch_pursuit_reminders();
  perform private.dispatch_pursuit_reminders();
  cnt:=(select count(*) from public.pursuit_notices n where n.pursuit_id='workflow-check-shared' and n.user_id=host and n.event_id like 'reminder:%');
  results:=array_append(results,case when cnt=1 then 'PASS scheduled reminder is deduplicated' else 'FAIL reminder count' end);
  cnt:=(select count(*) from public.pursuit_notices n where n.pursuit_id='workflow-check-shared' and n.user_id=friend and n.event_id like 'reminder:%');
  results:=array_append(results,case when cnt=0 then 'PASS no unsolicited friend reminder' else 'FAIL friend reminder' end);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',host::text,true);
  perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-list','title','Checklist fixture','mode','solo','measure',jsonb_build_object('workflow','{"version":2,"tracking":"checklist","unit":"","items":[{"id":"00000000-0000-4000-8000-00000000e101","title":"First item"}]}'::jsonb)));
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at,item_id) values('00000000-0000-4000-8000-00000000b106','workflow-check-list',host,1,now(),'00000000-0000-4000-8000-00000000e101');
  results:=array_append(results,'PASS checklist item completion');
  begin
    insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at,item_id) values('00000000-0000-4000-8000-00000000b107','workflow-check-list',host,1,now(),'00000000-0000-4000-8000-00000000e102');
    results:=array_append(results,'FAIL nonexistent checklist item');
  exception when check_violation then results:=array_append(results,'PASS missing checklist item refused'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-total','title','Total fixture','mode','solo','measure',jsonb_build_object('workflow','{"version":2,"tracking":"total","unit":"pages","target":500,"items":[]}'::jsonb)));
  insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at) values('00000000-0000-4000-8000-00000000b108','workflow-check-total',host,120,now());
  results:=array_append(results,'PASS total contribution');
  perform public.invite_pursuit_workflow('workflow-check-total',friend);
  perform public.invite_pursuit_workflow('workflow-check-total',friend);
  cnt:=(select count(*) from public.pursuit_members m where m.pursuit_id='workflow-check-total' and m.user_id=friend and m.status='invited');
  results:=array_append(results,case when cnt=1 then 'PASS invite friends after solo progress, once' else 'FAIL invite retry' end);
  perform public.leave_pursuit_workflow('workflow-check-total',friend);
  cnt:=(select count(*) from public.pursuit_members m where m.pursuit_id='workflow-check-total' and m.user_id=friend and m.status='declined');
  results:=array_append(results,case when cnt=1 then 'PASS host removes participant' else 'FAIL participant removal' end);

  execute format('set local role %I',owner_role);
  update public.profiles set paused_at=now() where profiles.id=host;
  set local role authenticated;
  begin
    perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-paused','title','No','mode','solo','measure',jsonb_build_object('workflow',w)));
    results:=array_append(results,'FAIL paused account wrote');
  exception when insufficient_privilege then results:=array_append(results,'PASS paused account cannot write'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  execute format('set local role %I',owner_role);
  update public.profiles set paused_at=null where profiles.id=host;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  cnt:=(select count(*) from public.pursuit_discussion m where m.pursuit_id='workflow-check-individual');
  results:=array_append(results,case when cnt=0 then 'PASS outsider cannot read Chat' else 'FAIL outsider read Chat' end);
  perform set_config('request.jwt.claim.sub',pending::text,true);
  begin
    perform public.create_pursuit_workflow(jsonb_build_object('id','workflow-check-pending','title','No','mode','solo','measure',jsonb_build_object('workflow',w)));
    results:=array_append(results,'FAIL nonmember created Pursuit');
  exception when insufficient_privilege then results:=array_append(results,'PASS nonmember RPC denied'); when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm); end;
  execute format('set local role %I',owner_role);
  insert into public.blocks(blocker_id,blocked_id) values(host,friend);
  perform set_config('request.jwt.claim.sub',friend::text,true);
  set local role authenticated;
  cnt:=(select count(*) from public.pursuit_contributions e where e.pursuit_id='workflow-check-individual');
  results:=array_append(results,case when cnt=0 then 'PASS blocked participant cannot read progress' else 'FAIL blocked participant read progress' end);
  execute format('set local role %I',owner_role);
  raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
