-- Sushii: Spaces Rework — notify hosts when a Moment needs their
-- approval, and the author once it gets it.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261007000000_communication_phase5_notifications.sql.
--
-- Both new kinds are trigger-driven on space_moments itself, not embedded
-- in an RPC (the pattern every other Spaces notification uses, e.g.
-- request_or_join_space) — because unlike those, the row that needs to
-- trigger the first one is created by a plain client-side
-- `.insert()` (AddMomentToSpaceDialog.tsx, Log.tsx), not through an RPC
-- of its own. set_space_moment_status() (20260925010000, before insert)
-- already decides pending vs approved before this trigger (after insert
-- or update) ever sees the row, so it just reads new.status as the
-- settled value:
--
--   space_moment_pending  (after insert, status = 'pending') — every
--     active host except the author (host Moments auto-approve — see
--     20261005000000 — so this exclusion should never actually matter in
--     practice, but nothing stops a future change from making it
--     possible, and it costs nothing to guard against here), "[Name]
--     shared a Moment in [Space] for approval.", /space/<slug>?tab=manage.
--   space_moment_approved (after update, pending -> approved) — the
--     author, "Your Moment is now on the table in [Space]." No
--     actor_name, same as space_join_approved's own "You're in [Space]."
--     — an impersonal announcement, not attributed to whichever host
--     happened to click Approve.
--
-- enforce_notification_insert gets both kinds added to its allowed-kinds
-- list — reproduced verbatim from 20261007000000 (the latest live
-- definition, Phase 5's per-kind muting included) plus this addition,
-- same discipline as every earlier notification-adding migration.
--
-- Every column inside every subquery is fully qualified throughout, same
-- discipline as every migration since the Phase 3 lesson.
--
-- Safe to re-run: create-or-replace / drop-trigger-if-exists throughout.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. enforce_notification_insert — verbatim from 20261007000000, plus the
--    two new kinds on the allowed list.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_id := auth.uid();

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'circle_invite', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved'
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

  -- New in Phase 5: the recipient's own choice to mute this kind's
  -- category. Checked last, after every existing rule still holds — a
  -- muted notification is dropped exactly the same way a blocked-between
  -- one already is (silently, `return null`, not an error), so a caller
  -- can't tell "muted" apart from "sent fine" any more than they can tell
  -- "blocked" apart from it today.
  if private.notification_kind_muted(new.user_id, new.kind) then
    return null;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. notify_space_moment_status — the new trigger function.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_author_name text;
  v_space_name text;
  v_space_slug text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select posts.user_id into v_author_id from posts where posts.id = new.post_id;
    select coalesce(nullif(trim(profiles.display_name), ''), profiles.username, 'Someone')
      into v_author_name from profiles where profiles.id = v_author_id;
    select spaces.name, spaces.slug into v_space_name, v_space_slug
      from spaces where spaces.id = new.space_id;

    insert into notifications (user_id, kind, body, href, actor_name)
    select space_members.user_id, 'space_moment_pending',
      left(coalesce(v_author_name, 'Someone'), 60) || ' shared a Moment in ' || left(v_space_name, 150) || ' for approval.',
      '/space/' || v_space_slug || '?tab=manage',
      v_author_name
    from space_members
    where space_members.space_id = new.space_id
      and space_members.role = 'host'
      and space_members.status = 'active'
      and space_members.user_id <> v_author_id;

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    select posts.user_id into v_author_id from posts where posts.id = new.post_id;
    select spaces.name, spaces.slug into v_space_name, v_space_slug
      from spaces where spaces.id = new.space_id;

    insert into notifications (user_id, kind, body, href)
    values (
      v_author_id, 'space_moment_approved',
      'Your Moment is now on the table in ' || left(v_space_name, 150) || '.',
      '/space/' || v_space_slug
    );
  end if;
  return new;
end;
$$;

drop trigger if exists space_moments_notify on public.space_moments;
create trigger space_moments_notify
  after insert or update on public.space_moments
  for each row execute function public.notify_space_moment_status();
