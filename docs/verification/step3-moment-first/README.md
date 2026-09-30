# Step 3 verification: mocked-network browser pass

Same approach as every prior phase's own pass (Communication Phases 2–5,
Step 1): a real Chromium browser driven by Playwright against the real app
code, with every request to `*.supabase.co` intercepted and answered from a
small in-memory store — no app code was stubbed, only the network. A
well-formed session was seeded into `localStorage` (the
`sb-<project-ref>-auth-token` key supabase-js itself uses), so `AuthContext`
resolves to signed in with zero real auth network calls; `posts` and
`private_logs` were backed by a real in-memory store the app's own
inserts actually mutate, and every other table (reactions, hobby_follows,
corners, invites, waitlist, …) got a generic empty-but-well-formed answer
so every context provider mounts without crashing.

(The app uses `createHashRouter`, not `BrowserRouter` — every navigation
below is to a `/#/...` path.)

## What was proved

**1. `01`–`03` — "Add your first moment," the new mandatory first step of
onboarding.** A fresh account (`profile.onboarding_completed: false`) lands
on this screen before anything else — no hobby tags, no cover editor, no
Pursuit question. `01` shows the empty state exactly per the brief: Take a
photo / Choose a photo, "Or just write a line," and a Followers-default,
changeable "Who sees it" chip row. `02` shows a typed line enabling Save.
`03` shows the result of tapping Save: a "Your first moment is in." banner
with Undo, "Your followers will see it first," and the "Is this part of
something?" prompt — Give it a name / Not now / Next, the word "Pursuit"
never appearing — rendered inline, exactly once. (The "MILESTONE REACHED —
First Session" toast underneath is the pre-existing rewards system,
confirmed still firing correctly through the new save path.)

**2. `04` — the Everyone-audience hold-to-share friction.** Switching the
audience chip to Everyone and tapping Save doesn't post immediately — it
shows "What strangers will see" (name, Corner, caption — photo omitted here
since no file was attached in this headless pass) and a "Hold to share with
everyone" button in place of a plain tap-to-save. `Only me`/`Followers`
still save on a single tap (proved in `03`, where the default Followers
save happened with no extra step).

**3. `05`–`07` — two-tap logging from the global "+" entry point.** Once
onboarding is complete, `05` shows a normal signed-in Discover page — the
bottom tab bar's Create tab and the desktop header's "Start your log"
button no longer navigate to the full `/create` form; both now call
`openQuickLog()` (`QuickLogContext`, mounted once in `Root.tsx` next to
`CartDrawer`, same pattern). `06` shows the resulting sheet with zero
Pursuit context yet (no Pursuit page it was opened from): a "No pursuit"
chip, an "Add a Corner" chip, and the Followers-default audience row. `07`
shows it after typing a line, with Save enabled — this is the sheet's
compact, chip-based two-tap shape, not the multi-screen `/create` composer.
"Something bigger? More options" links out to the untouched full form.

## What this does *not* cover (needs a live check)

Everything here demonstrates the app's own read/write logic and UI wiring
against a mocked network — it does not exercise any real RLS policy, real
photo upload/HEIC conversion against real storage, or the actual "on any
account with 0 moments" population beyond what Onboarding's own
`onboarding_completed` gate already covers (see the PR description for why
that gate, not a new zero-posts check elsewhere, is what this PR relies on).

**Live check needed, against the preview or live site:**

1. A real invited account, end to end: claim invite → "Add your first
   moment" is the actual first screen → photo (real camera/library, HEIC
   included) → Save → confirm the inviter (their Followers audience) sees
   it. Time it against the under-2-minutes target.
2. An existing account: "+" → photo → Save in 2 taps; change the audience
   once, confirm the *next* time "+" is opened (a different Pursuit, or
   none) the changed audience is still the default — `lib/momentDefaults.ts`
   round-tripping through real `localStorage`, not just its own logic (that
   part has no dedicated unit test either, matching this repo's existing
   convention for storage-touching helpers — see `lib/localData.ts`,
   `lib/inviteCode.ts` — since the test environment here has no `jsdom`).
3. Everyone: preview appears with a *real* photo, hold fills and actually
   saves; with the OS's reduced-motion setting on, confirm the plain "Share
   with everyone" button appears instead and saves immediately.
4. "Is this part of something?" → name it → confirm a new Pursuit exists
   and this Moment is attached to it (`/pursuit/:id`).
5. "Just write a line" (no photo) saves a text-only Moment, first-moment
   screen and two-tap sheet alike.
6. Add details after saving (Corner, location, private reflection,
   audience) — both from the sheet's own "Add details" link right after
   Save, and from the Moment's existing Edit screen (`MomentDetail.tsx`'s
   new "Add details" button) — confirm both write to the same place.
7. Double-tap Save on a slow connection → one Moment, no error (the
   existing #117 `InFlightGuard` pattern, reused as-is by every new save
   path here — never rebuilt).
8. Phone width and desktop, light and dark.
9. A pending (not-yet-claimed-invite) account still lands on Step 2's
   `/#/welcome` door screen, never any of this — untouched by this PR, but
   worth one click to confirm the gate ordering in `Root.tsx` (pending →
   onboarding → normal render) still holds with no new gate inserted
   between them.

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — a
throwaway verification harness) and used the pre-installed Playwright +
Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driving
`npm run dev` on `127.0.0.1:5183` (not `localhost` — this sandbox's
Playwright can't resolve it) with every `*.supabase.co` request intercepted
via `context.route` (registered on the browser context, not a single page,
since the QuickLog scenario opens a second tab to dodge a bfcache issue —
see below).

One pitfall worth recording for next time: navigating twice to the exact
same `/#/onboarding` URL via `page.goto` was a no-op in Chromium (same-URL
navigations can resume from bfcache rather than truly reloading), so a
mock-side flip of `onboarding_completed` from `false` to `true` didn't
actually reach the already-mounted React tree — the fix was either routing
through a different pathname first (`/#/discover`, which itself redirects
back to `/#/onboarding` while still pending) or opening a fresh tab
(`context.newPage()`) for a scenario that depends on a different account
state than the one before it.
