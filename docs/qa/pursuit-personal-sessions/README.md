# Personal and shared Pursuit sessions

A personal Pursuit previously displayed group RSVP buttons, response messaging and discussion controls. Its Next session card also included past sessions, making a personal schedule look like a group event list.

The session view now uses explicit participation mode and actual invited/joined participants. Public visibility is not used to decide whether something is a group. A solo Pursuit stays personal even if its public visibility flag is set; a private Pursuit with invited friends can still use group responses.

- Personal sessions show Edit and Remove, without RSVP, responses, attendance explanation or discussion controls. Removing a new workflow session marks only that record cancelled; its record, other sessions and progress remain. Existing legacy session editing stays available through its current controls.
- Who with? shows Just me and an authenticated owner gets a visible Invite people action before session planning. Opening it does not change participation mode or public visibility. Only a successful explicit invitation changes participation mode through the existing RPC.
- Friends and invitation status appear before session planning for shared Pursuits. An empty shared setup directs the owner to invite people before planning a new group session.
- Shared sessions retain RSVP/discussion. Declined responses display the person's name, rather than claiming nobody responded. Past sessions have no new RSVP controls.
- The single next session appears first; other upcoming sessions and past sessions are separately collapsed. Cancelled sessions are omitted from those lists. No dates, recurrence rules, authors or existing progress are rewritten by opening this page.
- The session form identifies Just me or Friends, and Moments-only Pursuits have an appropriate No Moments yet empty state.
- Inviting someone to an old Pursuit keeps the compatibility adapter active instead of switching to an unadapted project and failing to render.

## Actual screenshots

Captured from Chromium against the running local app at 390 x 844, reduced motion, America/New_York time zone. External requests were blocked. These are isolated local fixtures, not production users. The authenticated invitation flow is exercised in the component tests; the signed-out local fixture screenshot does not show the login-only invitation action.

| Screen | Capture |
| --- | --- |
| Personal session | [Mobile](01-personal-session-mobile.png) |
| Personal session history | [Mobile](02-personal-history-mobile.png) |
| Private Pursuit with friends and a declined response | [Mobile](03-friends-session-mobile.png) |

## Validation

- Ten component tests cover solo/absent modes, public visibility independent of participation, collapsed history, targeted removal, session form context, empty group setup, private shared sessions, declines and explicit invitations for both new and legacy Pursuits.
- The new browser script passed 16 checks, including reload persistence, single-session removal, preserved progress/history, RSVP persistence and unchanged public visibility. It produced three screenshots with no page errors.
- The original Pursuits browser script passed all 24 checks, including new session planning and weekly recurrence.
- The final six-file regression suite passed 82 tests. Type checking, design-token lint and production build also passed. The existing large-chunk build warning remains.

Reproduce the new browser checks with:

```sh
PURSUIT_TEST_ORIGIN=http://127.0.0.1:5174 node scripts/e2e/pursuit-personal-sessions.mjs
```

No Supabase migration is needed. No public visibility, database schema or production data was changed by this task. This fix addresses the Pursuit session/invitation screen; the separate Calendar synchronization findings remain outside this change.
