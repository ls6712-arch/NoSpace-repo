-- Run after 20261116000000_calendar_pursuit_sessions.sql. RESULTS intentionally rolls everything back.
begin;
do $$
declare
 results text[]:='{}'; owner_role text:=current_user;
 host uuid:='00000000-0000-4000-8000-00000000f101'; friend uuid:='00000000-0000-4000-8000-00000000f102'; outsider uuid:='00000000-0000-4000-8000-00000000f103'; pending uuid:='00000000-0000-4000-8000-00000000f104'; stubby uuid:='00000000-0000-4000-8000-00000000f105';
 meeting uuid:='00000000-0000-4000-8000-00000000f201'; legacy bigint; cnt integer; starts0 timestamptz:=now()+interval '1 day';
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_anonymous)
 select u.id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u.email,'',now(),now(),now(),'{}','{}',false,false from (values(host,'cs.host@fixture.invalid'),(friend,'cs.friend@fixture.invalid'),(outsider,'cs.outsider@fixture.invalid'),(pending,'cs.pending@fixture.invalid'),(stubby,'cs.stubby@fixture.invalid')) u(id,email);
 insert into public.profile_private(user_id,birthdate) select u.id,(current_date-interval '30 years')::date from unnest(array[host,friend,outsider,pending]) u(id) on conflict(user_id) do update set birthdate=excluded.birthdate;
 update public.profiles p set access='active',onboarding_completed=true where p.id in(host,friend,outsider,pending);
 insert into public.pursuits(id,user_id,title,mode,shared,started_at,measure) values('calendar-check-main',host,'Fixture','together',false,now(),'{"kind":"quantity","unit":"pages","target":1000}');
 insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values('calendar-check-main',friend,'member','joined',host),('calendar-check-main',pending,'member','invited',host);
 insert into public.pursuit_sessions(pursuit_id,created_by,starts_at,place) values('calendar-check-main',host,starts0,'Original place');
 legacy:=(select s.id from public.pursuit_sessions s where s.pursuit_id='calendar-check-main');
 perform set_config('request.jwt.claim.sub',host::text,true);set local role authenticated;
 perform public.save_pursuit_meetings(jsonb_build_array(jsonb_build_object('id',meeting,'pursuit_id','calendar-check-main','user_id',host,'title','New session','starts_at',starts0+interval '1 hour','place','New place','note','Keep this','series_id',meeting,'timezone','America/New_York','cancelled',false)));
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',host) s where s.pursuit_id='calendar-check-main');
 results:=array_append(results,case when cnt=2 then 'PASS both session sources once' else 'FAIL missing or duplicate sessions' end);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',host) s where s.pursuit_id='calendar-check-main' and s.total=2 and not s.is_plan);
 results:=array_append(results,case when cnt=2 then 'PASS goal amount is not a session count' else 'FAIL invented sessions from goal' end);
 perform public.change_calendar_workflow_session(meeting,starts0+interval '2 hours',false);
 cnt:=(select count(*) from public.pursuit_meetings s where s.id=meeting and s.starts_at=starts0+interval '2 hours' and s.note='Keep this' and s.series_id=meeting and s.timezone='America/New_York');
 results:=array_append(results,case when cnt=1 then 'PASS time change preserves identity metadata and recurrence' else 'FAIL metadata changed' end);
 perform public.set_calendar_session_attendance(legacy,false);perform public.set_calendar_session_attendance(legacy,false);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',host) s where s.id='session-'||legacy);
 results:=array_append(results,case when cnt=0 then 'PASS owner can decline without deleting group session' else 'FAIL owner decline not persistent' end);
 perform set_config('request.jwt.claim.sub',friend::text,true);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',friend) s where s.id='session-'||legacy);
 results:=array_append(results,case when cnt=1 then 'PASS another participant keeps the session' else 'FAIL changed another calendar' end);
 cnt:=(select count(*) from public.pursuit_session_declines d where d.session_id=legacy and d.user_id=host);
 results:=array_append(results,case when cnt=1 then 'PASS joined participants see session responses' else 'FAIL missing participant response' end);
 perform public.legacy_pursuit_rsvp('calendar-check-main',legacy,false);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',friend) s where s.id='session-'||legacy);
 results:=array_append(results,case when cnt=0 then 'PASS legacy Pursuit RSVP updates Calendar' else 'FAIL legacy RSVP not synchronized' end);
 perform public.legacy_pursuit_rsvp('calendar-check-main',legacy,true);perform public.legacy_pursuit_rsvp('calendar-check-main',legacy,true);
 cnt:=(select count(*) from public.pursuit_session_rsvps r where r.session_id=legacy and r.user_id=friend);
 results:=array_append(results,case when cnt=1 then 'PASS rejoin is idempotent' else 'FAIL duplicate RSVP' end);
 begin
  perform public.set_calendar_workflow_attendance(meeting,false,host);
  results:=array_append(results,'FAIL replayed another users attendance intent');
 exception when insufficient_privilege then results:=array_append(results,'PASS queued attendance stays bound to its original user');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 perform public.set_calendar_workflow_attendance(meeting,false);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',friend) s where s.id='meeting-'||meeting);
 results:=array_append(results,case when cnt=0 then 'PASS workflow attendance filters only the viewer' else 'FAIL workflow decline' end);
 begin
  perform public.change_calendar_workflow_session(meeting,starts0+interval '3 hours',false);
  results:=array_append(results,'FAIL participant moved another persons session');
 exception when insufficient_privilege then results:=array_append(results,'PASS participant cannot reschedule another persons session');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 begin
  perform public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',host);
  results:=array_append(results,'FAIL read another users calendar');
 exception when insufficient_privilege then results:=array_append(results,'PASS authenticated caller bound to own calendar');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 perform set_config('request.jwt.claim.sub',pending::text,true);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',pending) s where s.pursuit_id='calendar-check-main');
 results:=array_append(results,case when cnt=0 then 'PASS pending invitation has no session access' else 'FAIL pending read' end);
 begin
  perform public.set_calendar_session_attendance(legacy,false);
  results:=array_append(results,'FAIL pending attendee wrote');
 exception when insufficient_privilege then results:=array_append(results,'PASS pending attendance refused');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',outsider) s where s.pursuit_id='calendar-check-main');
 results:=array_append(results,case when cnt=0 then 'PASS outsider has no calendar session access' else 'FAIL outsider read' end);
 cnt:=(select count(*) from public.pursuit_session_declines d where d.session_id=legacy);
 results:=array_append(results,case when cnt=0 then 'PASS outsiders cannot read session responses' else 'FAIL outsider response read' end);
 perform set_config('request.jwt.claim.sub',host::text,true);
 perform public.save_pursuit_meetings(jsonb_build_array(jsonb_build_object('id','00000000-0000-4000-8000-00000000f202','pursuit_id','calendar-check-main','user_id',host,'title','Recorded session','starts_at',starts0,'series_id','00000000-0000-4000-8000-00000000f202','timezone','UTC','cancelled',false)));
 insert into public.pursuit_contributions(id,pursuit_id,user_id,amount,occurred_at,session_id) values('00000000-0000-4000-8000-00000000f203','calendar-check-main',host,1,starts0,'00000000-0000-4000-8000-00000000f202');
 begin
  perform public.change_calendar_workflow_session('00000000-0000-4000-8000-00000000f202',starts0+interval '1 day',false);
  results:=array_append(results,'FAIL changed recorded session date');
 exception when check_violation then results:=array_append(results,'PASS recorded progress keeps its original session date');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 begin
  perform public.change_calendar_workflow_session('00000000-0000-4000-8000-00000000f202',null,true);
  results:=array_append(results,'FAIL cancelled recorded session');
 exception when check_violation then results:=array_append(results,'PASS recorded progress cannot be cancelled from Calendar');when others then results:=array_append(results,'ERROR '||sqlstate||' '||sqlerrm);end;
 perform public.change_calendar_workflow_session(meeting,null,true);
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',host) s where s.id='meeting-'||meeting);
 results:=array_append(results,case when cnt=0 and exists(select 1 from public.pursuit_meetings s where s.id=meeting and s.cancelled) then 'PASS cancellation hides session while retaining its record' else 'FAIL cancellation' end);
 execute format('set local role %I',owner_role);
 insert into public.pursuits(id,user_id,title,mode,shared,is_plan,started_at) values('calendar-check-stubby',stubby,'Private plan','solo',false,true,now());
 insert into public.pursuit_sessions(pursuit_id,created_by,starts_at) values('calendar-check-stubby',stubby,starts0);
 perform set_config('request.jwt.claim.sub',stubby::text,true);set local role authenticated;
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',stubby) s where s.pursuit_id='calendar-check-stubby');
 results:=array_append(results,case when cnt=1 then 'PASS unenrolled account retains own private plan' else 'FAIL private plan regression' end);
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);set local role service_role;
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',friend) s where s.id='session-'||legacy);
 results:=array_append(results,case when cnt=1 then 'PASS subscription uses the same membership and attendance contract' else 'FAIL subscription mismatch' end);
 execute format('set local role %I',owner_role);
 insert into public.blocks(blocker_id,blocked_id) values(host,friend);
 set local role service_role;
 cnt:=(select count(*) from public.get_calendar_pursuit_sessions(now(),now()+interval '7 days',friend) s where s.pursuit_id='calendar-check-main');
 results:=array_append(results,case when cnt=0 then 'PASS service subscription respects blocking' else 'FAIL feed bypassed blocking' end);
 raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
