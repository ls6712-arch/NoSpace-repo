-- Sushii: Spaces Rework Phase 5 — notification fixes, syncing the repo
-- with two things already fixed live.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260928000000_spaces_rework_phase5_backend.sql, which has
--   already run against production.
--
-- 1. enforce_notification_insert() rejected the 'space_event_cancelled'
--    kind, so cancel_event and execute_space_deletion failed outright
--    whenever RSVPs existed (their own inserts into notifications never
--    got past this trigger). Already fixed live by adding
--    'space_event_cancelled' to the allowed-kinds list — the function
--    below is that live fix, verbatim, not reconstructed from this
--    repo's own migration history (enforce_notification_insert was never
--    in it to begin with; it predates this rework).
--
-- 2. cancel_event / execute_space_deletion (redefined again): both
--    truncate the embedded event title to 200 chars before building the
--    notification body. space_events.title has no length limit of its
--    own, and enforce_notification_insert (above) rejects any body over
--    300 chars — a long enough title made the notification insert fail,
--    which is how its missing allowed-kind was actually discovered live
--    in the first place (a title short enough to fit was masking it,
--    until one wasn't).
--
-- Safe to re-run: functions are create-or-replace throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. enforce_notification_insert — verbatim live definition. The only
--    change from what predates this rework is 'space_event_cancelled' on
--    the allowed-kinds list.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Who actually ran this INSERT — never whatever the client sent.
  new.actor_id := auth.uid();

  -- Every kind any current code path inserts: the six from notify()'s own
  -- call sites in SocialContext.tsx (hobby_follow, joined, make_together,
  -- explore_together, thought, message), "accepted" from respond(),
  -- "circle_invite" from ConnectionsContext.tsx, "message_request" for
  -- Part B's pending-DM notice, "space_invite" (on the app's intended list,
  -- sql/security-hardening.sql section 4, though nothing inserts it live
  -- today), the three from the pursuit triggers this table trigger
  -- also has to let through: pursuit_invite, pursuit_joined,
  -- pursuit_progress, and space_event_cancelled from cancel_event /
  -- execute_space_deletion (Spaces rework, Events).
  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'circle_invite', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  -- actor_name: never trust the client's claim about who they are.
  -- 'Someone'/'You' are explicit allowed placeholders (ConnectionsContext's
  -- own fallback is 'Someone'); anything else must be the actor's own
  -- current name — corrected to that, not rejected, since that's also
  -- exactly what a legitimate caller using the fallback formula
  -- (no display_name, but a username) would otherwise trip on.
  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  -- In-app path only: sql/security-hardening.sql section 4's own pattern,
  -- plus an explicit not-protocol-relative check kept alongside it (see
  -- this section's header comment for why both).
  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  -- Silently dropped, not rejected with an error — see this section's
  -- header comment for why. Self-notification is deliberately left alone:
  -- hobby_follow's "You're exploring X" is a real note-to-self the app
  -- relies on, and is_blocked_between(x, x) is false anyway (no self-block
  -- can exist), so this never touches that case.
  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. cancel_event / execute_space_deletion — full bodies reproduced from
--    20260928000000; only the two left(title, 200) calls are new.
-- ─────────────────────────────────────────────────────────────────────────
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
    coalesce(v_actor_name, 'Someone') || ' cancelled ' || left(v_event.title, 200) || '.',
    '/space/' || (select spaces.slug from spaces where spaces.id = v_event.space_id) || '?tab=events',
    v_actor_name
  from event_rsvps
  where event_rsvps.event_id = p_event_id;
end;
$$;
revoke all on function public.cancel_event(bigint) from public, anon;
grant execute on function public.cancel_event(bigint) to authenticated;

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
    left(se.title, 200) || ' was cancelled because its Space closed.', null, null
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
revoke all on function public.execute_space_deletion(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- Run supabase/verification/phase5_notification_fixes_check.sql.
