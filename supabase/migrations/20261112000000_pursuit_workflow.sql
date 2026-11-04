-- Proposed additive workflow. Live schema must be checked before deployment.
-- Does not change legacy data or existing progress/session policies.
-- Preflight: fail before creating objects if prerequisite functions are absent.
do $$ begin
  if to_regclass('public.pursuits') is null or to_regclass('public.pursuit_members') is null
    or to_regprocedure('private.is_member()') is null
    or to_regprocedure('public.enforce_rate_limit(text,integer,interval)') is null then
    raise exception 'Pursuit workflow prerequisites are missing';
  end if;
end $$;

create or replace function private.pursuit_workflow_access(pid text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists (
    select 1 from public.pursuits p where p.id = pid and (
      p.user_id = auth.uid() or exists (select 1 from public.pursuit_members m where m.pursuit_id = p.id and m.user_id = auth.uid() and m.status = 'joined')
    ) and not private.is_blocked_between(auth.uid(), p.user_id)
    and not exists (select 1 from public.pursuit_members b where b.pursuit_id = p.id and b.status = 'joined' and private.is_blocked_between(auth.uid(), b.user_id))
  )
$$;
revoke all on function private.pursuit_workflow_access(text) from public, anon;
grant execute on function private.pursuit_workflow_access(text) to authenticated;

create table public.pursuit_personal_goals (
  pursuit_id text not null references public.pursuits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target numeric check (target > 0 and target <= 100000000),
  finish_by date, status text not null default 'active' check (status in ('active','paused','finished')),
  muted boolean not null default false,
  primary key (pursuit_id,user_id)
);
create table public.pursuit_meetings (
  id uuid primary key, pursuit_id text not null references public.pursuits(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 80),
  starts_at timestamptz not null, place text not null default '' check (length(place) <= 140),
  note text not null default '' check (length(note) <= 1000),
  series_id uuid not null, timezone text not null, cancelled boolean not null default false
);
create index pursuit_meetings_by_pursuit on public.pursuit_meetings(pursuit_id,starts_at);
create table public.pursuit_contributions (
  id uuid primary key, pursuit_id text not null references public.pursuits(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount numeric not null check (amount > 0 and amount <= 100000000),
  occurred_at timestamptz not null, created_at timestamptz not null default now(),
  note text not null default '' check (length(note) <= 1000),
  post_id bigint references public.posts(id) on delete set null, item_id uuid, session_id uuid references public.pursuit_meetings(id),
  -- Uniqueness is also enforced under a row lock by the validation trigger for shared goals.
  unique(pursuit_id,user_id,item_id), unique(pursuit_id,user_id,session_id)
);
create index pursuit_contributions_by_pursuit on public.pursuit_contributions(pursuit_id,occurred_at);
create table public.pursuit_discussion (
  id uuid primary key, pursuit_id text not null references public.pursuits(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null check (length(trim(body)) between 1 and 2000),
  thread text not null check (thread = 'chat' or thread ~ '^(entry|session):[0-9a-f-]{36}$'),
  parent_id uuid references public.pursuit_discussion(id) on delete cascade,
  mentions uuid[] not null default '{}', created_at timestamptz not null default now()
);
create index pursuit_discussion_by_pursuit on public.pursuit_discussion(pursuit_id,created_at);
create table public.pursuit_attendance (
  pursuit_id text not null references public.pursuits(id) on delete cascade,
  session_id uuid not null references public.pursuit_meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id), going boolean not null,
  primary key(session_id,user_id)
);
create table public.pursuit_applause (
  pursuit_id text not null references public.pursuits(id) on delete cascade,
  message_id uuid not null references public.pursuit_discussion(id) on delete cascade,
  user_id uuid not null references auth.users(id), primary key(message_id,user_id)
);
-- These are private in-app Pursuit notices, not new public.notifications kinds.
create table public.pursuit_notices (
  id uuid primary key default gen_random_uuid(), pursuit_id text not null references public.pursuits(id) on delete cascade,
  user_id uuid not null references auth.users(id), event_id text not null,
  body text not null check (length(body) <= 300), created_at timestamptz not null default now(), read_at timestamptz,
  unique(user_id,event_id)
);

alter table public.pursuit_personal_goals enable row level security;
create policy "members only" on public.pursuit_personal_goals as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_meetings enable row level security;
create policy "members only" on public.pursuit_meetings as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_contributions enable row level security;
create policy "members only" on public.pursuit_contributions as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_discussion enable row level security;
create policy "members only" on public.pursuit_discussion as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_attendance enable row level security;
create policy "members only" on public.pursuit_attendance as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_applause enable row level security;
create policy "members only" on public.pursuit_applause as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
alter table public.pursuit_notices enable row level security;
create policy "members only" on public.pursuit_notices as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));

