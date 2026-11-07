-- Soosh: security hardening (founder's security checklist, Nov 7, 2026).
--
-- Run AFTER 20261119000000_standing_slots.sql.
-- Rollback: rollback_20261120000000_security_hardening.sql.
-- Verification: supabase/verification/security_hardening_check.sql.
--
-- Three things, none of which changes what anyone can do in the app today:
--
--   1. Signed-out visitors (the anon role) lose INSERT, UPDATE, DELETE and TRUNCATE on every public
--      table, and signed-in people lose TRUNCATE. Row level security already refused all of these
--      (every write policy needs auth.uid() or an admin), so this is a second lock, not a change in
--      behaviour. Tables made since the member gate already start this way (standing_slots does
--      `revoke all ... from public, anon, authenticated`); this brings the older ones in line, and the
--      default privileges keep future tables that way.
--   2. Per-person rate limits on the five busy tables that had none: follows, reactions, Pursuit
--      discussion, Space join requests and Stubby feedback. Same limiter as posts, messages and the
--      rest (public.enforce_rate_limit, counted in rate_limit_hits).
--   3. An admin action log. Every write an admin makes to an admin-run table, and every change an
--      admin makes to someone else's Space, Corner, Moment, event or report, is recorded with who,
--      when, what and the row before and after. Admins read it through admin_audit_log_recent();
--      nobody can change or delete it from the app.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

-- 1. No writes for signed-out visitors, no TRUNCATE for anyone in the app ---------------------------

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
  loop
    execute format('revoke insert, update, delete, truncate on table public.%I from anon', r.relname);
    execute format('revoke truncate on table public.%I from authenticated', r.relname);
  end loop;
end
$$;

alter default privileges for role postgres in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges for role postgres in schema public revoke truncate on tables from authenticated;

-- 2. Rate limits ------------------------------------------------------------------------------------

-- One trigger function for every limit: tg_argv is (action, max, window).
create function private.rate_limit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::interval);
  return new;
end;
$$;

revoke all on function private.rate_limit_insert() from public, anon, authenticated;

create trigger rl_profile_follows_insert before insert on public.profile_follows
  for each row execute function private.rate_limit_insert('profile_follows_insert', '60', '10 minutes');
create trigger rl_reactions_insert before insert on public.reactions
  for each row execute function private.rate_limit_insert('reactions_insert', '120', '10 minutes');
create trigger rl_pursuit_discussion_insert before insert on public.pursuit_discussion
  for each row execute function private.rate_limit_insert('pursuit_discussion_insert', '30', '10 minutes');
create trigger rl_space_join_requests_insert before insert on public.space_join_requests
  for each row execute function private.rate_limit_insert('space_join_requests_insert', '20', '1 hour');
create trigger rl_stubby_feedback_insert before insert on public.stubby_feedback
  for each row execute function private.rate_limit_insert('stubby_feedback_insert', '100', '10 minutes');

-- 3. Admin action log -------------------------------------------------------------------------------

-- In the private schema, which the API never exposes. No grants: only the functions below touch it.
create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  target_table text not null,
  target_id text,
  before jsonb,
  after jsonb
);

alter table private.admin_audit_log enable row level security;
revoke all on private.admin_audit_log from public, anon, authenticated;
create index admin_audit_log_at_idx on private.admin_audit_log (at desc);
create index admin_audit_log_admin_idx on private.admin_audit_log (admin_id, at desc);

-- After a write: when the person making it is an admin, one row in the log. Writes by the server
-- itself (no auth.uid(), e.g. Stubby's morning restock) and by non-admins are not admin actions.
-- With tg_argv[0] = 'not_own', an admin's own rows (created_by or user_id is them) are skipped,
-- so an admin posting their own Moment or editing their own Space is not logged as moderation.
create function private.log_admin_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb;
begin
  -- pg_trigger_depth() > 1: the write came from another trigger (a Corner's Moment count going up
  -- when an admin posts, say), not from the admin's own statement or an admin_* function.
  if v_actor is null or pg_trigger_depth() > 1 or not private.is_admin(v_actor) then
    return null;
  end if;
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_nargs > 0 and tg_argv[0] = 'not_own'
     and coalesce(v_row ->> 'created_by', v_row ->> 'user_id') = v_actor::text then
    return null;
  end if;
  insert into private.admin_audit_log (admin_id, action, target_table, target_id, before, after)
  values (
    v_actor,
    tg_op,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'slug'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

revoke all on function private.log_admin_write() from public, anon, authenticated;

-- Tables only admins write: every admin write.
create trigger audit_admin_app_config after insert or update or delete on public.app_config
  for each row execute function private.log_admin_write();
create trigger audit_admin_categories after insert or update or delete on public.categories
  for each row execute function private.log_admin_write();
create trigger audit_admin_corner_categories after insert or update or delete on public.corner_categories
  for each row execute function private.log_admin_write();
create trigger audit_admin_city_picks after insert or update or delete on public.city_picks
  for each row execute function private.log_admin_write();
create trigger audit_admin_moderation_queue after insert or update or delete on public.moderation_queue
  for each row execute function private.log_admin_write();
create trigger audit_admin_scout_sources after insert or update or delete on public.scout_sources
  for each row execute function private.log_admin_write();

-- Tables members write too: only an admin's changes to rows that aren't theirs.
create trigger audit_admin_spaces after insert or update or delete on public.spaces
  for each row execute function private.log_admin_write('not_own');
create trigger audit_admin_corners after update or delete on public.corners
  for each row execute function private.log_admin_write('not_own');
create trigger audit_admin_standing_slots after insert or update or delete on public.standing_slots
  for each row execute function private.log_admin_write('not_own');
create trigger audit_admin_space_events after update or delete on public.space_events
  for each row execute function private.log_admin_write('not_own');
-- Moments: deletes only. Updates to posts also come from counters (a like updates the post as the
-- person liking it), which would log an admin's like as moderation.
create trigger audit_admin_posts after delete on public.posts
  for each row execute function private.log_admin_write('not_own');
-- Reports: an admin closing or changing a report. Filing one is not an admin action.
create trigger audit_admin_reports after update or delete on public.reports
  for each row execute function private.log_admin_write();

-- Reading the log: admins only, newest first, at most 500 rows.
create function public.admin_audit_log_recent(p_limit integer default 100)
returns table (
  at timestamptz,
  admin_id uuid,
  admin_name text,
  action text,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select
      l.at,
      l.admin_id,
      (select p.display_name from public.profiles p where p.id = l.admin_id),
      l.action,
      l.target_table,
      l.target_id,
      l.before,
      l.after
    from private.admin_audit_log l
    order by l.at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.admin_audit_log_recent(integer) from public, anon;
grant execute on function public.admin_audit_log_recent(integer) to authenticated;
