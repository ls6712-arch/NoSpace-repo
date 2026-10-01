-- Step 2 follow-up: a pending account (no claimed invite yet) can't join a
-- Pursuit through a Pursuit invite link.
--
-- Root.tsx already sends every pending account to /welcome, but that is the
-- app layer only. join_pursuit_via_link() is security definer, so without
-- this check a pending account calling the RPC directly would become a
-- Pursuit member — the gap listed under "Follow-ups" in the Step 2 brief.
--
-- Body is 20260923120000_pursuit_invite_links_and_notifications.sql's,
-- unchanged except for the one new check after the sign-in check. Same
-- wording and errcode as create_invite's own pending check (Step 2
-- migration), so the app shows one message for one idea.
--
-- Before applying, confirm the live body still matches the 20260923 file
-- (see the PR description for the read-only query). If it doesn't, stop:
-- this create-or-replace would overwrite whatever changed live.

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
  if not private.is_active(auth.uid()) then
    raise exception 'Your account isn''t active yet.' using errcode = '42501';
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