-- Each row is scoped to joined participants only, even if the Pursuit itself is public.
do $$ declare t text; begin
  foreach t in array array['pursuit_personal_goals','pursuit_meetings','pursuit_contributions','pursuit_discussion','pursuit_attendance','pursuit_applause','pursuit_notices'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy "joined participants read" on public.%I for select to authenticated using (private.pursuit_workflow_access(pursuit_id))',t);
    if t <> 'pursuit_notices' then
      execute format('create policy "own joined writes" on public.%I for insert to authenticated with check (user_id = auth.uid() and private.pursuit_workflow_access(pursuit_id) and not public.write_blocked())',t);
      execute format('create policy "own joined changes" on public.%I for update to authenticated using (user_id = auth.uid() and private.pursuit_workflow_access(pursuit_id)) with check (user_id = auth.uid() and private.pursuit_workflow_access(pursuit_id) and not public.write_blocked())',t);
      execute format('create policy "own joined removes" on public.%I for delete to authenticated using (user_id = auth.uid() and private.pursuit_workflow_access(pursuit_id) and not public.write_blocked())',t);
    end if;
  end loop;
end $$;
-- Notices may be read/acknowledged only by their recipient, never client-created.
create policy "own notices only" on public.pursuit_notices as restrictive for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "acknowledge notice" on public.pursuit_notices for update to authenticated using (user_id=auth.uid() and private.pursuit_workflow_access(pursuit_id)) with check(user_id=auth.uid() and private.pursuit_workflow_access(pursuit_id));
revoke update on public.pursuit_notices from authenticated;
grant update(read_at) on public.pursuit_notices to authenticated;
-- Shared checklist items can be reopened by any participant, retaining author identity on other entries.
create policy "reopen shared checklist" on public.pursuit_contributions for delete to authenticated using (
  item_id is not null and private.pursuit_workflow_access(pursuit_id) and not public.write_blocked()
  and exists(select 1 from public.pursuits p where p.id=pursuit_contributions.pursuit_id and p.mode='group')
);
create policy "host edits meetings" on public.pursuit_meetings for update to authenticated using (
  private.pursuit_workflow_access(pursuit_id) and exists(select 1 from public.pursuits p where p.id=pursuit_meetings.pursuit_id and p.user_id=auth.uid())
) with check(private.pursuit_workflow_access(pursuit_id) and not public.write_blocked());

create or replace function private.validate_pursuit_workflow_row()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.pursuits; w jsonb; k text; parent public.pursuit_discussion; existing_row boolean;
begin
  select p0.* into p from public.pursuits p0 where p0.id=new.pursuit_id for update;
  w:=p.measure->'workflow'; k:=w->>'tracking';
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
    if TG_OP='UPDATE' and (new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Identity cannot change' using errcode='23514'; end if;
    if not isfinite(new.occurred_at) or not isfinite(new.created_at) then raise exception 'Invalid date' using errcode='23514'; end if;
    if k='updates' or (k='sessions' and new.amount<>1) then raise exception 'Invalid progress amount' using errcode='23514'; end if;
    if p.finished_at is not null or p.paused_at is not null or exists(select 1 from public.pursuit_personal_goals g where g.pursuit_id=p.id and g.user_id=auth.uid() and g.status<>'active') then raise exception 'Resume before recording progress' using errcode='23514'; end if;
    if k='checklist' then
      if new.amount<>1 or not exists(select 1 from jsonb_array_elements(w->'items') i where i->>'id'=new.item_id::text and not coalesce((i->>'archived')::boolean,false)) then raise exception 'Invalid checklist item' using errcode='23514'; end if;
    elsif new.item_id is not null then raise exception 'Unexpected checklist item' using errcode='23514'; end if;
    if new.post_id is not null and not exists(select 1 from public.posts m where m.id=new.post_id and m.user_id=new.user_id and m.pursuit_id=p.id) then raise exception 'Invalid Moment' using errcode='23514'; end if;
    if exists(select 1 from public.pursuit_contributions e where e.id<>new.id and e.post_id=new.post_id and new.post_id is not null) then raise exception 'Moment already counted' using errcode='23505'; end if;
    if new.session_id is not null and not exists(select 1 from public.pursuit_meetings s where s.id=new.session_id and s.pursuit_id=p.id and not s.cancelled) then raise exception 'Session does not belong here' using errcode='23514'; end if;
    if exists(select 1 from public.pursuit_contributions e where e.pursuit_id=p.id and e.id<>new.id and (p.mode='group' or e.user_id=new.user_id) and ((new.item_id is not null and e.item_id=new.item_id) or (new.session_id is not null and k='sessions' and e.session_id=new.session_id))) then raise exception 'Progress already recorded' using errcode='23505'; end if;
  elsif TG_TABLE_NAME='pursuit_discussion' then
    if TG_OP='UPDATE' and (new.id<>old.id or new.thread<>old.thread or new.parent_id is distinct from old.parent_id or new.created_at<>old.created_at) then raise exception 'Thread cannot change' using errcode='23514'; end if;
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
    if k='sessions' and new.target is not null and new.target<>trunc(new.target) then raise exception 'Use whole sessions' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_pursuit_workflow_row() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['pursuit_personal_goals','pursuit_contributions','pursuit_discussion','pursuit_meetings','pursuit_attendance','pursuit_applause'] loop
    execute format('create trigger validate_workflow_row before insert or update on public.%I for each row execute function private.validate_pursuit_workflow_row()',t);
  end loop;
end $$;

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
  if k='total' and length(trim(coalesce(w->>'unit',''))) not between 1 and 30 then raise exception 'Invalid unit' using errcode='23514'; end if;
  if w->>'finishBy' is not null then perform (w->>'finishBy')::date; end if;
  if jsonb_typeof(w->'items') is distinct from 'array' then raise exception 'Invalid checklist' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(w->'items') i where length(trim(i->>'title')) not between 1 and 140 or (i->>'id')::uuid is null) then raise exception 'Invalid checklist item' using errcode='23514'; end if;
  if (select count(*) from jsonb_array_elements(w->'items') i)<>(select count(distinct i->>'id') from jsonb_array_elements(w->'items') i) then raise exception 'Duplicate checklist item' using errcode='23514'; end if;
  if k='checklist' and not exists(select 1 from jsonb_array_elements(w->'items') i where not coalesce((i->>'archived')::boolean,false)) then raise exception 'Add a checklist item' using errcode='23514'; end if;
  if TG_OP='UPDATE' then
    oldw:=old.measure->'workflow';
    if exists(select 1 from public.pursuit_contributions e where e.pursuit_id=new.id) and (oldw->>'tracking' is distinct from k or oldw->>'unit' is distinct from w->>'unit' or (old.mode<>new.mode and not(old.mode='solo' and new.mode='together'))) then raise exception 'Tracking cannot change after progress' using errcode='23514'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(oldw->'items','[]')) i where not exists(select 1 from jsonb_array_elements(w->'items') j where j->>'id'=i->>'id')) then raise exception 'Archive checklist items instead of removing them' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_pursuit_workflow_config() from public,anon,authenticated;
