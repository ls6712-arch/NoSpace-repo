# Sushii communication strategy

How people reach each other on Sushii, in phases. This document is the plan;
each phase's own PR says what actually shipped.

> **Note on this copy.** The task that kicked off Phase 1 said this file was
> attached alongside the prompt and should be copied into the repo verbatim.
> No attachment actually reached this session — only the prompt's own
> restatement of the plan did. This file is that restatement, reorganized as
> a standing doc. If a fuller source document exists, it should replace this
> one; nothing below should be treated as more authoritative than that
> original.

## Phase 1 — Safety: block, report, message requests

**Status:** in progress. Database migration
(`supabase/migrations/20260925020000_communication_phase1_safety.sql`)
drafted and staged for review — **not yet applied** to the live database.
App code not yet written. See `docs/backend-state-<date>.md` for the
migration's applied/verification status once it lands, and the line at the
bottom of this section once Phase 1 ships.

### Decisions

1. **Message requests.** A first direct message from someone the recipient
   doesn't follow waits in a Message requests tab in Messages, to accept or
   ignore. "Known" = the recipient follows the sender (a `profile_follows`
   row with `follower_id = recipient`, `followed_id = sender`,
   `status = 'accepted'`). Known senders go straight to the inbox. Make
   together / Explore together threads keep working exactly as today —
   accepting that request is already consent.
2. **Messages and follow requests stay separate.** Follow requests and
   Circle invitations stay in Inbox → Requests and the bell, unchanged.
   Message requests live only in Messages. Accepting a message request
   never creates a follow, and accepting a follow never opens a
   conversation. Never name the new tab just "Requests."
3. **Full block.** The blocked person can't message you, send you any
   request, follow you, react to or leave Thoughts on your Moments, and
   doesn't see your profile or Moments. You stop seeing theirs too.
   Blocking removes existing follows in both directions. They aren't told.
   Unblock anytime from Settings (follows are not restored on unblock).
4. **Reports** go to a Reports list in the admin pages. Reporting a person,
   message, Moment or Thought also offers to block the person.

### Facts about the live database (verified 2026-09-24, re-verified live
before writing the Phase 1 migration)

* `participations` (`id, kind, from_user, to_user, post_id, hobby_key,
  intent, note, status, created_at, responded_at`). `kind` ∈ `join_in |
  make_together | explore_together | direct_message`. `status` ∈ `pending |
  accepted | declined`. Trigger: `rl_participations_insert`.
* Before Phase 1, `startDirectMessage` inserted a `direct_message` with
  `status: 'accepted'` straight from the client. The server decides the
  status instead now (see Part A).
* Hole closed by Phase 1: the `"the recipient answers"` UPDATE policy used
  to let `from_user` OR `to_user` update a participation, so a sender could
  mark their own request accepted.
* `messages` (`id, participation_id, from_user, body, created_at,
  to_user`). Policies: insert and select only inside an accepted
  participation of kind `make_together`/`explore_together`/
  `direct_message` — Phase 1 additionally allows a pending
  `direct_message`'s first message through, per the Decisions above. Rate
  limit trigger `rl_messages_insert` = 60 per 10 minutes (kept).
* `profile_follows` (`follower_id, followed_id, status pending|accepted,
  created_at, responded_at`).
* Admin check: `private.is_admin(uuid)`. Every admin-only policy below
  calls it the same way existing admin policies do.
* `public.write_blocked()` means "account paused" — unrelated to user
  blocking. The new helper is named differently: `public.
  is_blocked_between(a uuid, b uuid)`.
* Existing data at the time this was written: 10 people, 1 `direct_message`
  thread (accepted), 5 messages. Existing accepted threads stay accepted —
  the migration does not touch their status.

### Part A — database

`supabase/migrations/20260925020000_communication_phase1_safety.sql` plus
`rollback_20260925020000_communication_phase1_safety.sql`. In plain
language:

1. A `blocks` table (`blocker_id, blocked_id, created_at`; primary key on
   the pair; no self-blocks). RLS: you insert/delete/select only rows where
   you're the blocker. The blocked person can never read who blocked them.
2. `is_blocked_between(a, b)`: `SECURITY DEFINER`, `STABLE`, pinned
   `search_path`, true if either has blocked the other. EXECUTE revoked
   from anon, granted only to `authenticated` — the SELECT policies that
   need to work for anon (profiles, posts, thoughts) reach it indirectly
   through `is_visible_profile()`, which stays broadly granted and calls it
   internally as its own (`SECURITY DEFINER`) owner, not the connecting
   role.
3. Blocking (an insert into `blocks`) deletes any `profile_follows` rows
   between the two people, both directions.
4. The block is enforced in the database, both directions: on `messages`,
   `participations` (any kind with a `to_user`), `profile_follows`,
   `reactions` and `thoughts` inserts; and on `posts`, `profiles` and
   `thoughts` reads (via `is_visible_profile()`, which every one of those
   SELECT policies already goes through — so `hobby_follows`, `post_likes`
   and `profile_links` reads get the same treatment for free, not just the
   three explicitly named). Your own rows always stay visible to you.
