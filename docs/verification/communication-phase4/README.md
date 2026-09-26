# Phase 4 verification: mocked-network browser pass

Same approach as Phase 2 and Phase 3's own passes: the sandbox this was
built in can't reach the live Supabase backend from a browser (only
server-side tool calls can), so the UI side of Phase 4 is verified here with
a real Chromium browser driven by Playwright against the real app code,
with every request to `*.supabase.co` intercepted and answered from a small
synthetic dataset — no app code was stubbed, only the network.

A fake but well-formed session was seeded into `localStorage` (the
`sb-<project-ref>-auth-token` key supabase-js itself uses) so `AuthContext`
resolves to "signed in" with zero real auth network calls. Two threads were
served: an accepted direct-message thread with "Jordan" (five messages,
including one of Jordan's already unsent) and a brand-new pending
direct-message thread to "Casey" with zero messages yet, sent by me. The
`message-media` storage bucket's upload/sign/object endpoints and the
`posts`/`profiles` REST endpoints were all mocked; a tiny 1×1 PNG on disk
stood in for a real photo.

## What was proved

**1. Photo attach: sending → sent.** Attaching a photo in the accepted
thread immediately shows a bubble with the local (already-picked) preview
while the mocked upload is deliberately delayed — `01-photo-sending.png`.
Once the mocked upload and insert resolve, the bubble re-renders from a
signed URL fetched fresh via `getMessagePhotoUrl()` (never a public URL,
since `message-media` has none) — `02-photo-sent.png`.

**2. Photo attach: failed.** A second photo attach, with the mocked
`messages` insert forced to fail after the upload itself succeeds, leaves
the bubble showing "Not sent · Tap to retry" — Phase 2's existing failed-send
affordance, reused as-is for a photo (`03-photo-failed.png`). Retry would
reuse the already-uploaded path rather than re-uploading (see
`ensureUploaded`/`retryMessage` in `SocialContext.tsx`) — not exercised
here since it isn't part of Part B's UI requirements.

**3. Shared Moment card, valid.** A `kind: "moment"` message pointing at a
post that resolves under the viewer's own permissions renders its image,
caption, and owner name, linking to `/moment/<id>` — `04-shared-moment-card.png`.

**4. Shared Moment card, "Not available".** A `kind: "moment"` message
pointing at a post id the mocked `posts` table simply doesn't have (standing
in for RLS silently returning nothing — private, followers-only, deleted,
all indistinguishable) renders "Not available" and nothing else: no title,
no owner name, no broken image — `05-shared-not-available-card.png`. This is
ordinary RLS behavior with zero special-casing in `fetchSharedMoment()`.

**5. Unsend, both sides.** The thread was seeded with one of Jordan's
messages already unsent (`deleted_at` set), proving the "their side"
rendering on load. Then my own "anyway, here's a photo too" message was
unsent live — hover to reveal the trash icon, click, confirm in the
`ConfirmDialog` — and it also switched to "Message deleted" without a
reload, via the optimistic patch in `unsendMessage()`. Both bubbles read
"Message deleted" in the same screenshot — `06-unsend-both-sides.png`.

**6. Pending-request composer has no attach button.** Casey's thread is a
pending direct_message I sent with zero messages yet — `canSendInto` keeps
the text composer open (I'm the sender, nothing sent yet), but
`canAttachInto` requires `status === "accepted"`, so the entire
`<input type="file">` + attach-button block is omitted from the DOM
entirely (not just disabled) — `07-pending-composer-no-attach.png`. Contrast
with Jordan's accepted thread, where the attach button is present in every
other screenshot here.

## What this does *not* cover (needs a live two-account check)

Realtime itself (the actual `wss://.../realtime/v1` connection — its
attempted connection here just fails against the sandbox's network policy
and is retried quietly in the background, never blocking the UI) is not
exercised, nor is the database-level enforcement behind any of this: the
`message-media` bucket's storage policies (a signed URL failing once you're
no longer a party to the thread, or once the sender unsent it), the
`messages` INSERT policy's `shared_post_id`/`shared_pursuit_id` ownership
checks, and `unsend_message()`'s own "only the sender" check. Those were
verified live and directly against Postgres during Part A (see the PR
description), not through the browser.

**Live check needed before calling Phase 4 fully done** (two real accounts,
three browser windows — the third signed out — with an existing accepted
thread between the two accounts):

1. **Signed URL scoping**, three checks against one real chat photo (copy
   its signed URL from the Network tab or the `<img src>` on either
   account):
   a. **On a third, signed-out browser**, open that signed URL directly.
      Confirm it loads at first, then confirm the *same* URL stops working
      after about 5 minutes (`MESSAGE_MEDIA_URL_TTL_SECONDS`) — it isn't
      just scoped, it actually expires.
   b. On any browser (signed in or out), open the plain storage path with
      no token —
      `https://<project>.supabase.co/storage/v1/object/public/message-media/<path>`
      — and confirm it never loads. `message-media` has no public endpoint
      at all (`public = false`), unlike `post-media`.
   c. Sign in as a **third** account with no relationship to A or B's
      thread and try to mint a signed URL for that same path yourself (the
      browser console: `supabase.storage.from('message-media')
      .createSignedUrl('<path>', 60)`). Confirm it fails — the read policy
      is scoped to the two parties in that thread, not to being signed in
      generally.
2. On A, attach a photo in an accepted thread with B. Confirm it uploads,
   shows a progress/sending state, then renders full-size; confirm B sees
   the same photo appear live (Realtime), tap-to-view opens it full size on
   both sides.
3. On A, open a Moment or Pursuit and use "Send to…" into the thread with
   B. Confirm the card appears on both sides and opens the right page when
   clicked on B's account. Then have A make that same Moment private (or
   have B unfollow, if it's followers-only) and confirm the card now reads
   "Not available" on B's side without reloading — the same RLS path this
   mocked pass exercised, but against real policies.
3b. On B, viewing A's own Moment, use "Message about this" — confirm it
   opens (or starts) a chat with A with the Moment ready to share, and that
   doing this on a brand-new (not-yet-accepted) thread sends text only and
   says the Moment can be shared once accepted, per the banner copy.
4. On A, send B a message, then unsend it. Confirm B sees "Message deleted"
   live without reloading, and that the underlying photo (if it was one) is
   actually gone from Storage — not just hidden client-side (try the old
   signed URL again after a few minutes; a stored one may still work for
   its remaining TTL, but a *fresh* `createSignedUrl` call for that path
   should fail once the object is deleted).
5. On A, send a pending message request to a third account C who hasn't
   accepted yet. Confirm C's composer has no attach button and no
   "Send to…" reaches them until C accepts — the moment C accepts, confirm
   the attach button and any queued "Send to…" both become available.
6. Confirm a blocked party can't be selected in the "Send to…" picker, and
   that an already-blocked thread never shows an attach button either
   (`canAttachInto` doesn't check blocks itself — `SendToChatDialog` filters
   them out separately; worth confirming live that both paths agree).

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — it's a
throwaway verification harness, not part of the app or its test suite) and
used `playwright` installed ad hoc with `npm install --no-save playwright`
(not added to `package.json`/`package-lock.json`) against the pre-installed
Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driving
`npm run dev` on `localhost:5183` with every `*.supabase.co` request
intercepted via `page.route`.

One pitfall worth recording: the mocked signed-in session alone wasn't
enough to reach `/messages` — `Root.tsx` redirects any account whose
`profiles.onboarding_completed` isn't `true` into `/onboarding` first, so
the mocked `profiles` rows all needed that field set, same as any other
account created after `sql/onboarding-v2.sql`.
