-- Rollback for 20260929000000_spaces_rework_phase5_notification_fixes.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores enforce_notification_insert to its pre-fix definition (without
-- 'space_event_cancelled' on the allowed-kinds list — the exact bug this
-- migration fixes) and cancel_event/execute_space_deletion to their
-- pre-truncation (20260928000000) bodies.
--
-- Not a recommendation: rolling this back reintroduces the live bug
-- (cancelling an event with RSVPs, or deleting a Space with upcoming
-- RSVP'd events, fails outright).

CREATE OR REPLACE FUNCTION public.enforce_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.actor_id := auth.uid();

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'circle_invite', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  return new;
end;
$function$;

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
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || v_event.title || '.',
    '/space/' || (select spaces.slug from spaces where spaces.id = v_event.space_id) || '?tab=events',
    v_actor_name
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
begin
  update spaces set status = 'deleted' where spaces.id = p_space_id;

  insert into notifications (user_id, kind, body, href, actor_name)
  select er.user_id, 'space_event_cancelled',
    se.title || ' was cancelled because its Space closed.', null, null
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
