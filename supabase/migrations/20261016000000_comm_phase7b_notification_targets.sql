-- Communication Phase 7B · notifications know what they are about.
--
-- Adds target_post_id / target_pursuit_id to notifications and fills them from
-- the href inside enforce_notification_insert(), so the app can show a
-- thumbnail or progress bar without parsing hrefs.
--
--   /moment/<id>  -> target_post_id     (thought, first_moment, love)
--   /pursuit/<id> -> target_pursuit_id  (pursuit_joined, pursuit_progress)
--   anything else -> no target. That includes space_moment_pending and
--   space_moment_approved: their href points at the Space, not the Moment
--   (deferred follow-up, see docs/communication-phase7-visual.md).
--
-- Only enforce_notification_insert() changes, and only by one block added right
-- before its final "return new;". The rest is the live definition verbatim
-- (fetched with pg_get_functiondef). The new block's existence checks run as
-- the function owner (SECURITY DEFINER): they can tell the trigger that an id
-- exists even if the actor cannot see it. Accepted as low risk; the id is in
-- the href the actor wrote, and only the recipient ever reads the target.
--
-- Rollback: rollback_20261016000000_comm_phase7b_notification_targets.sql
-- Verification: supabase/verification/comm_phase7b_notification_targets_check.sql

alter table public.notifications
  add column if not exists target_post_id bigint
    references public.posts(id) on delete set null,
  add column if not exists target_pursuit_id text
    references public.pursuits(id) on delete set null;

create index if not exists notifications_target_post_idx
  on public.notifications (target_post_id);
create index if not exists notifications_target_pursuit_idx
  on public.notifications (target_pursuit_id);

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
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love'
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

  if private.notification_kind_muted(new.user_id, new.kind) then
    return null;
  end if;

  -- 7B: work out what the notification is about from its href alone.
  -- Both targets start null, so anything the client sent is overwritten. A bad,
  -- overflowing or stale href leaves them null; it never fails the insert.
  new.target_post_id := null;
  new.target_pursuit_id := null;

  declare
    v_post_text text;
    v_post_id bigint;
    v_pursuit_id text;
  begin
    v_post_text := substring(new.href from '^/moment/(\d+)');
    if v_post_text is not null and char_length(v_post_text) <= 18 then
      v_post_id := v_post_text::bigint;
      if exists (select 1 from public.posts where public.posts.id = v_post_id) then
        new.target_post_id := v_post_id;
      end if;
    end if;

    v_pursuit_id := substring(new.href from '^/pursuit/([^/?]+)');
    if v_pursuit_id is not null
       and exists (select 1 from public.pursuits where public.pursuits.id = v_pursuit_id) then
      new.target_pursuit_id := v_pursuit_id;
    end if;
  end;

  return new;
end;
$function$;

-- Backfill existing rows with the same rule (only where the target exists).
update public.notifications
set target_post_id = (
  select public.posts.id from public.posts
  where public.posts.id = (
    case
      when char_length(substring(public.notifications.href from '^/moment/(\d+)')) <= 18
        then substring(public.notifications.href from '^/moment/(\d+)')::bigint
    end
  )
)
where public.notifications.href ~ '^/moment/\d+';

update public.notifications
set target_pursuit_id = (
  select public.pursuits.id from public.pursuits
  where public.pursuits.id = substring(public.notifications.href from '^/pursuit/([^/?]+)')
)
where public.notifications.href ~ '^/pursuit/[^/?]+';
