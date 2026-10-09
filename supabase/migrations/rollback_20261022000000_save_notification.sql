-- Rollback for 20261022000000_save_notification.sql.
--
-- Restores enforce_notification_insert() and private.notification_kind_muted()
-- to their exact live definitions from before the save notification, drops the
-- trigger and the two functions it added, and deletes the 'save' notifications
-- that were sent (the app would otherwise keep showing them, and after this
-- rollback nothing recognizes the kind). public.bookmarks keeps its rows (only the
-- source column is dropped). Safe to re-run.

drop trigger if exists bookmarks_notify_save on public.bookmarks;
drop function if exists public.notify_save();
drop function if exists public.save_notification_body(int, text);

delete from public.notifications where public.notifications.kind = 'save';

-- The source column goes after the trigger function that reads it. Any rows
-- stay; only where they came from is forgotten.
alter table public.bookmarks drop column if exists source;

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


CREATE OR REPLACE FUNCTION private.notification_kind_muted(p_user uuid, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prefs jsonb;
  v_category text;
begin
  select notification_preferences into v_prefs
  from public.profile_settings
  where user_id = p_user;

  if v_prefs is null then
    return false;
  end if;

  if p_kind = 'circle_invite' then
    return (v_prefs->'circle_invites') = 'false'::jsonb;
  end if;

  v_category := case p_kind
    when 'thought' then 'thoughts'
    when 'pursuit_joined' then 'pursuit_activity'
    when 'pursuit_progress' then 'pursuit_activity'
    when 'pursuit_invite' then 'pursuit_activity'
    when 'make_together' then 'make_together_explore_together'
    when 'explore_together' then 'make_together_explore_together'
    when 'accepted' then 'make_together_explore_together'
    when 'joined' then 'make_together_explore_together'
    when 'message_request' then 'message_requests'
    else null
  end;

  if v_category is null then
    return false;
  end if;

  return coalesce(v_prefs->'muted', '[]'::jsonb) ? v_category;
end;
$function$;

