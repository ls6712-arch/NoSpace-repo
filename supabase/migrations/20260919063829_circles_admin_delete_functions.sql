-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.
--
-- Circles itself was removed later by 20261009000000_remove_circles.sql,
-- which drops public.circle_usage and public.admin_delete_circle along
-- with everything else Circle-related — so neither function defined here
-- exists live anymore. Backfilled anyway so this repo's migration history
-- is complete and this version stops showing as a local/remote mismatch.

create or replace function public.circle_usage(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'members', (select count(*) from public.circle_members where circle_id = p_id),
    'invites', (select count(*) from public.circle_invites where circle_id = p_id),
    'threads', (select count(*) from public.posts          where circle_id = p_id + 1000000)
  );
end;
$$;

revoke all on function public.circle_usage(bigint) from public, anon;
grant execute on function public.circle_usage(bigint) to authenticated;

create or replace function public.admin_delete_circle(
  p_id bigint,
  p_threads text default 'keep_private'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_threads int;
  n_invites int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_threads not in ('keep_private', 'delete') then
    raise exception 'Choose what happens to the threads: keep_private or delete.';
  end if;

  if not exists (select 1 from public.circles where id = p_id) then
    raise exception 'That Circle doesn''t exist. (Demo Circles are built into the app and can''t be deleted here.)';
  end if;

  if p_threads = 'keep_private' then
    update public.posts
       set circle_id = null,
           circle_tab = null,
           hidden_from_moments = false
     where circle_id = p_id + 1000000;
  else
    delete from public.posts where circle_id = p_id + 1000000;
  end if;
  get diagnostics n_threads = row_count;

  delete from public.circle_invites where circle_id = p_id;
  get diagnostics n_invites = row_count;

  delete from public.circles where id = p_id;

  return jsonb_build_object('threads', n_threads, 'invites', n_invites, 'mode', p_threads);
end;
$$;

revoke all on function public.admin_delete_circle(bigint, text) from public, anon;
grant execute on function public.admin_delete_circle(bigint, text) to authenticated;
