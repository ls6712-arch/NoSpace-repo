-- Part 1 of 2. Exact merged migration statements, wrapped in a transaction.
BEGIN;
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
COMMIT;
