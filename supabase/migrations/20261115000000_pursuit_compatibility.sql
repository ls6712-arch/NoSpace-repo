-- Compatibility presentation and operations. No bulk UPDATE, INSERT or conversion of existing data.
-- Requires the two PR #325 workflow migrations. Existing progress/goal/session tables remain authoritative.
create or replace function private.compatible_pursuit_definition(p public.pursuits)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=to_jsonb(p); kind0 text; tracking0 text; unit0 text; target0 numeric; start0 numeric;
begin
  if p.measure->'workflow' is not null then return p.measure->'workflow'; end if;
  kind0:=case when p.measure is not null then 'measure' when r->>'goal_shape'='number' then 'goal' when r->>'target_moments' is not null then 'moments' else 'updates' end;
  tracking0:=case when kind0='updates' then 'updates' else 'total' end;
  unit0:=coalesce(p.measure->>'unit',r->>'goal_unit',case when kind0='moments' then 'Moments' else '' end);
  target0:=case when kind0='measure' then nullif((p.measure->>'target')::numeric,0) when kind0='goal' then (r->>'goal_target_number')::numeric when kind0='moments' then (r->>'target_moments')::numeric end;
  start0:=case when kind0='measure' then coalesce((p.measure->>'startingAmount')::numeric,0) when kind0='goal' then coalesce((r->>'goal_current')::numeric,0) else 0 end;
  return jsonb_build_object('version',2,'tracking',tracking0,'unit',unit0,'target',target0,'startingAmount',start0,'items','[]'::jsonb,'legacy',jsonb_build_object('kind',kind0,'measure',p.measure));
end $$;
revoke all on function private.compatible_pursuit_definition(public.pursuits) from public,anon,authenticated;

