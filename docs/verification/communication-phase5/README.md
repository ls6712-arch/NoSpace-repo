# Phase 5 verification: mocked-network browser pass

Same approach as Phases 2-4's own passes: the sandbox this was built in
can't reach the live Supabase backend from a browser (only server-side tool
calls can), so the UI side of Phase 5 is verified here with a real Chromium
browser driven by Playwright against the real app code, with every request
to `*.supabase.co` intercepted and answered from a small synthetic
dataset — no app code was stubbed, only the network.

A fake but well-formed session was seeded into `localStorage` (the
`sb-<project-ref>-auth-token` key supabase-js itself uses) so `AuthContext`
resolves to "signed in" with zero real auth network calls. The mocked
`notifications` table held five rows: two Thoughts on the same Moment
(`/moment/501`, one hour apart, both unread — a mergeable pair), one older
Thought on a *different* Moment (`/moment/777`, already read — must stay
separate), one `accepted` notification (generic `/messages` href, already
read), and one `space_join_approved` (never mutable, never merges, unread).
The mocked `profile_settings.notification_preferences` started with an
empty `muted` array and `circle_invites: true`. Both the `notifications`
and `profile_settings` mocks were mutated in place by the same PATCH/POST
handlers the real app calls, so a click in the browser had a real, visible
effect — and each of the three viewport runs below reset both back to this
same starting state first, so no run's interactions leak into the next.

## What was proved

**1. Grouping: merged line + two Moments staying separate.** Opening the
bell shows one line — "Nani and 1 other left Thoughts on your Moment." —
for the two same-Moment, same-hour Thoughts, while the older Thought on the
*different* Moment (777) renders as its own untouched line, "Kai left a
thought on your moment." The `accepted` and `space_join_approved` rows
(generic href / never-merge kind) each stay their own line too. The bell's
badge reads "2" (the two still-unread groups, not the three still-unread
*rows*) — `01-bell-grouped-and-separate.png`.

**2. Mark all read.** Clicking "Mark all read" clears every unread
highlight and the numeric badge in one action, live via the same
`markAllRead()` path Phase 3 built, unchanged — `02-after-mark-all-read.png`
(highlighted-row count logged as 0 during the run).

**3. Settings → Notifications.** The new section (`5 · NOTIFICATIONS` in
the sub-nav) renders one switch per mutable category — Thoughts on your
Moments, Pursuit activity, **Make together and Explore together** (the
label Sush asked to rename), Message requests, and Circle invitations (the
existing `circle_invites` boolean, not a new switch) — under the exact
header copy asked for: "Turning a type off stops new ones. It doesn't
remove ones you already have." — `03-settings-notifications.png`.

**4. A switch actually writes through.** Toggling "Thoughts on your
Moments" off flips it visually and the mocked `profile_settings` PATCH
handler received `muted: ["thoughts"]` — logged during the run — proving
the merge-safe upsert (`notificationPreferences.ts`) writes only the
changed category into the full existing object rather than clobbering the
rest of `notification_preferences` — `04-settings-thoughts-muted.png`.

**5. Dark mode.** The same grouped bell (fresh state, this run's own reset)
renders correctly in dark theme — contrast, highlight tint, and icons all
legible — `05-bell-grouped-dark.png`.

**6. Mobile width (390px).** The same grouped bell opens correctly at phone
width, anchored under the header's bell icon without overflowing the
viewport — `06-bell-grouped-mobile.png`.

## What this does *not* cover (needs a live two-account check)

Everything Part A's migration actually enforces — the mute check inside
`enforce_notification_insert()`, the `private.notification_kind_muted()`
helper's own unreachability from PostgREST/`authenticated`, and the
`circle_invites` boolean's existing polarity — was verified live and
directly against Postgres via
`supabase/verification/communication_phase5_check.sql`, not through the
browser. Realtime itself (the live unread-count refresh this menu relies
on) isn't exercised here either — its connection attempt just fails
quietly against the sandbox's network policy, same as every prior phase's
mocked pass.

**Live check needed before calling Phase 5 fully done** (two real accounts,
two browser windows):

1. On A, mute "Thoughts on your Moments" in Settings → Notifications. On B,
   leave a Thought on one of A's Moments. Confirm no new bell row or badge
   increment appears for A (refresh A's page too, to rule out a
   Realtime-only gap) — the row was silently dropped at insert, not merely
   hidden client-side.
2. On A, unmute it again, then have B leave two Thoughts on the same Moment
   within a few minutes of each other. Confirm both arrive and merge into
   one grouped line on A's bell, and that opening it marks both members
   read together (check via a fresh page load that the badge actually
   dropped by one group, not zero).
3. On A, have B send two Thoughts on *different* Moments more than 24 hours
   apart (or edit one row's `created_at` directly in the DB to simulate
   this). Confirm they never merge into one line.
4. On A, have B send a Make together / Explore together request, then have
   A accept it. Confirm both the initial ask and the acceptance each show
   up as their own bell entries (never merged with each other or with
   anything else), and that muting "Make together and Explore together"
   before B's next ask suppresses it the same way step 1 proved for
   Thoughts.
5. On A, leave a Thought on B's Moment, then have B click that bell entry.
   Confirm it navigates to `/moment/<id>` (not `/you`) — the href fix from
   Part A's fact-check.
6. Confirm the two fact-checked surfaces are untouched: A's old
   `connect_request`/`connect_accepted` rows (if any exist from before this
   trigger existed) still don't reappear from any code path, and toggling
   any Settings switch has no effect on B's actual incoming follow request
   showing up under Messages → Message requests (a separate, non-notification
   surface — see Part A's fact-check #1).

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — it's a
throwaway verification harness, not part of the app or its test suite) and
used `playwright` installed ad hoc with `npm install --no-save playwright`
(not added to `package.json`/`package-lock.json`) against the pre-installed
Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driving
`npm run dev` on `localhost:5183` with every `*.supabase.co` request
intercepted via `page.route`.

One pitfall worth recording, specific to this pass: `SettingsShell` always
renders *both* its desktop and mobile trees (which one shows is pure CSS,
`hidden`/`lg:hidden`), so a `page.getByText(...)` locator against anything
inside a Settings section resolves to two elements at any viewport width —
`.first()` is required to pick the one actually visible at that width,
same as it already was for the switch locator.