5. Message requests:
   * A `BEFORE INSERT` trigger on `participations` for kind
     `direct_message` ignores whatever status the client asked for and
     decides: `accepted` if the recipient already follows the sender
     (accepted follow), `pending` otherwise. Rejects if blocked-between.
     Rejects a new `direct_message` if one already exists between the pair
     in either direction, in any status — the app must reuse it.
   * The update hole is closed twice over: the RLS policy now only lets
     `to_user` attempt an update at all, and a trigger separately enforces
     that only `pending → accepted`, `pending → declined` and
     `declined → accepted` are real changes, sets `responded_at`, and pins
     every other column so nothing about who a participation is between
     can be rewritten after the fact.
   * `messages` insert: today's accepted-thread rule, unchanged, plus
     exactly one message from the sender into a pending `direct_message`.
     The recipient can't send until they accept.
   * `messages` select: both parties can read a pending thread (the
     recipient needs to preview it). In a declined thread, only the sender
     still sees their own message.
6. A `reports` table (`id, reporter_id, target_user_id, target_kind` ∈
   `profile | message | moment | thought`, `target_id` — null only for
   `profile` — `reason` ∈ `spam | harassment | inappropriate | other`,
   `note`, `status` ∈ `open | reviewed | dismissed`, `created_at,
   reviewed_by, reviewed_at`). RLS: insert only as yourself; reporters see
   their own reports; admins (`private.is_admin`) read and update all.
   `reviewed_by`/`reviewed_at` are set by a trigger, not trusted from the
   client. Rate limit: 20 per hour, via the existing
   `enforce_rate_limit()` pattern.
7. Every new function pins `search_path` and has no EXECUTE for anon
   unless a currently-anon-reachable read needs it internally.

`supabase/verification/communication_phase1_check.sql` proves all of the
above, entirely inside a transaction that ends in `ROLLBACK`, impersonating
three real accounts (`A`, `B`, `C`) via `set_config('role', 'authenticated',
...)` and `set_config('request.jwt.claims', ...)`.

### Part B — the app

Written to degrade quietly if `blocks`/`reports` don't exist yet (pre-
migration), never to crash or blank a page.

1. **SocialContext**: `startDirectMessage` stops sending a status and
   reuses any existing thread with the person, of any status; a
   blocked-between rejection surfaces as the same generic "can't message
   this person" wording as any other failure, never revealing a block
   exists. `refresh` also loads pending `direct_message` threads. New
   surface: `messageRequests`, `myPendingRequests`, `acceptRequest`,
   `ignoreRequest`, `block`, `unblock`, `blockedIds`, `report`.
   `sendMessage` notifies the recipient once, on the first message into a
   pending thread, with a new `message_request` notification kind.
2. **Messages page**: two tabs, Chats and Message requests. A request shows
   sender, message, and Accept / Ignore / Block / Report. The sender sees
   "Waiting for `<name>` to accept" with the composer disabled.
3. **Block and Report entry points**: a "…" menu on public profiles and in
   a conversation header. Report opens a dialog (reason, optional note, an
   "Also block" checkbox) and is also reachable from a Moment and from each
   Thought that isn't your own.
4. **Settings**: a "Blocked people" section, with Unblock.
5. **Admin**: a Reports page beside the existing admin pages, same guard.
6. Blocked people are hidden from search, people lists, conversation lists
   and notifications app-side too (the database already hides most of it).
7. **Inbox**: unchanged, except its header comment (which wrongly said
   direct messaging was retired) is fixed.
8. Copy stays plain, calm, sentence case.

### Part C — verify

`tsc`, unit tests, and `npm run build` before the PR. With the migration
applied, three real accounts, at 390px/1280px, light/dark: stranger's first
message lands in requests; known sender lands in Chats; block from a
profile and from a conversation; report from a profile, message, Moment and
Thought; Make together still works; follow requests still work.
Screenshots: Messages (both tabs, a request), the block dialog, the report
dialog, Settings → Blocked people, admin Reports.

### Part D — ship

Conventional commits; push; open a PR describing the change, the database
rules in plain language, whether the migration is applied, test results,
screenshots, and anything deliberately left out. Order: PR merges first;
then, with explicit approval, the migration is applied right after deploy
(the app works either way — requests only start once it's applied);
re-run the verification script live and one end-to-end check.

### Out of scope for Phase 1 (next phases)

* Replacing the 4-second polling, paging, retry on failed send (Phase 2).
* Unread counts, Seen, and removing per-message bell notifications
  (Phase 3).
* Photos, sharing Moments, unsend (Phase 4). Notification grouping and
  mute (Phase 5). Email and push (Phase 6).
* Reaction counts from a blocked person stay in a Moment's totals (the
  reactions themselves are hidden). Follow-up, not Phase 1.
