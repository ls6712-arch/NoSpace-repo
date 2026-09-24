# Sushii Communication: Build Strategy

Written Sept 24, 2026, from the live code on `main` (`29a33d0`) and the live Supabase database
(`eyzokuhhbyidvmuqfmwm`). Covers Messages, notifications, and how people reach each other.
This is the source of truth for the work; each phase updates its STATUS line when it ships.

## Where we are today

What works:
- **Direct messages** from any profile, plus threads that open when a Make together or Explore
  together request is accepted. All of them are rows in `participations` (kind
  `direct_message`, `make_together`, `explore_together`), and messages hang off a participation.
- **Security rules on messages**: you can only read and write inside an accepted thread
  (RLS policies on `messages`), and a **rate limit** trigger (`rl_messages_insert`) caps sends.
- **Notifications** (the bell) for follows, Pursuit joins and progress, Thoughts and messages.

What's missing or weak:
- **No block or report.** Anyone signed in can DM anyone. There's no way to stop an unwanted sender.
- **Polling, not live.** The Messages page reloads everything every 4 seconds: all participations,
  400 recent Thoughts, 60 notifications, every profile involved and the full history of every
  conversation. Realtime isn't enabled on any table.
- **No history paging.** Every conversation loads in full, every 4 seconds.
- **Silent failed sends.** The send result isn't checked; a failed message just disappears.
- **No unread state.** No per-conversation unread, no badge on the Messages icon.
- **Bell spam.** Every message also creates a bell notification.
- **Text only.** Thoughts can carry a photo; messages can't. No way to share a Moment or Pursuit.
- **Messages can't be deleted or unsent.** There's no update or delete rule on `messages`.
- **Nothing reaches you outside the app.** No email or push.

Scale today: 10 people, 1 direct-message thread, 5 messages. That's the best time to change the
data model: there's almost nothing to migrate.

## Decisions needed before building (Sush)

**Decided Sept 24, 2026:** 1 = yes, message requests; 2 = full block as recommended; 3 = admin
Reports list, and reporting offers to block. Decisions 4–7 are still open.

**Messages and follow requests stay separate (Sush, Sept 24).**
- Follow requests (and Circle invitations) stay where they are: Inbox → Requests, and the bell.
- Message requests live only in Messages, in a tab named **Message requests** (never just
  "Requests", to avoid two tabs with the same name).
- Accepting one never does the other: accepting a follow request doesn't open a conversation,
  and accepting a message request doesn't make anyone a follower.
- The only link, confirmed by Sush: "known" = you follow them (accepted follow). A first message
  from someone you follow goes straight to your inbox; from anyone else it waits in Message
  requests for you to accept or ignore. Make together / Explore together threads stay as today,
  since accepting that request is already consent.

Each phase lists which of these it depends on. Recommended answer first.

1. **Message requests.** A first message from someone you don't follow lands in a "Requests" tab
   you accept or ignore. *Recommended: yes.* "Known" = you follow them (accepted follow).
   Make together / Explore together threads stay as today, since accepting the request is already
   consent.
2. **What block does.** *Recommended:* the blocked person can't message you, follow you, react to
   or leave Thoughts on your Moments, and doesn't see your profile or Moments; you stop seeing
   theirs. They aren't told. Unblock anytime from Settings.
3. **Reports go where.** *Recommended:* a Reports list in the existing admin pages; reporting
   someone also offers to block them.
4. **"Seen" receipts.** *Recommended: on, with a Settings switch to turn off (off for you means you
   don't see others' either).*
5. **Photos in messages must be private.** Today Moment photos live in a public bucket (anyone
   with the URL can open them). *Recommended:* DM photos go in a new private bucket, readable only
   by the two people in the conversation. This is the first piece of `docs/private-media-plan.md`.
6. **Unsend.** *Recommended:* you can delete your own message; it shows "Message deleted" to both.
   No editing.
7. **Email and push** (Phase 6 only). Needs an email provider (e.g. Resend) and, for push, the app
   installable on phones. *Recommended: email first, push later.*

## Phases

Each phase is shippable on its own, in this order. Later phases depend on earlier ones.

### Phase 1: Safety (block, report, message requests)
Depends on decisions 1, 2, 3.
- **Database:** `blocks` table (who blocked whom) with rules so a block stops messages, follows,
  reactions and Thoughts in both directions, enforced by the database, not just the app;
  `reports` table (who, about whom or which message/Moment, reason, status); DM threads get a
  `pending` state until the recipient accepts, with the sender limited to one message while pending.
  Follow requests (`profile_follows`) are not changed by this phase.