create or replace function private.validate_pursuit_workflow_row()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.pursuits; w jsonb; k text; parent public.pursuit_discussion; existing_row boolean;
begin
  select p0.* into p from public.pursuits p0 where p0.id=new.pursuit_id for update;
  w:=private.compatible_pursuit_definition(p); k:=w->>'tracking';
  if w->>'version' <> '2' or k is null then raise exception 'Workflow not available' using errcode='23514'; end if;
  if TG_OP='INSERT' and TG_TABLE_NAME in ('pursuit_discussion','pursuit_contributions','pursuit_meetings') then
    execute format('select exists(select 1 from public.%I r where r.id=$1)',TG_TABLE_NAME) into existing_row using new.id;
    if not existing_row then perform public.enforce_rate_limit('workflow_'||TG_TABLE_NAME,120,interval '1 hour'); end if;
  end if;
  if TG_OP='UPDATE' and (new.pursuit_id<>old.pursuit_id or new.user_id<>old.user_id) then raise exception 'Identity cannot change' using errcode='23514'; end if;
  if TG_TABLE_NAME='pursuit_contributions' and TG_OP='UPDATE' then
    if new.post_id is null and old.post_id is not null and (to_jsonb(new)-'post_id')=(to_jsonb(old)-'post_id') then return new; end if;
  end if;
  if TG_TABLE_NAME='pursuit_contributions' then
    if w->'legacy'->>'kind'='moments' then raise exception 'Log a Moment for this goal' using errcode='23514'; end if;
    if w->'legacy'->>'kind'='measure' and not coalesce((w->'legacy'->'measure'->>'allowDecimals')::boolean,false) and new.amount<>trunc(new.amount) then raise exception 'Use a whole amount' using errcode='23514'; end if;
    if TG_OP='UPDATE' and (new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Identity cannot change' using errcode='23514'; end if;
    if not isfinite(new.occurred_at) or not isfinite(new.created_at) then raise exception 'Invalid date' using errcode='23514'; end if;
    if k='updates' or (k='sessions' and new.amount<>1) then raise exception 'Invalid progress amount' using errcode='23514'; end if;
    if ((p.finished_at is not null or p.paused_at is not null or to_jsonb(p)->>'let_go_at' is not null) and not(w->'legacy' is not null and p.mode<>'group' and exists(select 1 from public.pursuit_personal_goals active_goal where active_goal.pursuit_id=p.id and active_goal.user_id=auth.uid() and active_goal.status='active'))) or exists(select 1 from public.pursuit_personal_goals g where g.pursuit_id=p.id and g.user_id=auth.uid() and g.status<>'active') then raise exception 'Resume before recording progress' using errcode='23514'; end if;
    if k='checklist' then
      if new.amount<>1 or not exists(select 1 from jsonb_array_elements(w->'items') i where i->>'id'=new.item_id::text and not coalesce((i->>'archived')::boolean,false)) then raise exception 'Invalid checklist item' using errcode='23514'; end if;
    elsif new.item_id is not null then raise exception 'Unexpected checklist item' using errcode='23514'; end if;
    if new.post_id is not null and not exists(select 1 from public.posts m where m.id=new.post_id and m.user_id=new.user_id and m.pursuit_id=p.id) then raise exception 'Invalid Moment' using errcode='23514'; end if;
    if exists(select 1 from public.pursuit_contributions e where e.id<>new.id and e.post_id=new.post_id and new.post_id is not null) then raise exception 'Moment already counted' using errcode='23505'; end if;
    if new.session_id is not null and not exists(select 1 from public.pursuit_meetings s where s.id=new.session_id and s.pursuit_id=p.id and not s.cancelled) then raise exception 'Session does not belong here' using errcode='23514'; end if;
    if exists(select 1 from public.pursuit_contributions e where e.pursuit_id=p.id and e.id<>new.id and (p.mode='group' or e.user_id=new.user_id) and ((new.item_id is not null and e.item_id=new.item_id) or (new.session_id is not null and k='sessions' and e.session_id=new.session_id))) then raise exception 'Progress already recorded' using errcode='23505'; end if;
  elsif TG_TABLE_NAME='pursuit_discussion' then
    if TG_OP='UPDATE' and (new.id<>old.id or new.thread<>old.thread or new.parent_id is distinct from old.parent_id or new.created_at<>old.created_at) then raise exception 'Thread cannot change' using errcode='23514'; end if;
    if left(new.thread,13)='legacy-entry:' and not exists(select 1 from public.pursuit_progress e where e.id=substring(new.thread from 14) and e.pursuit_id=p.id and e.post_id is null) then raise exception 'Invalid historical thread' using errcode='23514'; end if;
    if left(new.thread,15)='legacy-session:' and not exists(select 1 from public.pursuit_sessions s where s.id::text=substring(new.thread from 16) and s.pursuit_id=p.id) then raise exception 'Invalid historical session' using errcode='23514'; end if;
    if new.thread like 'entry:%' and exists(select 1 from public.pursuit_contributions e where e.id::text=substring(new.thread from 7) and e.post_id is not null) then raise exception 'Comment on the linked Moment' using errcode='23514'; end if;
    if new.thread like 'entry:%' and not exists(select 1 from public.pursuit_contributions e where e.id::text=substring(new.thread from 7) and e.pursuit_id=p.id) then raise exception 'Invalid thread' using errcode='23514'; end if;
    if new.thread like 'session:%' and not exists(select 1 from public.pursuit_meetings s where s.id::text=substring(new.thread from 9) and s.pursuit_id=p.id) then raise exception 'Invalid thread' using errcode='23514'; end if;
    if new.parent_id is not null then
      select m.* into parent from public.pursuit_discussion m where m.id=new.parent_id;
      if parent.id is null or parent.pursuit_id<>p.id or parent.thread<>new.thread or parent.parent_id is not null then raise exception 'Invalid reply' using errcode='23514'; end if;
    end if;
    if cardinality(new.mentions)>30 or exists(select 1 from unnest(new.mentions) u where not (u=p.user_id or exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.user_id=u and m.status='joined')) or private.is_blocked_between(auth.uid(),u)) then raise exception 'Invalid mention' using errcode='23514'; end if;
  elsif TG_TABLE_NAME='pursuit_attendance' then
    if not exists(select 1 from public.pursuit_meetings s where s.id=new.session_id and s.pursuit_id=p.id and not s.cancelled) then raise exception 'Invalid session' using errcode='23514'; end if;
    if TG_OP='UPDATE' and new.session_id<>old.session_id then raise exception 'Session cannot change' using errcode='23514'; end if;
  elsif TG_TABLE_NAME='pursuit_applause' then
    if not exists(select 1 from public.pursuit_discussion m where m.id=new.message_id and m.pursuit_id=p.id) then raise exception 'Invalid message' using errcode='23514'; end if;
    if TG_OP='UPDATE' and new.message_id<>old.message_id then raise exception 'Message cannot change' using errcode='23514'; end if;
  elsif TG_TABLE_NAME='pursuit_meetings' then
    if TG_OP='UPDATE' and (new.id<>old.id or new.series_id<>old.series_id) then raise exception 'Session cannot change' using errcode='23514'; end if;
    if not isfinite(new.starts_at) then raise exception 'Invalid date' using errcode='23514'; end if;
    if not exists(select 1 from pg_timezone_names z where z.name=new.timezone) then raise exception 'Invalid timezone' using errcode='23514'; end if;
  elsif TG_TABLE_NAME='pursuit_personal_goals' then
    if (k='sessions' or w->'legacy'->>'kind'='moments') and new.target is not null and new.target<>trunc(new.target) then raise exception 'Use whole sessions' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_pursuit_workflow_row() from public,anon,authenticated;