create trigger validate_workflow_config before insert or update on public.pursuits for each row execute function private.validate_pursuit_workflow_config();

create or replace function public.create_pursuit_workflow(p_project jsonb,p_invitees uuid[] default '{}')
returns text language plpgsql security definer set search_path='' as $$
declare pid text:=p_project->>'id'; mode0 text:=p_project->>'mode'; existing uuid; invitee uuid;
begin
  if not private.is_member() or public.write_blocked() then raise exception 'Members only' using errcode='42501'; end if;
  if length(trim(p_project->>'title')) not between 1 and 80 or length(pid) not between 1 and 100 or cardinality(p_invitees)>30 or mode0 not in ('solo','together','group') then raise exception 'Invalid Pursuit' using errcode='23514'; end if;
  -- Serialize retry races by id; no untrusted row can replace another owner's Pursuit.
  perform pg_advisory_xact_lock(hashtextextended(pid,0));
  select p.user_id into existing from public.pursuits p where p.id=pid;
  if existing is not null then
    if existing<>auth.uid() then raise exception 'Not your Pursuit' using errcode='42501'; end if;
    return pid;
  end if;
  if (p_project->'measure'->'workflow'->>'version') is distinct from '2' then raise exception 'Invalid workflow' using errcode='23514'; end if;
  insert into public.pursuits(id,user_id,title,hobby_slug,sub_hobby,inspired_by_post_id,shared,mode,measure,visibility,started_at)
  values(pid,auth.uid(),trim(p_project->>'title'),p_project->>'hobbySlug',p_project->>'subHobby',(p_project->>'inspiredByPostId')::bigint,false,mode0,p_project->'measure',case when mode0='solo' then 'solo' else 'friends' end,now());
  if mode0<>'solo' then
    insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values(pid,auth.uid(),'owner','joined',auth.uid());
    foreach invitee in array p_invitees loop
      if invitee<>auth.uid() then
        if private.is_blocked_between(auth.uid(),invitee) then raise exception 'Cannot invite this person' using errcode='42501'; end if;
        insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values(pid,invitee,'member','invited',auth.uid()) on conflict do nothing;
      end if;
    end loop;
  end if;
  return pid;
