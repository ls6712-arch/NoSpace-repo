-- Rollback for 20260927000000_spaces_rework_events.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores leave_space/remove_member/ban_member/execute_space_deletion to
-- their exact pre-Events bodies (Phase 3's 20260925000000 and Phase 4's
-- 20260926000000, respectively), drops every new function, then drops the
-- three new tables (event_private_details and event_rsvps first, since
-- space_events is their FK parent).
--
-- Not safe to run once any event/RSVP/address data exists that matters —
-- the table drops are not preceded by any export, unlike the Phase 2
-- cleanup migration did for Circles.

drop function if exists public.create_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, text);
drop function if exists public.update_event(bigint, text, text, timestamptz, timestamptz, text, text, text, text, text);
drop function if exists public.cancel_event(bigint);
drop function if exists public.feature_event(bigint);
drop function if exists public.unfeature_event(bigint);
drop function if exists public.rsvp_to_event(bigint);
drop function if exists public.cancel_rsvp(bigint);
drop function if exists public.list_event_teasers(uuid);

create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active_hosts int;
begin
  select role into v_role from space_members
  where space_id = p_space_id and user_id = auth.uid() and status = 'active';
  if v_role is null then
    raise exception 'You''re not a member of this Space.';
  end if;
  if v_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else before you leave.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = auth.uid();
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = auth.uid();
end;
$$;

create or replace function public.remove_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_active_hosts int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  select role into v_target_role from space_members
  where space_id = p_space_id and user_id = p_user_id and status = 'active';
  if v_target_role is null then
    raise exception 'That person isn''t an active member.';
  end if;
  if v_target_role = 'host' then
    select count(*) into v_active_hosts from space_members
    where space_id = p_space_id and role = 'host' and status = 'active';
    if v_active_hosts <= 1 then
      raise exception 'A Space needs at least one host — promote someone else first.';
    end if;
  end if;
  delete from space_members where space_id = p_space_id and user_id = p_user_id;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
end;
$$;

create or replace function public.ban_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = p_user_id and role = 'host') then
    raise exception 'Demote them as a host (demote_host) before banning them.';
  end if;
  update space_members set status = 'banned' where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t in this Space.';
  end if;
  delete from space_moments sm
  using posts p
  where sm.space_id = p_space_id and sm.post_id = p.id and p.user_id = p_user_id;
end;
$$;

create or replace function public.execute_space_deletion(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;
  delete from space_moments where space_moments.space_id = p_space_id;
  delete from space_private_details where space_private_details.space_id = p_space_id;
  delete from space_join_requests where space_join_requests.space_id = p_space_id;
  delete from space_host_invites
  where space_host_invites.space_id = p_space_id and space_host_invites.status = 'invited';
end;
$$;

drop table if exists public.event_private_details;
drop table if exists public.event_rsvps;
drop table if exists public.space_events;
