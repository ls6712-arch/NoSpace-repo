-- BACKFILL: set_thread_answered() is live in production (called directly by
-- the app via supabase.rpc() — see ContentContext.tsx's setThreadAnswered)
-- but was never created by any tracked migration, the same kind of gap as
-- the Group A pre-tracking migrations. No migration file in this repo
-- creates it, yet 20260913195112_lock_down_internal_trigger_functions.sql
-- (the very next migration) already ALTERs it, so its creation has to land
-- before that point in history.
--
-- Definition taken from rollback_20261009000000_remove_circles.sql, which
-- recreates it verbatim as the pre-removal definition (that file's own
-- section 4, "set_thread_answered (sql/circle-threads.sql section 1)").
-- Per explicit instruction, this was backfilled from that file directly,
-- without separately re-verifying it against the live function body.

create or replace function public.set_thread_answered(p_post_id bigint, p_answered boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_circle bigint;
begin
  select user_id, circle_id into v_owner, v_circle from public.posts where id = p_post_id;
  if v_owner is null then
    return false;
  end if;
  if auth.uid() is distinct from v_owner
     and (v_circle is null or not public.owns_circle(v_circle, auth.uid())) then
    return false;
  end if;
  update public.posts set answered = p_answered where id = p_post_id;
  return true;
end;
$$;
grant execute on function public.set_thread_answered(bigint, boolean) to authenticated;
