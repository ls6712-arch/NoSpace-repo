-- In-app reminders only. No email, device push, or reminders to other friends.
-- Run after the workflow migration. Uses the existing pg_cron installation where available.
create or replace function private.dispatch_pursuit_reminders()
returns void language sql security definer set search_path='' as $$
  insert into public.pursuit_notices(pursuit_id,user_id,event_id,body)
  select s.pursuit_id,g.user_id,'reminder:'||s.id||':'||s.starts_at::text,
    'Upcoming session: '||left(s.title,150)
  from public.pursuit_personal_goals g
  join public.pursuit_meetings s on s.pursuit_id=g.pursuit_id
  join public.pursuit_attendance a on a.session_id=s.id and a.user_id=g.user_id and a.going
  join public.pursuits p on p.id=s.pursuit_id
  where g.reminder_minutes is not null and not g.muted and g.status='active'
    and not s.cancelled and s.starts_at>now() and s.starts_at-now()<=make_interval(mins=>g.reminder_minutes)
    and p.finished_at is null and p.paused_at is null and private.is_active(g.user_id)
    and (p.user_id=g.user_id or exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.user_id=g.user_id and m.status='joined'))
    and not private.is_blocked_between(g.user_id,p.user_id)
    and not exists(select 1 from public.pursuit_members m where m.pursuit_id=p.id and m.status='joined' and private.is_blocked_between(g.user_id,m.user_id))
  on conflict(user_id,event_id) do nothing
$$;
revoke all on function private.dispatch_pursuit_reminders() from public,anon,authenticated;
-- The SQL owner runs this job. Local PostgreSQL tests exercise the dispatcher directly.
do $$ begin
  if exists(select 1 from pg_extension e where e.extname='pg_cron') then
    perform cron.schedule('pursuit-session-reminders','* * * * *','select private.dispatch_pursuit_reminders();');
  else
    raise notice 'pg_cron unavailable: configure the reminder dispatcher before enabling reminders';
  end if;
end $$;
