-- Rollback for 20261011000000_pending_cannot_join_pursuit_link.sql.
--
-- Restores join_pursuit_via_link() to its 20260923120000 body: the same
-- function minus the pending-account check.

create or replace function public.join_pursuit_via_link(invite_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text;
  owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join.';
  end if;
  select l.pursuit_id, p.user_id into pid, owner
  from pursuit_invite_links l
  join pursuits p on p.id = l.pursuit_id
  where l.token = invite_token and l.revoked_at is null;
  if pid is null then
    raise exception 'This invite link is no longer active.';
  end if;
  if owner = auth.uid() then
    return pid;
  end if;
  insert into pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (pid, owner, 'owner', 'joined', owner)
    on conflict (pursuit_id, user_id) do nothing;
  insert into pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (pid, auth.uid(), 'member', 'joined', owner)
    on conflict (pursuit_id, user_id) do update set status = 'joined';
  update pursuits set mode = 'together' where id = pid and mode = 'solo';
  return pid;
end;
$$;
revoke all on function public.join_pursuit_via_link(text) from public;
grant execute on function public.join_pursuit_via_link(text) to authenticated;
