-- Read only. Run against the live project before reviewing/deploying this migration.
select c.table_name, c.column_name, c.data_type, c.is_nullable
from information_schema.columns c
where c.table_schema='public' and c.table_name in
('pursuits','pursuit_members','pursuit_progress','pursuit_sessions','pursuit_session_rsvps','pursuit_contributions','pursuit_personal_goals','pursuit_discussion','pursuit_meetings','pursuit_attendance','pursuit_applause','pursuit_notices')
order by c.table_name,c.ordinal_position;
select p.tablename,p.policyname,p.cmd,p.qual,p.with_check from pg_policies p
where p.schemaname='public' and p.tablename like 'pursuit%';
select n.nspname,p.proname,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname in ('is_member','is_active','is_blocked_between','request_gate'))
or (n.nspname='public' and p.proname in ('write_blocked','is_pursuit_participant'));
