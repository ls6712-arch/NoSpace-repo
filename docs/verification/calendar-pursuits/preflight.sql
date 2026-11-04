-- Read only. No user data is returned.
select jsonb_build_object(
 'auth_role',to_regprocedure('auth.role()') is not null,
 'member_gate',to_regprocedure('private.is_active(uuid)') is not null,
 'participant_gate',to_regprocedure('private.pursuit_workflow_access(text)') is not null,
 'legacy_rsvp',to_regprocedure('public.legacy_pursuit_rsvp(text,bigint,boolean)') is not null,
 'workflow_sessions',to_regclass('public.pursuit_meetings') is not null,
 'workflow_attendance',to_regclass('public.pursuit_attendance') is not null,
 'legacy_sessions',to_regclass('public.pursuit_sessions') is not null,
 'legacy_attendance',to_regclass('public.pursuit_session_rsvps') is not null,
 'allowlist',to_regclass('private.access_allowlist') is not null,
 'service_role',exists(select 1 from pg_roles r where r.rolname='service_role'),
 'plan_flag',exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='pursuits' and c.column_name='is_plan' and c.data_type='boolean')
) as calendar_setup;
