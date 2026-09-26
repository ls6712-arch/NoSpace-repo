# Backend state, checked 2026-09-26 — Communication Phase 5

Project: `eyzokuhhbyidvmuqfmwm`. Covers
`supabase/migrations/20261007000000_communication_phase5_notifications.sql`.

**Unlike every prior phase's own backend-state note, this one describes a
migration that is staged but NOT yet applied live.** Sush approved the
fact-checks and the category mapping (with the "Make together and Explore
together" label rename) and asked for the branch to be pushed with Part A
committed so the migration, rollback, and verification script could be
reviewed before applying — specifically, so the reviewer could diff this
migration's copy of `enforce_notification_insert()`'s body against the
actual live `pg_get_functiondef('public.enforce_notification_insert'::regproc)`
output before running it, since the migration's `create or replace` would
silently revert any live drift the migration file doesn't know about. The
migration will be applied from outside this sandbox. Everything below
describes what the staged migration *will* do once applied, not something
already observed live.

## Fact-checks done before writing anything (read-only against live data)

1. **`connect_request`/`connect_accepted` are dead.** Grep across `src/`
   finds zero references to either kind, and `enforce_notification_insert`'s
   kind allowlist has never included them, going back to its first
   definition in `20260925020000_communication_phase1_safety.sql`. The 3 + 2
   live rows of these kinds predate that trigger (or whatever came before
   it). Today's actual follow-request/accept surface is entirely separate
   from `notifications`: `useIncomingFollowRequests` reads `profile_follows`
   live, and `NotificationsMenu.tsx` renders those alongside (never
   through) the notifications table. Consequence: the originally proposed
   "New followers and follow requests" mutable category has nothing to
   attach to — dropped from the category list. The 5 old orphaned rows are
   left untouched (no delete, no reclassification) — reporting, not
   touching, was the ask.
2. **`hobby_follow` rows are self-notes**, confirmed. `toggleHobbyFollow()`
   (`SocialContext.tsx`) calls `notify(user.id, "hobby_follow", ...)` — the
   recipient is the signed-in caller, and the trigger's own `new.actor_id
   := auth.uid()` makes the actor the same person regardless of what the
   client passes. Same shape as Phase 3's `message` kind: retired
   application-side (stopped creating them, hidden from the bell via
   `.neq("kind", "hobby_follow")`), no DB change — the kind stays in the
   allowlist below since nothing ever removes a kind once old rows might
   carry it.
3. **Thought notifications' target for grouping**: pure application fix.
   `addThought()` already has `postId` in scope; only the `notify()` call's
   href argument changes from `/you` to `` `/moment/${postId}` ``. The href
   check inside `enforce_notification_insert`
   (`^/[a-zA-Z0-9/_?=&-]*$`) already allows `/moment/123` — no DB change
   needed. Old rows keep their `/you` href, as instructed.
4. **Mark all read** already worked exactly as asked — `markAllRead()`
   already does `update notifications set read = true where user_id =
   auth.uid() and not read`, against the existing "you update your own"
   UPDATE policy. Nothing to change, DB or app.

## What the staged migration will change

1. New `private.notification_kind_muted(p_user uuid, p_kind text) returns
   boolean` — SECURITY DEFINER, `set search_path = public`. Looks up
   `p_user`'s `profile_settings.notification_preferences`; no row reads as
   "nothing muted" (today's default for a missing row everywhere else in
   this app). `circle_invite` checks the existing `circle_invites` boolean
   directly (`false` = muted) rather than the new array. Every other kind
   maps through a `case` to one of four category names (`thoughts`,
   `pursuit_activity`, `make_together_explore_together`,
   `message_requests`); anything not in that mapping (every `space_*` kind,
   `hobby_follow`, `message`) reads as never-muted. Deliberately reachable
   from nowhere but `enforce_notification_insert`: EXECUTE is revoked from
   `public`, `anon`, **and** `authenticated` — stricter than the existing
   `private.is_blocked_between`/`post_owner`/`participation_has_message`,
   which need the `authenticated` grant because they're also invoked from
   inside RLS policy expressions (i.e., as the invoking role); this helper
   is only ever called from inside the SECURITY DEFINER trigger below,
   which runs as its owner with implicit execute on everything it owns, so
   the grant is unnecessary and omitting it is stricter/safer. The
   `private` schema itself already isn't exposed via PostgREST at all (same
   fact Phase 3's own backend-state note recorded for
   `other_party_seen_at`) — the explicit revoke here is defense in depth on
   top of that, and it's what makes the "truly unreachable" property
   observable by a raw SQL script at all (calling it as an impersonated
   `authenticated` non-owner should raise `insufficient_privilege`, 42501).
2. `public.enforce_notification_insert()` redefined: reproduces the live
   body verbatim (kind allowlist, `actor_name` correction, href shape
   check, 300-char body cap, the Phase 1 blocked-between drop) and adds
   exactly one more check right before the final `return new;` — if the
   recipient has muted the category the incoming `kind` belongs to, `return
   null` instead, the same silent-drop shape the blocked-between check
   already uses. A client can't distinguish "muted" from "blocked" from
   "sent fine" any more than it already couldn't distinguish "blocked" from
   "sent fine."

Category → kind mapping the migration ships (see the migration's own header
for the full explanation, including a correction made after Sush's OK — see
below):

| Category | Kinds |
|---|---|
| `thoughts` | `thought` |
| `pursuit_activity` | `pursuit_joined`, `pursuit_progress`, `pursuit_invite` |
| `make_together_explore_together` | `make_together`, `explore_together`, `accepted`, `joined` |
| `message_requests` | `message_request` |
| *(not a `muted` category — existing boolean)* | `circle_invite` reads `circle_invites` |

Not mutable, by design: every `space_*` kind (including `space_invite`,
which matches the `space_` prefix despite its own naming), `hobby_follow`
(retiring, not muting), `message` (already dead since Phase 3). None of
these map to a category, so they read as never-muted unconditionally.

## Self-caught correction, before applying

The first draft of this migration's own fact-check claimed
`make_together`/`explore_together` are never inserted as notification rows.
That was wrong, caught while auditing every `notify()` call site in
`SocialContext.tsx` for Part B: `requestTogether()` calls
`notify(input.toUser, input.kind, ...)` with `input.kind` literally
`'make_together'`/`'explore_together'`, href `/you`, the moment someone
sends that ask — a real, live-inserted path. Both kinds were added to the
`make_together_explore_together` category's mapping above (the version
Sush approved the *label* for was missing these two). Flagged to Sush in
chat before continuing; nothing else approved changed.

## Verification (not yet run live)

`supabase/verification/communication_phase5_check.sql` — same
impersonation pattern as every prior phase's own script (one transaction,
`ROLLBACK` at the end, `set_config('request.jwt.claims', ...)` per step to
switch which real account `auth.uid()` resolves to), using three real
accounts. Asserts 17 named booleans in one `raise exception 'RESULTS: ...'`
line: muted categories drop the insert silently (no exception, no row);
unmuted ones still insert normally; `circle_invite` respects the existing
boolean, not the array; a kind with no category mapping (a `space_*` kind)
is never blocked by muting; the blocked-between rule from Phase 1 still
fires ahead of the new mute check; the SECURITY DEFINER path
(`notify_pursuit_membership` inserting a `pursuit_invite` via a
`pursuit_members` insert) still respects muting; a non-owner impersonated
`authenticated` role cannot call `private.notification_kind_muted` directly
(`insufficient_privilege`); other users' `profile_settings` rows remain
unreadable/unwritable by anyone but their own owner; both `make_together`
and `explore_together` are confirmed live, direct-insert kinds via the
corrected mapping.

**To be run after this migration is applied, before the PR merges**: apply
via `apply_migration`, run `communication_phase5_check.sql`'s asserts live,
run `get_advisors` (security and performance), and report results — same
sequence as every prior phase.
