-- Calendar session integration. Existing session/progress rows are not converted.
create table public.pursuit_session_declines (
  session_id bigint not null references public.pursuit_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(session_id,user_id)
);
create index pursuit_session_declines_user_idx on public.pursuit_session_declines(user_id);
alter table public.pursuit_session_declines enable row level security;
revoke all on public.pursuit_session_declines from public,anon,authenticated;
grant select on public.pursuit_session_declines to authenticated;
create policy "members only" on public.pursuit_session_declines as restrictive for all to authenticated using(private.is_member()) with check(private.is_member());
create policy "participants see session declines" on public.pursuit_session_declines for select to authenticated using(exists(select 1 from public.pursuit_sessions s where s.id=pursuit_session_declines.session_id and private.pursuit_workflow_access(s.pursuit_id)));

-- Preserve the old positive RSVP table while remembering a specific decline separately.
create or replace function public.set_calendar_session_attendance(p_session bigint,p_going boolean,p_user uuid default auth.uid())
returns void language plpgsql security definer set search_path='' as $$
declare pid text;
begin
  select s.pursuit_id into pid from public.pursuit_sessions s where s.id=p_session;
  perform 1 from public.pursuits p where p.id=pid for update;
  if p_user is distinct from auth.uid() or p_going is null or not coalesce(private.pursuit_workflow_access(pid),false) or public.write_blocked() then raise exception 'Not allowed' using errcode='42501'; end if;
  if p_going then
    insert into public.pursuit_session_rsvps(session_id,user_id) values(p_session,auth.uid()) on conflict do nothing;
    delete from public.pursuit_session_declines where pursuit_session_declines.session_id=p_session and pursuit_session_declines.user_id=auth.uid();
  else
    insert into public.pursuit_session_declines(session_id,user_id) values(p_session,auth.uid()) on conflict do nothing;
    delete from public.pursuit_session_rsvps where pursuit_session_rsvps.session_id=p_session and pursuit_session_rsvps.user_id=auth.uid();
  end if;
end $$;
revoke all on function public.set_calendar_session_attendance(bigint,boolean,uuid) from public,anon;
grant execute on function public.set_calendar_session_attendance(bigint,boolean,uuid) to authenticated;
create or replace function public.legacy_pursuit_rsvp(p_pursuit text,p_session bigint,p_going boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.pursuit_sessions s where s.id=p_session and s.pursuit_id=p_pursuit) then raise exception 'Not allowed' using errcode='42501'; end if;
  perform public.set_calendar_session_attendance(p_session,p_going);
end $$;
revoke all on function public.legacy_pursuit_rsvp(text,bigint,boolean) from public,anon;
grant execute on function public.legacy_pursuit_rsvp(text,bigint,boolean) to authenticated;

create or replace function public.set_calendar_workflow_attendance(p_session uuid,p_going boolean,p_user uuid default auth.uid())
returns void language plpgsql security definer set search_path='' as $$
declare pid text;
begin
  select s.pursuit_id into pid from public.pursuit_meetings s where s.id=p_session and not s.cancelled;
  perform 1 from public.pursuits p where p.id=pid for update;
  if p_user is distinct from auth.uid() or p_going is null or not coalesce(private.pursuit_workflow_access(pid),false) or public.write_blocked() then raise exception 'Not allowed' using errcode='42501'; end if;
  insert into public.pursuit_attendance(session_id,user_id,pursuit_id,going) values(p_session,auth.uid(),pid,p_going) on conflict(session_id,user_id) do update set going=excluded.going;
end $$;
revoke all on function public.set_calendar_workflow_attendance(uuid,boolean,uuid) from public,anon;
grant execute on function public.set_calendar_workflow_attendance(uuid,boolean,uuid) to authenticated;

