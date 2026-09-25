# Phase 2 verification: mocked-network browser pass

The sandbox this was built in can't reach the live Supabase backend from a
browser (only server-side tool calls can), so the UI side of Phase 2 is
verified here with a real Chromium browser driven by Playwright against the
real app code, with every request to Supabase intercepted and answered from
a small synthetic dataset — no app code was stubbed, only the network.

A fake but well-formed session was seeded into `localStorage` (the same
`sb-<project-ref>-auth-token` key supabase-js itself uses) so `AuthContext`
resolves to "signed in" with zero real auth network calls. One thread
(500 messages, alternating sender) was served for a single mocked
conversation.

## What was proved

**1. A 500-message thread opens fast, paginated — not a full-history fetch.**
The initial load fired exactly one `messages` GET, with `limit=51` in the
query string (`participation_id=eq.9001&order=created_at.desc,id.desc&limit=51`).
The conversation was open and showing the latest messages in ~1.0–1.3s.
See `01-thread-opened-500-messages.png`.

**2. Scrolling to the top pages in the next 50, oldest-first, with the scroll
position preserved (no visual jump).** Scrolling the conversation to
`scrollTop = 0` fired a second `messages` GET with a keyset cursor —
`or=(created_at.lt.<oldest_loaded_created_at>,and(created_at.eq....,id.lt.<oldest_loaded_id>))` —
and the older page (ids 401–450) landed in state. `02-scrolled-up-older-page-loaded.png`
looks visually identical to the first screenshot because that's the point:
the newly prepended content sits above the fold and nothing jumps — message
451 stays exactly where it was, which is what "keep the scroll position"
means. (Scrolling further up from there reveals 401–450.)

**3. An offline send shows "Not sent · Tap to retry", never a silent
disappearance.** The mock aborted the first `messages` insert outright
(`connectionfailed`), simulating no network. The message appeared
immediately with the failed state and stayed in place — see
`03-offline-send-not-sent.png` (also shows the "New messages" pill, since
the view was still scrolled up from step 2 rather than being yanked down).

**4. Retrying reuses the same message and clears the failed state on
success, without a second request row.** Tapping "Tap to retry" re-sent the
identical text; the mock let this second attempt succeed. The bubble
converts to a normal confirmed message with no "Not sent" label left behind
— `04-retry-succeeded.png`.

## What this does *not* cover (needs a live two-account check)

Realtime itself (the actual `wss://.../realtime/v1` connection) is not
exercised here — Playwright's route interception mocks HTTP, and the
sandbox has no path to a real Postgres Changes stream to mock faithfully
without just re-implementing Supabase Realtime. Also not exercised: the
declined→accepted reopen flow, the one-message-while-pending limit, and the
message_request/message notification wording, all of which are unit-tested
in `messageTabs.test.ts`/`messageSync.test.ts` but weren't re-driven through
this particular browser pass.

**Live check needed before calling Phase 2 fully done** (two real accounts,
two browser windows or two devices):
1. Sign in as A and B, with an existing accepted thread (or start one).
2. With Messages open on both sides, have A send a message. Confirm it
   appears on B's screen in about a second, and that the Network tab shows
   no polling (no repeating request every few seconds) — only the initial
   load and the Realtime websocket frames.
3. Send a fresh message request from a stranger account to B (not
   currently followed) — confirm B's Message requests tab updates live
   without B refreshing, and the preview shows the sender's message.
4. Have A accept or ignore something, or have A block B mid-conversation —
   confirm B's thread list updates live (the accept/ignore/disappearing
   thread cases from the participations INSERT/UPDATE Realtime handler).
5. On B, turn off Wi-Fi, send a message, confirm "Not sent · Tap to retry",
   turn Wi-Fi back on, tap retry, confirm it sends and A receives it live.
6. Open a real thread with 500+ messages (or seed one) and confirm it opens
   quickly and scrolling up pages in further history against the live
   database, not just the mock.
7. Leave Messages open for a couple of minutes with the tab backgrounded,
   then refocus — confirm the safety-net refresh catches up without a full
   page reload.

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — it's
a throwaway verification harness, not part of the app or its test suite)
and used `playwright` installed ad hoc with `npm install --no-save
playwright` (not added to `package.json`/`package-lock.json`) against the
pre-installed Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
driving `npm run dev` on `localhost:5183` with every `*.supabase.co` request
intercepted via `page.route`.
