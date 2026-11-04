-- Part 2 of 2. Exact merged migration statements, wrapped in a transaction.
BEGIN;
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

COMMIT;
