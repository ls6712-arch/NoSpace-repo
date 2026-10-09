-- Save notification: "3 people want to try “sourdough with rye starter”."
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261021000000_hide_follow_requests.sql.
--   Rollback: rollback_20261022000000_save_notification.sql
--   Verification: supabase/verification/save_notification_check.sql
--
-- What this does
--   When someone saves a Moment (a new row in public.bookmarks), its author
--   gets ONE notification per Moment per 24 hours. A later save inside that
--   window updates the same row (the count goes up) and marks it unread again.
--   The notification says how many people, never who: no name, no actor_id.
--   public.bookmarks stays owner-only (its policy is unchanged), so a save is
--   still private to the person who made it.
--
-- Wording (docs/glossary.md, Home, reactions, connection)
--   1 save:     Someone wants to try “[caption]”.
--   N saves:    N people want to try “[caption]”.
--   Caption:    first line only, cut at 40 characters with an ellipsis inside
--               the quotes. Empty caption: your Moment, in place of the quoted
--               caption ("3 people want to try your Moment.").
--   Built by public.save_notification_body(count, caption).
--
-- Rules
--   - Saving your own Moment notifies nobody.
--   - Only saves made after this runs notify: the trigger fires on INSERT into
--     bookmarks, and nothing here reads or counts older rows. No backfill.
--     (Saves have only ever been kept on the phone, so bookmarks is empty
--     today; the app starts writing it in the same release.)
--   - A person you have blocked, or who blocked you, is not counted.
--   - The new 'saves' category is on the mute list: private.notification_kind_muted
--     maps kind 'save' to it, and the Notifications settings page gets a switch.
--   - Opening the notification opens the Moment (href /moment/<id>).
--   - The trigger can never block the save: a failure raises a warning only.
--   - Unsaving does not lower a count that was already sent.
--
-- enforce_notification_insert is the live definition verbatim (checked with
-- pg_get_functiondef; matches 20261016000000) with three changes:
--   a. 'save' is on the allowed list, but ONLY for notify_save(): it sets a
--      transaction-local flag, and any other insert of kind 'save' is refused.
--      Without that, any logged-in client could insert anonymous 'save'
--      notifications for other people (the app inserts notifications from the
--      client for other kinds).
--   b. For kind 'save', actor_id and actor_name stay null. Every other kind
--      still gets actor_id := auth.uid(); for a save that would be the saver.
--   c. Nothing else changes: link check, 300-character cap, mute check, targets.
--
-- private.notification_kind_muted is the live definition verbatim plus
-- `when 'save' then 'saves'`.
--
-- Every column inside every subquery is fully qualified.
-- Safe to re-run: create-or-replace and drop-trigger-if-exists throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. The wording, in one place. Pure, so it can be checked on its own.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.save_notification_body(p_count int, p_caption text)
returns text
language sql
immutable
set search_path = public
as $$
  select
    case when p_count <= 1 then 'Someone wants' else to_char(p_count, 'FM999,999,999') || ' people want' end
    || ' to try '
    || case
         when first_line.text is null then 'your Moment'
         when char_length(first_line.text) > 40 then '“' || rtrim(left(first_line.text, 40)) || '…”'
         else '“' || first_line.text || '”'
       end
    || '.'
  from (
    select nullif(btrim(split_part(replace(coalesce(p_caption, ''), E'\r', ''), E'\n', 1)), '') as text
  ) as first_line;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. enforce_notification_insert — live definition, plus 'save' (see above).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.kind = 'save' then
    -- Only notify_save() may write one, and it never names the saver.
    if coalesce(current_setting('soosh.save_notice', true), '') <> 'on' then
      raise exception 'Not a recognized notification kind: %', new.kind;
    end if;
    new.actor_id := null;
    new.actor_name := null;
  else
    new.actor_id := auth.uid();
  end if;

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love', 'save'
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The mute list: kind 'save' belongs to the 'saves' category.
-- ─────────────────────────────────────────────────────────────────────────
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
    when 'save' then 'saves'
    else null
  end;

  if v_category is null then
    return false;
  end if;

  return coalesce(v_prefs->'muted', '[]'::jsonb) ? v_category;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. save — after insert on bookmarks, one row per Moment per 24 hours.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_caption text;
  v_href text;
  v_existing_id bigint;
  v_since timestamptz;
  v_count int;
begin
  select posts.user_id, posts.caption
    into v_owner, v_caption
  from posts
  where posts.id = new.post_id;

  -- Your own Moment, or one that no longer exists: nobody to tell.
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  begin
    -- Blocked in either direction: this save is not counted or announced.
    if private.is_blocked_between(new.user_id, v_owner) then
      return new;
    end if;

    -- The update path below skips enforce_notification_insert, so the mute
    -- switch is checked here for both paths.
    if private.notification_kind_muted(v_owner, 'save') then
      return new;
    end if;

    v_href := '/moment/' || new.post_id;

    select notifications.id, notifications.created_at
      into v_existing_id, v_since
    from notifications
    where notifications.user_id = v_owner
      and notifications.kind = 'save'
      and notifications.href = v_href
      and notifications.created_at > now() - interval '24 hours'
    order by notifications.created_at desc
    limit 1;

    if v_existing_id is null then
      perform set_config('soosh.save_notice', 'on', true);
      insert into notifications (user_id, kind, body, href)
      values (v_owner, 'save', public.save_notification_body(1, v_caption), v_href);
      perform set_config('soosh.save_notice', '', true);
    else
      -- Everyone who saved inside this window, you excluded, blocks excluded.
      select count(*) into v_count
      from bookmarks
      where bookmarks.post_id = new.post_id
        and bookmarks.created_at >= v_since
        and bookmarks.user_id <> v_owner
        and not private.is_blocked_between(bookmarks.user_id, v_owner);

      update notifications
      set body = public.save_notification_body(greatest(v_count, 1), v_caption),
          read = false
      where notifications.id = v_existing_id;
    end if;
  exception when others then
    perform set_config('soosh.save_notice', '', true);
    raise warning 'notify_save skipped: % %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function public.notify_save() from public, anon, authenticated;

drop trigger if exists bookmarks_notify_save on public.bookmarks;
create trigger bookmarks_notify_save
  after insert on public.bookmarks
  for each row execute function public.notify_save();
