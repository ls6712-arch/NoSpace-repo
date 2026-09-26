-- Communication Phase 5: Notification center — mute, enforced at insert
-- (staged, NOT applied until Sush's explicit OK — see
-- docs/communication-strategy.md's Phase 5 section).
--
-- SOURCE FOR enforce_notification_insert()'s body below: copied verbatim
-- from supabase/migrations/20261001000000_spaces_rework_join_notifications.sql
-- (lines 64-108 in that file, section "1. enforce_notification_insert —
-- verbatim from 20260929000000, plus the four new kinds on the allowed
-- list") — that migration's own header confirms IT reproduced the then-live
-- definition verbatim from 20260929000000_spaces_rework_phase5_notification_
-- fixes.sql, so 20261001000000 is the most recent migration file that
-- redefines this function and should match today's live definition exactly.
-- Before applying this migration, diff this file's copy (everything between
-- `begin` and the new "New in Phase 5" block near the end) against the
-- ACTUAL live `pg_get_functiondef('public.enforce_notification_insert'::regproc)`
-- output — if anything live has drifted from 20261001000000 (a hotfix
-- applied directly, not through a committed migration file), this
-- `create or replace` would silently revert it. Only the one new
-- `if private.notification_kind_muted(...)` block right before the final
-- `return new;` is actually new; everything above it is meant to be a
-- byte-for-byte copy.
--
-- Everything else Phase 5 asks for (grouping, Mark all read, the thought
-- href fix, retiring hobby_follow) needs NO database change at all — see
-- this migration's own header notes below and the PR description. This
-- file is deliberately narrow: one new private helper, and
-- enforce_notification_insert() gains exactly one more check.
--
-- ── Fact-checks (read before this migration; they shaped what's below) ──
--
-- 1. connect_request / connect_accepted are NOT created by any code path
--    today, and never have been — grep across src/ finds zero references,
--    and enforce_notification_insert's kind allowlist has never included
--    them, going all the way back to its very first definition in
--    20260925020000 (communication_phase1_safety). The 3 + 2 live rows of
--    these kinds predate that trigger entirely (or predate whatever came
--    before it) — inserting either kind today would hit the trigger's
--    "Not a recognized notification kind" exception. Today's actual follow
--    request/accept surface is entirely separate from `notifications`:
--    `useIncomingFollowRequests`/`fetchIncomingFollowRequests` reads
--    `profile_follows` live, and NotificationsMenu.tsx renders those
--    alongside (never through) the notifications table. So the proposed
--    "New followers and follow requests" mutable category has nothing to
--    attach to — there is no kind to mute, and muting couldn't reach the
--    profile_follows-backed UI even if there were, the same structural gap
--    Message requests' own live `incoming` (pending make_together/
--    explore_together asks) has. **Dropped from the category list below;
--    left for Sush to decide** — either a follow-up notification kind
--    that actually gets created (then this becomes mutable the normal
--    way), or leave it alone. The 5 old orphaned rows are untouched by
--    this migration (no delete, no reclassification) — Sush said report,
--    not touch.
--
-- 2. hobby_follow rows are exactly what they look like: a note to
--    yourself about your own action. `toggleHobbyFollow()` (SocialContext.
--    tsx) calls `notify(user.id, "hobby_follow", ...)` — the recipient IS
--    the signed-in caller, and the trigger's own `new.actor_id :=
--    auth.uid()` makes the actor the same person regardless of what the
--    client passes. Same shape as Phase 3's own `message` kind: stop
--    creating them, hide old ones from the bell — both purely
--    application-side (a deleted notify() call plus a
--    `.neq("kind", "hobby_follow")` alongside the existing `.neq("kind",
--    "message")`), no DB change, same as Phase 3 made no DB change for
--    `message` either (kind stays in the allowlist below — nothing calls
--    it, same as `message`).
--
-- 3. "Target for grouping" (thought → /moment/<id> instead of /you): pure
--    application fix (SocialContext.tsx's addThought already has `postId`
--    in scope; only the notify() call's href argument changes). The href
--    check inside enforce_notification_insert
--    (`^/[a-zA-Z0-9/_?=&-]*$`) already allows `/moment/123` — no DB change
--    needed. Old rows keep their /you href, as instructed (never rewrite
--    them).
--
-- 4. Mark all read: already works exactly as asked. `markAllRead()`
--    (SocialContext.tsx) already does
--    `update notifications set read = true where user_id = auth.uid() and
--    not read`, against the existing "you update your own" UPDATE policy.
--    Nothing to change here at all, DB or app.
--
-- ── Category → kind mapping (adjusted from the proposal to what the code
--    actually creates; see the fact-check above for what got dropped) ──
--
--   thoughts                     -> thought
--   pursuit_activity             -> pursuit_joined, pursuit_progress, pursuit_invite
--   make_together_explore_together -> accepted, joined
--     (Label kept as "Make together and Explore together" per Sush's call
--     — but the kinds it actually gates are NOT make_together/
--     explore_together themselves: those are never inserted as
--     notification rows at all; the initial ask is shown live from
--     `participations` directly in NotificationsMenu.tsx, the same
--     structural gap as fact-check 1 above. Only the ACCEPTANCE
--     (kind='accepted') and an instant join (kind='joined', the join_in
--     feature — joining an activity Moment, unrelated to Pursuits) are
--     real rows this switch can actually mute. Worth Sush knowing: the
--     switch's name promises slightly more than it delivers today.)
--   message_requests      -> message_request
--     (muting only stops the bell entry — the request itself still shows
--     in Messages -> Message requests, same distinction the instructions
--     already called out.)
--
-- Circle invitations reuse the EXISTING `circle_invites` boolean already
-- in `notification_preferences` (shipped in 20260919230000, defaulted
-- true, never read anywhere in the app until now) rather than adding a
-- second switch for the same thing — kind 'circle_invite' checks that key
-- directly, not the new `muted` array below.
--
-- Not mutable, by design: every `space_*` kind (space_invite included —
-- it matches the `space_` prefix despite the missing underscore-before-
-- suffix reading; it's the Spaces host-invite notification, untouched),
-- `hobby_follow` (retiring, not muting), `message` (already dead since
-- Phase 3, kept in the allowlist only because nothing ever removes a kind
-- once it might exist in old rows). None of these map to a category
-- below, so they read as "not muted" unconditionally — this is an
-- opt-in allowlist of what CAN be muted, not a general filter anyone
-- could point at a new kind and expect to work.
--
-- Safe to re-run: create-or-replace throughout.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. private.notification_kind_muted(p_user, p_kind): whether p_user has
--    muted the bell category p_kind belongs to.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Deliberately reachable from nowhere but enforce_notification_insert
-- below: execute is revoked from public, anon, AND authenticated (unlike
-- private.is_blocked_between/post_owner/participation_has_message, which
-- also run inside RLS policy expressions — i.e. as the invoking
-- `authenticated` role — and so need that grant; this helper is only ever
-- called from inside a SECURITY DEFINER trigger already running as its
-- owner, which has implicit execute on everything it owns). The `private`
-- schema itself isn't exposed through PostgREST at all (same fact Phase
-- 3's own backend-state note recorded for other_party_seen_at) — the
-- explicit revoke-from-authenticated here is defense in depth on top of
-- that, not instead of it, and is what this migration's own verification
-- script actually exercises (a raw SQL-level permission check, since
-- "not exposed via PostgREST" isn't something a SQL script can observe
-- directly).
create or replace function private.notification_kind_muted(p_user uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_category text;
begin
  select notification_preferences into v_prefs
  from public.profile_settings
  where user_id = p_user;

  -- No settings row at all (only 1 exists live today) reads as "nothing
  -- muted" — same default every other profile_settings-backed switch in
  -- this app uses for a missing row.
  if v_prefs is null then
    return false;
  end if;

  -- Circle invitations: the existing boolean, not the new array.
  if p_kind = 'circle_invite' then
    return coalesce((v_prefs->>'circle_invites')::boolean, true) = false;
  end if;

  v_category := case p_kind
    when 'thought' then 'thoughts'
    when 'pursuit_joined' then 'pursuit_activity'
    when 'pursuit_progress' then 'pursuit_activity'
    when 'pursuit_invite' then 'pursuit_activity'
    when 'accepted' then 'make_together_explore_together'
    when 'joined' then 'make_together_explore_together'
    when 'message_request' then 'message_requests'
    else null
  end;

  -- Not a mutable kind (every space_* kind, hobby_follow, message, and
  -- anything else not listed above) — never muted through this path.
  if v_category is null then
    return false;
  end if;

  return coalesce(v_prefs->'muted', '[]'::jsonb) ? v_category;
end;
$$;

revoke execute on function private.notification_kind_muted(uuid, text) from public;
revoke execute on function private.notification_kind_muted(uuid, text) from anon;
revoke execute on function private.notification_kind_muted(uuid, text) from authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. enforce_notification_insert — reproduced verbatim from 20261001000000
--    (the live definition), plus one more check at the very end, right
--    before the final `return new`. Every existing check (kind allowlist,
--    actor_name correction, href shape, body length, the Phase 1 block
--    rule) is untouched.
-- ═══════════════════════════════════════════════════════════════════════
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
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite'
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
