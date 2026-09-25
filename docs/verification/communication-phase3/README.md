# Phase 3 verification: mocked-network browser pass

Same approach as Phase 2's own pass: the sandbox this was built in can't
reach the live Supabase backend from a browser (only server-side tool calls
can), so the UI side of Phase 3 is verified here with a real Chromium
browser driven by Playwright against the real app code, with every request
to `*.supabase.co` intercepted and answered from a small synthetic dataset
— no app code was stubbed, only the network.

A fake but well-formed session was seeded into `localStorage` (the
`sb-<project-ref>-auth-token` key supabase-js itself uses) so `AuthContext`
resolves to "signed in" with zero real auth network calls. One accepted
direct-message thread (3 messages, the last one mine) was served for a
single mocked conversation, plus two non-`message`-kind notifications for
the bell.

## What was proved

**1. Unread bold + per-thread count + header badge.**
`participation_message_summaries()` was mocked to return `unread_count: 3`
for the one thread. The thread name rendered bold with a "3" badge next to
it, and the header's Messages icon showed a "1" badge (it counts unread
*threads*, not unread *messages* — by design, per `countUnreadThreads()` —
so one unread thread is "1" regardless of how many messages are unread
inside it). See `01-unread-bold-and-badges.png`.

**2. Opening the thread marks it read (debounced) and clears bold/badge.**
The thread auto-opens (it's the only one), which starts the 1s debounce;
once `shouldMarkThreadRead` conditions hold (thread open, tab visible,
scrolled to bottom), `mark_conversation_read` fires and the bold/badge
clear without a page reload. See `02-after-open-marked-read.png`.

**3. "Seen" is hidden while `thread_seen_at()` returns null, and shown once
it returns a timestamp.** With the mock returning `null`, no "Seen" text
appeared under my last message (`03-seen-not-shown.png`). The mock was then
flipped to return a real timestamp and the page was reloaded (`page.reload()`,
not `page.goto()` to the same URL — see the pitfall note below) to exercise
the same "on open" refresh trigger a real revisit would use; "Seen" then
appeared under my latest message (`04-seen-shown.png`).

**4. The bell has no `message`-kind notifications.** The mocked
`notifications` table only ever returns `hobby_follow`/`thought` rows (a
`message`-kind row would mean `SocialContext`'s own `.neq("kind", "message")`
filter regressed); opening the bell shows those two notifications and no
"sent you a message" text. See `05-bell-no-message-notifications.png`.

**5. The Privacy "Read receipts" switch reads as on by default and persists
a toggle.** `06-privacy-read-receipts-on.png` shows the switch checked with
the exact spec copy underneath; toggling it fired a `profile_settings`
upsert with `read_receipts: false`, which the mock's in-memory state
reflected on refetch — `07-privacy-read-receipts-off.png`.

### A mocking pitfall worth recording

The first pass of this script tried to force a fresh `thread_seen_at` fetch
by calling `page.goto()` to the exact same hash URL (`${BASE}/#/messages`)
the page was already on. Chromium treats navigating to an identical URL —
including an unchanged fragment — as a same-document no-op: no reload, no
remount, so `openConversation()`'s own `refreshSeenAt()` call never re-ran,
and the RPC mock kept "returning" its old value simply because it was never
called again. Swapping in `page.reload()` (a real navigation) fixed it —
worth remembering for any future mocked pass that needs the SPA to
genuinely remount mid-script rather than just changing route.

The Privacy switch step also needed `.first()` on its locators: `/privacy`
(like the rest of `/settings/*`) renders both a desktop (`lg:grid`) and a
mobile (`lg:hidden`) copy of the same section in the DOM simultaneously,
toggled by CSS breakpoint only, so every settings row legitimately has two
matches — not a bug, same as it would be for any other settings row.

## What this does *not* cover (needs a live two-account check)

Realtime itself (the actual `wss://.../realtime/v1` connection) is not
exercised here — Playwright's route interception mocks HTTP only, and the
sandbox has no path to a real Postgres Changes stream to mock faithfully.
Also not exercised: the actual database-level enforcement of Seen (RLS,
the `read_receipts` check on both sides, blocked-between) — that was
verified live and directly against Postgres in
`supabase/verification/communication_phase3_check.sql` (see the PR
description for the full result string), not through the browser.

**Live check needed before calling Phase 3 fully done** (two real accounts,
two browser windows or two devices, with an existing accepted thread):
1. Sign in as A and B. Have A send B a message while B's Messages tab is
   in the background (not visible) — confirm B's Chats entry goes bold with
   a count, and the header badge increments, without B doing anything.
2. Bring B's tab to the foreground and open the thread — confirm the bold
   and count clear within ~1s (the debounce), and confirm on A's side that
   "Seen" appears under A's last message within about 15s (the polling
   trigger) without A reloading.
3. Have A send a second message while B is already looking at the open
   thread, scrolled to the bottom — confirm it's marked read again shortly
   after arriving (debounce re-triggers on new messages), and Seen shows up
   for A after that read.
4. On B, turn off "Read receipts" in Privacy. Confirm: (a) A no longer sees
   "Seen" for messages B has read, even after B reads them; (b) B also no
   longer sees "Seen" for messages A has read (off works both ways).
   Turn it back on and confirm Seen resumes working in both directions.
5. Have a stranger C (not a party to A/B's thread) send some unrelated
   public activity (e.g. a follow, a `join_in`) while B has Messages open —
   confirm B's badge/thread list does *not* refresh or flicker for it (the
   narrowed `isRelevantParticipationEvent` filter).
6. Check the bell on both accounts: send a fresh message between A and B
   and confirm no "sent you a message" notification appears in either
   bell, while an unrelated notification (e.g. a follow) still does, and
   that a first-ever message request *does* still produce a
   `message_request` bell notification for the recipient.
7. Confirm the bell updates live (a new non-message notification shows up
   without a reload) via the `notifications` Realtime subscription.

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — it's
a throwaway verification harness, not part of the app or its test suite)
and used `playwright` installed ad hoc with `npm install --no-save
playwright` (not added to `package.json`/`package-lock.json`) against the
pre-installed Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
driving `npm run dev` on `localhost:5183` with every `*.supabase.co`
request intercepted via `page.route`.
