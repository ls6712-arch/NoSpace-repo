# Live-test fix round (Sep 27) verification: mocked-network browser pass

Same approach as every prior phase's own pass: the sandbox this was built in
can't reach the live Supabase backend from a browser, so the UI side of this
fix round is verified here with a real Chromium browser driven by
Playwright against the real app code, with every request to
`*.supabase.co` intercepted and answered from a small synthetic dataset —
no app code was stubbed, only the network. A fake image host
(`fixture-images.example.com`) served one local pale-blue PNG standing in
for "a light photo," intercepted the same way.

Mocked as one signed-in account, "Alex" (`ME`), with two accepted chat
threads: **Nani**'s (created 5 days ago, but its last message just
arrived, unread) and **Jordan**'s (created 1 hour ago, but its last
message was 2 days ago, already read) — chosen specifically so activity-
based sorting and creation-based sorting would disagree, proving the fix
rather than coincidentally looking right either way. Nani's thread's own
history ends with her sharing a Pursuit that's owned by a third person,
**Priya** (nobody in the mocked data plays both sender and owner, so the
owner-vs-sender bug couldn't hide behind them being the same person by
accident). A `private_logs` row stood in for an "Only you" Moment — the
device-only, never-a-real-`posts`-row kind Part 8's fix is about.

## What was proved

**1. Chats open at the newest message; the chat list shows previews and
grouping order proves activity, not creation, decides sort — all in one
screenshot.** `01-messages-list-and-pursuit-card.png`:
- Nani's thread sorts **above** Jordan's despite being the **older**
  thread (created 5 days ago vs. 1 hour ago) — its last message is what's
  recent, and `threadSortKey`/`lastMessageAtFor` sort by that, not
  `createdAt`.
- Nani's row is bold with its own preview — **"Shared a Pursuit"**, the
  actual last message, kind-aware — not the old "Direct message" label,
  plus the unread badge "2".
- Jordan's row is muted (read) and shows **"You: See you next week!"** —
  my own last message, "You: "-prefixed, not "Direct message" either.
- The opened conversation (Nani's) is scrolled to the very bottom, and the
  newest message — the shared Pursuit card — is the last thing visible,
  proving the first-batch scroll-pin fix (previously the panel loaded at
  the top of history).
- That Pursuit card reads **"Learning Pottery — Pursuit · Priya"**: the
  Pursuit's actual owner, not Nani, who sent it.

**2. The Save bookmark reads clearly on a light photo.**
`02-bookmark-on-light-photo.png` — Nani's and Priya's pale-blue Moments on
Discover both show the white bookmark icon with a visible dark scrim
holding it apart from the light background, on cards that would otherwise
have made a plain white icon nearly disappear.

**3. An "Only you" Moment's detail view says so, and says it can't be
shared.** `03-only-you-detail-label.png` — "Who sees this" reads **"Only
you"** with the lock icon (previously mislabeled "Followers," since
`AUDIENCE` had no entry for a private-log's `visibility: "private"`), and
"Only you Moments can't be shared." appears right under the metadata block
— the one place in the dialog that reaches every "Only you" Moment,
including a private-log stand-in that never reaches the Send-to/Report
action row at all (see the component's own `!post.isPrivateLog` guard).
The "Send to…" button itself is absent from the action row below.

**4. The You page follows dark mode.** `04-you-page-dark-mode.png` — the
whole page (not just the header) is now the app's own warm-charcoal dark
palette, from `.ns-paper-theme`'s new `.dark` override in `theme.css`.
Previously only the header turned dark while the page stayed on its light
cream-and-ink values.

**5-6. Phone width.** `05-messages-mobile.png` (the same chat list +
Pursuit-card proof at 390px) and `06-you-page-dark-mobile.png` (dark mode
holding at phone width) — both same-scenario, different viewport.

## What this does not cover — needs a live two-account check

Everything above is proven with synthetic data and a real (but network-
mocked) browser; it does not exercise the actual database, Realtime, or a
second real account. The PR lists the exact live steps to re-check
(U1, U3, R5, R6, R9, D2 in Sush's own checklist) — in short:

- **U1 (opened-at-newest / photo layout shift):** open a real thread with
  a photo message as its very first load — confirm it opens scrolled to
  the bottom, and that the photo finishing loading doesn't yank the view
  if already at the bottom.
- **U3 (chat list order, live):** with two real accounts, send a message
  into an older thread and confirm it jumps to the top of the list live,
  without a refresh.
- **R5 (Pursuit owner/cover):** share a real Pursuit you don't own into a
  chat and confirm the recipient's card shows the Pursuit's actual owner
  and its real cover photo (or the plain placeholder if it has none).
- **R6 (unsend button under the scrollbar):** on an actual desktop browser
  with a visible (non-overlay) scrollbar, hover a message bubble near the
  right edge and confirm the unsend trash icon is fully visible, not
  clipped.
- **R9 (bookmark scrim on a real, truly white photo):** save someone
  else's Moment shot against a bright white background and confirm the
  bookmark reads clearly without looking heavy on a dark photo elsewhere
  in the same feed.
- **D2 (menu dismiss + admin Reports link):** open the bell or account
  menu, navigate to another page via a header link, and confirm it closes;
  press Escape and confirm it closes and focus returns to the trigger; as
  an admin account, confirm "Reports" appears in the account menu with the
  live open-report count.

Also not covered here: `connect_accepted`/`connect_request` rows actually
disappearing from a real account's bell (mocked data never included any);
the account menu's Escape/route-change dismissal and the admin Reports
link (no keyboard/focus assertions or an admin account in this pass —
verified by reading the code path, not a screenshot).

## How to reproduce this pass

Script lived in the session's scratch directory (not committed — a
throwaway harness, not part of the app or its test suite), using
`playwright` installed ad hoc with `npm install --no-save playwright`
against the pre-installed Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driving `npm run
dev` on `localhost:5184` with every `*.supabase.co` request intercepted
via `page.route`. The one new wrinkle versus prior phases: a second
`page.route` intercepted a fake `https://` image host so a Moment's photo
could be a real `<img>` (MomentCard's own `hasRealMedia` only treats an
`http(s)://` URL as real media, so a `data:` URI silently falls back to
the colored-tile placeholder) without ever touching the actual network —
fulfilled from a local PNG generated with Pillow.