end $$;
revoke all on function public.create_pursuit_workflow(jsonb,uuid[]) from public,anon;
grant execute on function public.create_pursuit_workflow(jsonb,uuid[]) to authenticated;

create or replace function public.edit_pursuit_workflow(p_id text,p_title text,p_measure jsonb,p_finished timestamptz,p_paused timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.pursuit_workflow_access(p_id) or public.write_blocked() or not exists(select 1 from public.pursuits p where p.id=p_id and p.user_id=auth.uid()) then raise exception 'Host only' using errcode='42501'; end if;
  if length(trim(p_title)) not between 1 and 80 then raise exception 'Invalid name' using errcode='23514'; end if;
  update public.pursuits set title=trim(p_title),measure=p_measure,finished_at=p_finished,paused_at=p_paused,updated_at=now() where public.pursuits.id=p_id;
end $$;
revoke all on function public.edit_pursuit_workflow(text,text,jsonb,timestamptz,timestamptz) from public,anon;
grant execute on function public.edit_pursuit_workflow(text,text,jsonb,timestamptz,timestamptz) to authenticated;

-- Notifications stay inside the Pursuit. Existing notification kinds/triggers are untouched.
create or replace function private.pursuit_workflow_notice()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[]:='{}'; recipient uuid; parent_user uuid; body0 text; event0 text;
begin
  if TG_TABLE_NAME='pursuit_discussion' then
    if TG_OP='UPDATE' then return new; end if;
    if new.parent_id is not null then select d.user_id into parent_user from public.pursuit_discussion d where d.id=new.parent_id; end if;
    recipients:=new.mentions || array[parent_user];
    if new.thread like 'entry:%' then select e.user_id into parent_user from public.pursuit_contributions e where e.id::text=substring(new.thread from 7); end if;
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
create trigger workflow_message_notice after insert on public.pursuit_discussion for each row execute function private.pursuit_workflow_notice();
create trigger workflow_session_notice after update on public.pursuit_meetings for each row execute function private.pursuit_workflow_notice();
create trigger workflow_edit_activity after update on public.pursuits for each row execute function private.pursuit_workflow_notice();

-- Batch an occurrence/series edit atomically, including host edits of another creator's session.
create or replace function public.save_pursuit_meetings(p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare row0 jsonb; existing public.pursuit_meetings; pid text;
begin
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 53 then raise exception 'Invalid sessions' using errcode='23514'; end if;
  for row0 in select value from jsonb_array_elements(p_rows) loop
    pid:=row0->>'pursuit_id';
    perform 1 from public.pursuits p where p.id=pid for update;
    if not private.pursuit_workflow_access(pid) or public.write_blocked() then raise exception 'Joined members only' using errcode='42501'; end if;
    select s.* into existing from public.pursuit_meetings s where s.id=(row0->>'id')::uuid;
    if existing.id is not null then
      if exists(select 1 from public.pursuit_contributions e where e.session_id=existing.id) and ((row0->>'starts_at')::timestamptz<>existing.starts_at or coalesce((row0->>'cancelled')::boolean,false)) then raise exception 'Completed sessions keep their date' using errcode='23514'; end if;
      if existing.pursuit_id<>pid or existing.user_id<>(row0->>'user_id')::uuid or not(existing.user_id=auth.uid() or exists(select 1 from public.pursuits p where p.id=pid and p.user_id=auth.uid())) then raise exception 'Not your session' using errcode='42501'; end if;
    elsif (row0->>'user_id')::uuid is distinct from auth.uid() then raise exception 'Not your session' using errcode='42501'; end if;
    insert into public.pursuit_meetings(id,pursuit_id,user_id,title,starts_at,place,note,series_id,timezone,cancelled)
    values((row0->>'id')::uuid,pid,(row0->>'user_id')::uuid,row0->>'title',(row0->>'starts_at')::timestamptz,coalesce(row0->>'place',''),coalesce(row0->>'note',''),(row0->>'series_id')::uuid,row0->>'timezone',coalesce((row0->>'cancelled')::boolean,false))
    on conflict(id) do update set title=excluded.title,starts_at=excluded.starts_at,place=excluded.place,note=excluded.note,cancelled=excluded.cancelled;
  end loop;
end $$;
revoke all on function public.save_pursuit_meetings(jsonb) from public,anon;
grant execute on function public.save_pursuit_meetings(jsonb) to authenticated;

create or replace function public.leave_pursuit_workflow(p_id text,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owner0 uuid;
begin
  select p.user_id into owner0 from public.pursuits p where p.id=p_id for update;
  if not private.is_member() or public.write_blocked() or p_user=owner0 or not(auth.uid()=p_user or auth.uid()=owner0) then raise exception 'Not allowed' using errcode='42501'; end if;
  update public.pursuit_members set status='declined' where pursuit_members.pursuit_id=p_id and pursuit_members.user_id=p_user;
  -- Contributions remain attributed to their authors after leaving.
end $$;
revoke all on function public.leave_pursuit_workflow(text,uuid) from public,anon;
grant execute on function public.leave_pursuit_workflow(text,uuid) to authenticated;

alter table public.pursuit_personal_goals add column reminder_minutes integer check(reminder_minutes in (30,1440));

-- Adding friends to a solo goal preserves its individual progress semantics.
create or replace function public.invite_pursuit_workflow(p_id text,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.pursuits p where p.id=p_id for update;
  if not private.pursuit_workflow_access(p_id) or public.write_blocked()
    or not exists(select 1 from public.pursuits p where p.id=p_id and p.user_id=auth.uid())
    or p_user is null or p_user=auth.uid() or private.is_blocked_between(auth.uid(),p_user) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.pursuit_members m where m.pursuit_id=p_id and m.user_id=p_user and m.status in ('joined','invited')) then
    perform public.enforce_rate_limit('workflow_invites',30,interval '1 hour');
  end if;
  update public.pursuits set mode='together' where pursuits.id=p_id and pursuits.mode='solo';
  insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values(p_id,auth.uid(),'owner','joined',auth.uid()) on conflict do nothing;
  insert into public.pursuit_members(pursuit_id,user_id,role,status,invited_by) values(p_id,p_user,'member','invited',auth.uid())
    on conflict(pursuit_id,user_id) do update set status=case when pursuit_members.status='declined' then 'invited' else pursuit_members.status end;
end $$;
revoke all on function public.invite_pursuit_workflow(text,uuid) from public,anon;
grant execute on function public.invite_pursuit_workflow(text,uuid) to authenticated;