create or replace function private.validate_pursuit_workflow_config()
returns trigger language plpgsql security definer set search_path='' as $$
declare w jsonb; oldw jsonb; k text; v numeric;
begin
  w:=new.measure->'workflow';
  if w is null then
    if TG_OP='UPDATE' and old.measure->'workflow' is not null then raise exception 'Workflow cannot be removed' using errcode='23514'; end if;
    return new;
  end if;
  k:=w->>'tracking';
  if w->>'version' is distinct from '2' or k not in ('sessions','total','checklist','updates') or k is null then raise exception 'Invalid tracking' using errcode='23514'; end if;
  if w->>'target' is not null then
    v:=(w->>'target')::numeric;
    if v<=0 or v>100000000 or (k='sessions' and v<>trunc(v)) then raise exception 'Invalid target' using errcode='23514'; end if;
  end if;
  if k='total' and not coalesce((w->'legacy'->>'kind'='goal' and to_jsonb(new)->>'goal_shape'='number'),false) and length(trim(coalesce(w->>'unit',''))) not between 1 and 30 then raise exception 'Invalid unit' using errcode='23514'; end if;
  if w->>'finishBy' is not null then perform (w->>'finishBy')::date; end if;
  if jsonb_typeof(w->'items') is distinct from 'array' then raise exception 'Invalid checklist' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(w->'items') i where length(trim(i->>'title')) not between 1 and 140 or (i->>'id')::uuid is null) then raise exception 'Invalid checklist item' using errcode='23514'; end if;
  if (select count(*) from jsonb_array_elements(w->'items') i)<>(select count(distinct i->>'id') from jsonb_array_elements(w->'items') i) then raise exception 'Duplicate checklist item' using errcode='23514'; end if;
  if k='checklist' and not exists(select 1 from jsonb_array_elements(w->'items') i where not coalesce((i->>'archived')::boolean,false)) then raise exception 'Add a checklist item' using errcode='23514'; end if;
  if TG_OP='UPDATE' then
    oldw:=private.compatible_pursuit_definition(old);
    if w->'legacy'->>'kind' is distinct from oldw->'legacy'->>'kind' then raise exception 'Historical source cannot change' using errcode='23514'; end if;
    if oldw->'legacy' is not null and (oldw->>'tracking' is distinct from k or oldw->>'unit' is distinct from w->>'unit' or coalesce(w->'legacy'->'measure','null'::jsonb) is distinct from coalesce(oldw->'legacy'->'measure','null'::jsonb)) then raise exception 'Historical tracking cannot change' using errcode='23514'; end if;
    if exists(select 1 from public.pursuit_contributions e where e.pursuit_id=new.id) and (oldw->>'tracking' is distinct from k or oldw->>'unit' is distinct from w->>'unit' or (old.mode<>new.mode and not(old.mode='solo' and new.mode='together'))) then raise exception 'Tracking cannot change after progress' using errcode='23514'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(oldw->'items','[]')) i where not exists(select 1 from jsonb_array_elements(w->'items') j where j->>'id'=i->>'id')) then raise exception 'Archive checklist items instead of removing them' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_pursuit_workflow_config() from public,anon,authenticated;

alter table public.pursuit_discussion drop constraint pursuit_discussion_thread_check;
alter table public.pursuit_discussion add constraint pursuit_discussion_thread_check check(
  thread='chat' or thread ~ '^(entry|session):[0-9a-f-]{36}$'
  or (left(thread,13)='legacy-entry:' and length(thread) between 14 and 300)
  or (left(thread,15)='legacy-session:' and substring(thread from 16) ~ '^[0-9]+$')
);

