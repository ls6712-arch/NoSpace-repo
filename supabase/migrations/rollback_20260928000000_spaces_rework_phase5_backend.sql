-- Rollback for 20260928000000_spaces_rework_phase5_backend.sql.
--
-- Draft only — staged for review, not run.
--
-- Drops create_space/update_space/space_moment_count_30d, and restores
-- request_or_join_space/cancel_event/execute_space_deletion to their
-- exact pre-Phase-5 bodies (merged via PR #91).

drop function if exists public.create_space(text, text, text, text, text, text, text, text, bigint[], text, text, int, text);
drop function if exists public.update_space(uuid, text, text, text, text, text, text, text, text, text, int, text);
drop function if exists public.space_moment_count_30d(uuid);

create or replace function public.request_or_join_space(p_space_id uuid, p_join_answers jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space record;
  v_active_count int;
begin
  select * into v_space from spaces where id = p_space_id and status = 'active';
  if v_space.id is null then
    raise exception 'That Space doesn''t exist.';
  end if;

  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'banned') then
    raise exception 'You can''t join this Space.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'active') then
    raise exception 'You''re already a member.';
  end if;
  if exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and status = 'pending') then
    raise exception 'You already have a request pending.';
  end if;

  select count(*) into v_active_count from space_members where space_id = p_space_id and status = 'active';
  if v_space.member_cap is not null and v_active_count >= v_space.member_cap then
    raise exception 'This Space is full.';
  end if;

  if v_space.access = 'open' then
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'active');
    return 'active';
  else
    if jsonb_array_length(v_space.join_questions) > 0
       and (p_join_answers is null or jsonb_array_length(p_join_answers) = 0) then
      raise exception 'Answer the join questions to request to join.';
    end if;
    insert into space_members (space_id, user_id, role, status)
    values (p_space_id, auth.uid(), 'member', 'pending');
    insert into space_join_requests (space_id, user_id, answers)
    values (p_space_id, auth.uid(), p_join_answers);
    return 'pending';
  end if;
end;
$$;

create or replace function public.cancel_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_actor_name text;
begin
  select * into v_event from space_events where space_events.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn''t exist.';
  end if;
  if not (
    public.is_space_host(v_event.space_id, auth.uid())
    or (v_event.created_by = auth.uid() and public.is_space_member(v_event.space_id, auth.uid()))
  ) then
    raise exception 'Only a host or this event''s creator can cancel it.';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'This event is already cancelled.';
  end if;

  update space_events set status = 'cancelled', featured = false where space_events.id = p_event_id;

  select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
    into v_actor_name from profiles where profiles.id = auth.uid();

  insert into notifications (user_id, kind, body, href, actor_name)
  select event_rsvps.user_id, 'space_event_cancelled',
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || v_event.title || '.', null, v_actor_name
  from event_rsvps
  where event_rsvps.event_id = p_event_id;
end;
$$;

create or replace function public.execute_space_deletion(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;

  select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
    into v_actor_name from profiles where profiles.id = auth.uid();

  insert into notifications (user_id, kind, body, href, actor_name)
  select er.user_id, 'space_event_cancelled',
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || se.title || '.', null, v_actor_name
  from space_events se
  join event_rsvps er on er.event_id = se.id
  where se.space_id = p_space_id and se.status = 'scheduled' and se.starts_at > now();

  update space_events set status = 'cancelled', featured = false
  where space_events.space_id = p_space_id and space_events.status = 'scheduled' and space_events.starts_at > now();

  delete from space_moments where space_moments.space_id = p_space_id;
  delete from space_private_details where space_private_details.space_id = p_space_id;
  delete from space_join_requests where space_join_requests.space_id = p_space_id;
  delete from space_host_invites
  where space_host_invites.space_id = p_space_id and space_host_invites.status = 'invited';
  delete from event_private_details
  using space_events se
  where event_private_details.event_id = se.id and se.space_id = p_space_id;
end;
$$;