-- Lock before reading: changing time/cancelling never overwrites concurrent session metadata.
create or replace function public.change_calendar_workflow_session(p_session uuid,p_starts_at timestamptz default null,p_cancel boolean default false,p_user uuid default auth.uid())
returns void language plpgsql security definer set search_path='' as $$
declare s public.pursuit_meetings; pid text;
begin
  select s0.pursuit_id into pid from public.pursuit_meetings s0 where s0.id=p_session;
  if p_user is distinct from auth.uid() or not coalesce(private.pursuit_workflow_access(pid),false) or public.write_blocked() then raise exception 'Not allowed' using errcode='42501'; end if;
  perform 1 from public.pursuits p where p.id=pid for update;
  select s0.* into s from public.pursuit_meetings s0 where s0.id=p_session for update;
  if s.id is null or (not p_cancel and (p_starts_at is null or not isfinite(p_starts_at))) or (s.cancelled and not p_cancel) then raise exception 'Session not available' using errcode='23514'; end if;
  perform public.save_pursuit_meetings(jsonb_build_array(to_jsonb(s)||case when p_cancel then jsonb_build_object('cancelled',true) else jsonb_build_object('starts_at',p_starts_at) end));
end $$;
revoke all on function public.change_calendar_workflow_session(uuid,timestamptz,boolean,uuid) from public,anon;
grant execute on function public.change_calendar_workflow_session(uuid,timestamptz,boolean,uuid) to authenticated;

-- One read contract for Calendar, Home and the service-role subscription feed.
-- A signed-in caller can read only themselves. The feed resolves its token before supplying p_user.
create or replace function public.get_calendar_pursuit_sessions(p_from timestamptz,p_to timestamptz,p_user uuid default auth.uid())
returns table(id text,pursuit_id text,owner_id uuid,creator_id uuid,title text,starts_at timestamptz,place text,hobby_slug text,sub_hobby text,is_plan boolean,shared_session boolean,n bigint,total bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_user is null or (coalesce(auth.role(),'')<>'service_role' and p_user is distinct from auth.uid()) then raise exception 'Not allowed' using errcode='42501'; end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '370 days' then raise exception 'Invalid range' using errcode='23514'; end if;
  return query
  with parents as (
    select p.* from public.pursuits p
    where p.finished_at is null and p.let_go_at is null
      and exists(select 1 from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false))
      and exists(select 1 from public.profiles account where account.id=p_user)
      and ((private.is_active(p_user) and (p.user_id=p_user or exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.user_id=p_user and m.status='joined')))
        or (not private.is_active(p_user) and p.user_id=p_user and p.is_plan and not p.shared))
      and not private.is_blocked_between(p_user,p.user_id)
      and not exists(select 1 from public.pursuit_members b where b.pursuit_id=p.id and b.status='joined' and private.is_blocked_between(p_user,b.user_id))
  ), sessions as (
    select 'session-'||s.id as key,s.pursuit_id,s.created_by as creator,s.starts_at,p.title,s.place,null::uuid as meeting,s.id as legacy from public.pursuit_sessions s join parents p on p.id=s.pursuit_id
    union all
    select 'meeting-'||s.id,s.pursuit_id,s.user_id,s.starts_at,s.title,s.place,s.id,null::bigint from public.pursuit_meetings s join parents p on p.id=s.pursuit_id where not s.cancelled and private.is_active(p_user)
  ), numbered as (
    select s.*,row_number() over(partition by s.pursuit_id order by s.starts_at,s.key) as ordinal,count(*) over(partition by s.pursuit_id) as planned from sessions s
  )
  select s.key,p.id,p.user_id,s.creator,s.title,s.starts_at,s.place,p.hobby_slug,p.sub_hobby,p.is_plan,
    p.mode<>'solo' and (p.user_id<>p_user or exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.user_id<>p_user and m.status in ('joined','invited'))),s.ordinal,s.planned
  from numbered s join parents p on p.id=s.pursuit_id
  where s.starts_at>=p_from and s.starts_at<p_to
    and not exists(select 1 from public.pursuit_attendance a where a.session_id=s.meeting and a.user_id=p_user and not a.going)
    and not exists(select 1 from public.pursuit_session_declines d where d.session_id=s.legacy and d.user_id=p_user)
  order by s.starts_at,s.key;
end $$;
revoke all on function public.get_calendar_pursuit_sessions(timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.get_calendar_pursuit_sessions(timestamptz,timestamptz,uuid) to authenticated,service_role;
insert into private.access_allowlist(kind,name,reason) values('rpc_account','get_calendar_pursuit_sessions','Own scheduled sessions only; unenrolled accounts see only their own private one-off plans') on conflict(kind,name) do nothing;

notify pgrst, 'reload schema';