-- Historical entry corrections change amount/note only. Dates, author, images and Moment links stay intact.
create or replace function public.edit_legacy_pursuit_progress(p_pursuit text,p_entry text,p_amount numeric,p_note text,p_remove boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare e public.pursuit_progress; p public.pursuits;
begin
  if not private.pursuit_workflow_access(p_pursuit) or public.write_blocked() then raise exception 'Not allowed' using errcode='42501'; end if;
  select p0.* into p from public.pursuits p0 where p0.id=p_pursuit for update;
  select e0.* into e from public.pursuit_progress e0 where e0.id=p_entry and e0.pursuit_id=p_pursuit and e0.user_id=auth.uid() for update;
  if e.id is null then raise exception 'Not your entry' using errcode='42501'; end if;
  if p_remove then delete from public.pursuit_progress where pursuit_progress.id=p_entry; return; end if;
  if p_amount is null or p_amount<0 or p_amount>100000000 or length(coalesce(p_note,''))>1000
    or (p.measure is not null and not coalesce((p.measure->>'allowDecimals')::boolean,false) and p_amount<>trunc(p_amount)) then raise exception 'Invalid amount' using errcode='23514'; end if;
  update public.pursuit_progress set amount=p_amount,note=p_note where pursuit_progress.id=p_entry;
end $$;
revoke all on function public.edit_legacy_pursuit_progress(text,text,numeric,text,boolean) from public,anon;
grant execute on function public.edit_legacy_pursuit_progress(text,text,numeric,text,boolean) to authenticated;

create or replace function public.edit_legacy_pursuit_session(p_pursuit text,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s public.pursuit_sessions; r jsonb;
begin
  if not private.pursuit_workflow_access(p_pursuit) or public.write_blocked() then raise exception 'Not allowed' using errcode='42501'; end if;
  if jsonb_array_length(p_rows)<>1 then raise exception 'Edit one historical session' using errcode='23514'; end if;
  r:=p_rows->0;
  select s0.* into s from public.pursuit_sessions s0 where s0.id=(r->>'legacy_id')::bigint and s0.pursuit_id=p_pursuit for update;
  if s.id is null or not(s.created_by=auth.uid() or exists(select 1 from public.pursuits p where p.id=p_pursuit and p.user_id=auth.uid())) then raise exception 'Host only' using errcode='42501'; end if;
  if not isfinite((r->>'starts_at')::timestamptz) or length(coalesce(r->>'place',''))>120 or length(coalesce(r->>'note',''))>140 then raise exception 'Invalid session' using errcode='23514'; end if;
  update public.pursuit_sessions set starts_at=(r->>'starts_at')::timestamptz,place=r->>'place',note=r->>'note' where pursuit_sessions.id=s.id;
end $$;
revoke all on function public.edit_legacy_pursuit_session(text,jsonb) from public,anon;
grant execute on function public.edit_legacy_pursuit_session(text,jsonb) to authenticated;

create or replace function public.legacy_pursuit_rsvp(p_pursuit text,p_session bigint,p_going boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.pursuit_workflow_access(p_pursuit) or public.write_blocked() or not exists(select 1 from public.pursuit_sessions s where s.id=p_session and s.pursuit_id=p_pursuit) then raise exception 'Not allowed' using errcode='42501'; end if;
  if p_going then insert into public.pursuit_session_rsvps(session_id,user_id) values(p_session,auth.uid()) on conflict do nothing;
  else delete from public.pursuit_session_rsvps where pursuit_session_rsvps.session_id=p_session and pursuit_session_rsvps.user_id=auth.uid(); end if;
end $$;
revoke all on function public.legacy_pursuit_rsvp(text,bigint,boolean) from public,anon;
grant execute on function public.legacy_pursuit_rsvp(text,bigint,boolean) to authenticated;
create or replace function private.pursuit_workflow_notice()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[]:='{}'; recipient uuid; parent_user uuid; body0 text; event0 text;
begin
  if TG_TABLE_NAME='pursuit_discussion' then
    if TG_OP='UPDATE' then return new; end if;
    if new.parent_id is not null then select d.user_id into parent_user from public.pursuit_discussion d where d.id=new.parent_id; end if;
    recipients:=new.mentions || array[parent_user];
    if new.thread like 'entry:%' then select e.user_id into parent_user from public.pursuit_contributions e where e.id::text=substring(new.thread from 7); end if;
    if left(new.thread,13)='legacy-entry:' then select e.user_id into parent_user from public.pursuit_progress e where e.id=substring(new.thread from 14) and e.pursuit_id=new.pursuit_id; end if;
    recipients:=recipients || array[parent_user]; body0:='A friend replied or mentioned you in your Pursuit.'; event0:='message:'||new.id;
  elsif TG_TABLE_NAME='pursuit_meetings' then
    if TG_OP<>'UPDATE' or (new.starts_at=old.starts_at and new.place=old.place and new.cancelled=old.cancelled) then return new; end if;
    recipients:=array(select a.user_id from public.pursuit_attendance a where a.session_id=new.id and a.going);
    body0:='A session changed: '||left(new.title,150); event0:='session:'||new.id||':'||md5(new.starts_at::text||new.place||new.cancelled::text);
  elsif TG_TABLE_NAME='pursuits' then
    if new.measure->'workflow' is null or new.title=old.title and new.measure=old.measure then return new; end if;
    insert into public.pursuit_discussion(id,pursuit_id,user_id,body,thread) values(gen_random_uuid(),new.id,auth.uid(),'Shared Pursuit details changed.','chat');
    return new;
  end if;
  foreach recipient in array recipients loop
    if recipient is not null and recipient<>auth.uid() and not private.is_blocked_between(auth.uid(),recipient)
      and not exists(select 1 from public.pursuit_personal_goals g where g.pursuit_id=new.pursuit_id and g.user_id=recipient and g.muted)
      and exists(select 1 from public.pursuits p where p.id=new.pursuit_id and (p.user_id=recipient or exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.user_id=recipient and m.status='joined'))) then
      insert into public.pursuit_notices(pursuit_id,user_id,event_id,body) values(new.pursuit_id,recipient,event0,left(body0,300)) on conflict(user_id,event_id) do nothing;
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.pursuit_workflow_notice() from public,anon,authenticated;

-- Keep the original profile visibility/redaction contract. Only enrich the owner's own rows.
create or replace function public.get_compatible_profile_pursuits(p_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; result jsonb:='[]'; r jsonb; p public.pursuits; w jsonb; g public.pursuit_personal_goals; current0 numeric; target0 numeric; status0 text; kind0 text; actor uuid:=auth.uid();
begin
  base:=public.get_profile_pursuits(p_profile);
  if actor is distinct from p_profile or not private.is_member() then return base; end if;
  for r in select value from jsonb_array_elements(base) loop
    select p0.* into p from public.pursuits p0 where p0.id=r->>'id' and p0.user_id=actor;
    if p.id is null then continue; end if;
    w:=private.compatible_pursuit_definition(p); kind0:=w->'legacy'->>'kind';
    select g0.* into g from public.pursuit_personal_goals g0 where g0.pursuit_id=p.id and g0.user_id=actor;
    target0:=case when g.user_id is not null and p.mode<>'group' then g.target else (w->>'target')::numeric end;
    current0:=case when kind0='goal' then coalesce((to_jsonb(p)->>'goal_current')::numeric,0) when kind0='measure' then coalesce((w->'legacy'->'measure'->>'startingAmount')::numeric,0) else coalesce((w->>'startingAmount')::numeric,0) end;
    if kind0='moments' then current0:=(r->>'momentCount')::numeric;
    elsif w->>'tracking'='checklist' then
      current0:=(select count(distinct e.item_id) from public.pursuit_contributions e where e.pursuit_id=p.id and (p.mode='group' or e.user_id=actor) and exists(select 1 from jsonb_array_elements(w->'items') i where i->>'id'=e.item_id::text and not coalesce((i->>'archived')::boolean,false)));
      target0:=(select count(*) from jsonb_array_elements(w->'items') i where not coalesce((i->>'archived')::boolean,false));
    else
      current0:=current0+coalesce((select sum(e.amount) from public.pursuit_contributions e where e.pursuit_id=p.id and (p.mode='group' or e.user_id=actor)),0);
      if kind0='measure' then current0:=current0+coalesce((select sum(e.amount) from public.pursuit_progress e where e.pursuit_id=p.id and (p.mode='group' or e.user_id=actor)),0); end if;
    end if;
    status0:=case when g.user_id is not null and p.mode<>'group' then g.status when p.finished_at is not null or to_jsonb(p)->>'let_go_at' is not null then 'finished' when p.paused_at is not null then 'paused' else 'active' end;
    result:=result || jsonb_build_array(r || jsonb_build_object('finished',status0='finished','finishedAt',case when p.finished_at is not null then r->'finishedAt' else null end,'workflow',jsonb_build_object('tracking',w->>'tracking','current',current0,'target',target0,'unit',w->>'unit','status',status0)));
  end loop;
  return result;
end $$;
revoke all on function public.get_compatible_profile_pursuits(uuid) from public,anon;
grant execute on function public.get_compatible_profile_pursuits(uuid) to anon,authenticated;

-- Same public/guest surface as get_profile_pursuits; owner-only enrichment requires full membership.
insert into private.access_allowlist(kind,name,reason) values
('rpc_anon','get_compatible_profile_pursuits','Delegates profile visibility and redaction to get_profile_pursuits'),
('rpc_guest','get_compatible_profile_pursuits','Delegates profile visibility and redaction to get_profile_pursuits')
on conflict(kind,name) do nothing;