- **App:** Block and Report in a "…" menu on profiles and in each conversation; a Message
  requests tab in Messages (Inbox's Requests tab keeps follow requests and Circle invitations); Blocked people list in Settings with Unblock; Reports list in admin.
- **Also:** hide blocked people from search, Discover, Circles and "This Corner".
- **Done when:** with three test accounts, a blocked person can't message, follow, react or
  comment, even by calling the database directly; a stranger's first message lands in Message
  requests, not in Inbox or the bell's follow requests; an accepted message request becomes a normal
  conversation and changes nobody's follow status.

### Phase 2: Live and reliable
No decisions needed.
- **Database:** turn on Supabase Realtime for `messages` (it respects the same security rules, so
  people only receive messages they're allowed to read).
- **App:** subscribe to new messages instead of polling; load the latest 50 messages per
  conversation and older ones on scroll-up; split the Messages page's data out of the global
  refresh so opening Messages no longer reloads Thoughts and notifications; a sent message appears
  instantly, with "Not sent, tap to retry" if it fails.
- **Done when:** a message appears on the other person's screen within about a second with no
  polling in the network log; a thread with 500 messages opens fast; turning Wi-Fi off and sending
  shows the retry state.

### Phase 3: Unread, Seen, and a quieter bell
Depends on decision 4.
- **Database:** `conversation_reads` (per person, per conversation, last read time).
- **App:** bold unread conversations; unread count on the Messages icon in the header; "Seen"
  under your last message (respecting the Settings switch); **stop creating a bell notification
  for every message**. The bell announces a new message request once
  (not each message), and follow requests exactly as today.
- **Done when:** counts stay right across two devices and two accounts; reading on your phone
  clears the badge on your laptop.

### Phase 4: Richer conversations
Depends on decisions 5 and 6.
- **Database:** private storage bucket for message photos with rules limited to the two people;
  messages gain optional attachments (a photo, or a shared Moment or Pursuit); a delete rule so
  you can unsend your own messages.
- **App:** attach a photo (HEIC converted, same as Moments); share a Moment or Pursuit into a chat
  as a small card that respects the Moment's own visibility (a private Moment shared in a chat
  doesn't become visible to the other person); "Message about this" from someone's Moment; unsend.
- **Done when:** a message photo URL can't be opened by a third account or signed-out; a shared
  Only-you Moment shows "Not available" to the other person.

### Phase 5: Notification center
No decisions needed beyond Phase 3.
- **App and database:** group similar notifications ("3 people loved Lego roses"); Mark all read;
  per-type mute switches in Settings (`notification_prefs`), respected by every place that creates
  a notification.
- **Done when:** muting a type stops new ones of that type; grouping never merges different
  Moments.

### Phase 6: Email (then push)
Depends on decision 7.
- An email provider plus a Supabase Edge Function sends a short email for message requests,
  replies to your Thoughts and people joining your Pursuit, respecting Phase 5's switches, with a
  daily cap and an unsubscribe link. Push notifications come later, once the app is installable.

## How every phase ships (no loose ends)

For each phase, in this order:
1. **Branch** from current `main`. Never touch Spaces work (being redesigned by a teammate) or
   `.env` (the Vercel build needs it).
2. **Migration staged** in `supabase/migrations/` with a matching rollback file. Shown to Sush;
   applied only after an explicit OK. Then verified with SQL, including a test that tries to break
   the rules as a blocked or outside user.
3. **App built** with typecheck, tests and build passing. New rules get tests.
4. **Checked in the app** at phone and laptop width, light and dark, with at least two test
   accounts (three for Phase 1).
5. **Merged by Sush**, then confirmed on the live site after deploy (not just on the branch).
6. **Docs updated:** this file's STATUS line for the phase, `docs/backend-state-<date>.md` for
   database changes, and the project memory (`claude/github-updates.md`).

Anything found along the way but outside the phase goes on the follow-ups list below, not into
the phase.

## STATUS

- Phase 1 Safety: not started (decisions 1–3 made; ready to build)
- Phase 2 Live and reliable: not started
- Phase 3 Unread and quieter bell: not started
- Phase 4 Richer conversations: not started
- Phase 5 Notification center: not started
- Phase 6 Email and push: not started

## Follow-ups (found, not in any phase)

- The bell's `hobby_follow` notifications (29 so far) are the noisiest kind; Phase 5 grouping
  should cover them.
