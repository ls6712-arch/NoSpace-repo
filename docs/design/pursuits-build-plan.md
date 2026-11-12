# Pursuits: Codex build handoff

Status: implemented locally following user authorization. Release requires schema review, PR merge by the owner, and approved migrations.

## Outcome

Make it easy to start a Pursuit, record real progress, and keep going with friends. Use one creation form and one detail page with Progress and Chat tabs. Keep optional planning out of the critical path. Friends provide support through visible commitments, comments, replies, and mentions. Do not add Stubby coaching or infer skills from photos or notes.

## Instructions to the implementing Codex

Read CLAUDE.md, any applicable AGENTS.md, docs/style-guide.md, and docs/glossary.md first. Use the existing checkout; preserve user changes. This document is an implementation specification when the user authorizes coding. Implement in reviewable phases below, using existing components, tokens, routes, authentication, member gates, and persistence where possible. Do not merge PRs or deploy migrations to live.

Inspect the actual schema and policies before designing database changes. Follow CLAUDE.md for supported live read-only inspection. If no connector is available, inspect migrations for a provisional design, prepare the precise schema query for the user, and continue independent work. Do not claim a live schema is verified from snapshots. Never edit an applied migration. New database features require additive migrations, RLS, and repository-standard rollback-only verification scripts.

The existing generated images illustrate layout direction, not exact specifications. Follow this document for behavior, permissions, copy, and truthful progress. Do not reproduce incidental image inconsistencies, including dot counts, extra RSVP choices, or unselected defaults.

## Approved copy

Creation question: **How would you like to track this?**

| Choice | Supporting text |
| --- | --- |
| Sessions | Count each time you do it. |
| Total | Add up pages, hours, distance, or another amount. |
| Checklist | Check things off as you go. |
| Moments only | Share how it’s going without counting progress. |

Use **Individual goals**, **Shared goal**, **Progress**, **Chat**, **Add progress**, **Log a Moment**, and **Finish by** with an Optional indicator. These labels were approved in the conversation. Update the glossary to record that approval when implementing. Use existing glossary terms for other copy; do not invent new product nouns. Apply existing plural and date helpers.

## 1. Create

One form, progressively revealing relevant fields:

1. Name: required. Preserve Corner context from entry links. A Corner should not be mandatory when starting elsewhere unless existing product constraints require it.
2. Tracking: Sessions, Total, Checklist, or Moments only.
3. Sessions: optional positive whole-number target. Total: required unit and optional positive target. Checklist: at least one named item, editable later. Moments only: no numerical target.
4. Finish by: optional date, independent of tracking type. It is a planning date, not an automatic finish command.
5. Who with: Just me or Friends. Friends reveals people selection and Individual goals / Shared goal. Default to Individual goals. Invitees must accept before accessing private content.
6. Start a Pursuit. Prevent duplicate submissions, preserve input on failure, and give retryable errors.

Keep one goal model per Pursuit in the first release. Short-term and long-term Pursuits use the same interface; Checklist supports intermediate steps. Do not introduce nested monthly goal systems in this release. Allow repeat scheduling independently of goal tracking.

Friends with Individual goals use the same tracking type and unit but may choose different targets and optional personal dates. Each sees their own progress first. For a Shared goal, contributions feed one target or checklist. Moments only has no Individual goals / Shared goal selector; it is a shared timeline when friends participate.

Route all creation entry points through this form, preserving title, Corner, inspiration, and invite context. Preserve open-group discovery and joins; existing open groups must remain usable. Do not silently convert their visibility or progress semantics. Map the old builder's additional settings to a collapsed optional section where needed for compatibility.

## 2. Pursuit page

Header: name, participating people, and overflow menu. Show Progress first; Chat is for participating friends. Solo Pursuits do not show an empty Chat tab.

Progress tab order:

1. Your goal and progress for Individual goals; group progress for Shared goal.
2. Primary Add progress action, or Log a Moment for Moments only.
3. Optional next session, with date, location, attendance, and edit/discuss actions.
4. Friends' progress in stable membership order, never ranked. Hide pending invitees' nonexistent progress and distinguish pending invitations clearly.
5. Recent activity and Moments, with comments accessible from each update.

Use existing responsive layouts, typography, spacing, buttons, and sheets. Keep progress actions reachable on mobile without covering content or keyboard controls. Include loading, empty, error, and retry states. Existing nonmember public previews must not expose private group Chat, sessions, or Moments.

## 3. Record progress

| Tracking | Input | Calculation |
| --- | --- | --- |
| Sessions | One completed session; editable occurrence date | Sum completed session entries |
| Total | Positive finite quantity, fixed unit, editable occurrence date | Sum quantities plus any supported starting amount |
| Checklist | Complete or reopen a named item | Completed active items / active items |
| Moments only | Existing Moment composer | Timeline, no percentage |

Notes and photos are optional on progress entries. Do not require a public Moment to record progress. If someone attaches a Moment, link it to the entry; never count both separately. Follow existing media access controls.

Saving a contribution creates a commentable activity entry for authorized group participants. Owners of contributions can correct or delete them; totals update correctly. Session totals use action count, not number of unique calendar days. Store occurrence time separately from creation time.

Without a target, show an accumulated count or amount without a denominator or percentage. With a target, show actual totals, including totals above target; cap only the visual bar at 100%. Reaching the target may show a quiet success state, but does not automatically finish a Pursuit. Reject NaN, infinity, invalid dates, and invalid quantities.

Use idempotent writes or stable entry identifiers so retrying never duplicates progress. Clearly distinguish local pending, saved, and failed states. Retain useful solo offline behavior; never report group invitations, Chat messages, or server-only group creation as successful without server confirmation.

## 4. Friends, comments, and Chat

Two locations, with clear context:

- Comments and replies belong to a specific Moment or progress entry. Reuse existing comments where the access model fits. A contribution and its attached Moment must not produce duplicate discussion threads.
- Chat belongs to the Pursuit and supports practical discussion, sharing updates, and session cards. Reuse existing messaging infrastructure only if group membership and access are enforced correctly.

Support text comments, one reply level initially, appreciation using the existing reaction pattern, and mentions of eligible Pursuit participants. Shoutouts are ordinary messages or updates mentioning a person; no separate scoring feature. Do not make an appreciation notification for every repeated tap.

Notify for invitations, replies to the recipient, direct mentions, and relevant session changes. Deduplicate notifications when one event matches several rules. Provide per-Pursuit mute controls. Do not send automatic reminders to friends about missed personal goals, or add an unsolicited friend-nudge button.

Use existing reporting, blocking, notification caps, and content deletion conventions. Membership and blocking checks must be enforced server-side, including notification generation. A mention must never grant access. Removed participants lose access to private group content according to the repository's retention policy; existing contributions must not be reassigned or silently removed from shared totals.

## 5. Plan a session

Title, date/time, optional location and note, participants, personal reminder, and optional repeat setting. First release supports no repeat or weekly repeat with an end date. Model each occurrence separately so attendance, comments, edits, and logging are unambiguous.

Participants can mark I'm in or Can't make it. Discussion is attached to the session. Scheduled attendance never equals completed progress. Afterward, Log my session creates one contribution for that person and occurrence. Enforce uniqueness for session-linked contributions, while permitting unrelated additional practice sessions.

For Individual goals, a shared session adds once to each person who explicitly logs it. For Shared goal Sessions, one shared occurrence counts once for the group, regardless of attendee count; personal attendance stays separate. For Shared goal Total, explicitly logged quantities add together. Document these semantics in context so users know what contributes.

The session creator or host can edit or cancel it; notify affected participants. Repeat edits offer this occurrence or this and future occurrences. Preserve completed occurrences and their progress. Use existing date helpers and the viewer's timezone; persist instants and sufficient recurrence timezone information to handle daylight-saving transitions.

## 6. Edit and recover

Overflow menu: Edit Pursuit, Manage people where authorized, notification preferences, Pause, Finish, and Leave where applicable.

- Name, description, target, deadline, personal reminders, and future sessions remain editable.
- Changing 10 sessions to 8 retains four completed sessions and shows 4 of 8.
- Target reductions below current progress preserve the actual total; do not fabricate new contributions or auto-finish.
- Before contributions exist, tracking type and unit may change. Afterward, keep type, unit, and Individual goals / Shared goal fixed in the first release. Explain why and offer starting another Pursuit without copying progress.
- Checklist items have stable identities. Allow adding, renaming, and reordering. Archive removed items rather than erasing completion history; recalculate the current checklist and record material shared edits.
- Each person controls their personal target, reminder, and entries. The host controls shared settings and shared checklist structure. Participants control completion of their own checklist in Individual goals. In Shared goal, joined participants can complete/reopen shared items; record who acted and prevent duplicate completion.
- Material shared changes produce a concise activity entry. Notify on session changes, not every cosmetic edit.
- An overdue date offers rescheduling, a smaller plan, or pause. Completed progress remains. A private adjustment is not automatically broadcast.

## 7. Finish and recap

Separate finishing from target achievement. Individual goals: each participant can finish their own participation without finishing everyone else's. Shared goal: host finishes the shared Pursuit. Show confirmation scope clearly. Leaving is different from finishing.

Recap uses actual entries, quantities, checklist state, and dates. Finishing at 7/10 must show 7/10, never 10/10 or a claim that the target was achieved. Do not use photo count as completed progress. Time spent appears only if actually recorded. Sharing a recap is optional and cannot broaden private media access. Reopening preserves history and entries.

## Persistence and compatibility

Inspect these existing integration points before adding abstractions:

- src/app/pages/CreatePursuit.tsx and Pursuit.tsx
- src/app/pages/Log.tsx and PursuitRecap.tsx
- src/app/components/pursuit/MakeItAPursuitSheet.tsx
- src/app/components/PursuitDialog.tsx and PursuitField.tsx
- src/app/lib/journal.ts, pursuitProgress.ts, pursuitsRemote.ts
- src/app/lib/usePursuitProgress.ts and openPursuits.ts
- Existing messaging, comments, notifications, media policies, member gates, and pursuit_sessions storage.

Existing measure kinds, legacy optional goals, shared totals, open groups, progress entries, and private Moments must remain readable. Do not reinterpret historical time or quantity as session count. Keep a compatibility adapter where a legacy goal cannot map losslessly. Individual targets and per-person finish state need explicit persistence; do not put another participant's settings in a browser-only owner object. Chat and progress permissions must hold across devices.

Before UI implementation, write the schema mapping and migration plan, identifying reused fields and new requirements. Prefer existing supported APIs, but replace silent best-effort behavior on collaborative operations with explicit typed outcomes. Avoid unrelated infrastructure rewrites.

## Implementation order

1. Audit and foundation: document schema mapping, compatibility cases, access rules, and source-of-truth calculations. Add focused meaningful tests for calculations and authorization. Prepare additive migrations and verification scripts.
2. Solo workflow: unified creation, all four tracking options, progress page, edit/correct/pause/finish/reopen, truthful recap. Preserve legacy Pursuits.
3. Friends: invitation acceptance, individual targets or shared goal, per-person lifecycle, access enforcement, and shared activity. Do not expose nonfunctional options as ready.
4. Interaction: comments, replies, Chat, mentions, reactions, and deduplicated notifications/muting.
5. Sessions: attendance, comments, weekly recurrence, occurrence edits, explicit progress logging, and notification behavior.
6. Polish: mobile and desktop accessibility, slow/offline/error handling, existing entry points, regression checks, and review screenshots.

For each phase, summarize changed behavior, validation, and remaining dependencies. Keep changes scoped. If opening PRs, follow repository policy; never merge or deploy to live without the separately required authorization.

## Acceptance checks

- Create and reopen all four tracking types, with and without dates and targets where supported.
- Ten sessions in one month can be logged on any dates, including multiple sessions on one day. Repeating schedule and goal count remain independent.
- Long-term Checklist and ongoing Moments only Pursuits work without mandatory short-term deadlines.
- Amount entries accumulate correctly; correcting/deleting an entry recalculates progress.
- Checklists preserve item identities and history through edits, completion, and reopening.
- Two friends can have different targets and completion states. Shared totals calculate according to documented group semantics.
- Nonmembers, pending invitees, removed users, and blocked users cannot read/write private content or trigger unauthorized notifications.
- Comments, replies, mentions, session discussions, and Chat survive reload and are available on a second signed-in client.
- Double-clicks and failed-request retries do not duplicate entries, invites, messages, or notifications.
- RSVP alone does not add progress. Logging a session occurrence twice does not double count.
- Weekly recurrence, daylight-saving changes, editing one occurrence, and cancelling future sessions preserve prior activity.
- Finishing at 7/10 yields an honest 7/10 recap; a photo-free session counts and an unrelated photo does not.
- Local solo saves, pending sync, remote failures, and invite failures are presented truthfully; no false group success.
- Verify keyboard navigation, visible focus, labels, touch targets, reduced motion, contrast, narrow mobile layout, and accessible modal behavior.

Run npm run lint, npx tsc --noEmit, npm test, npm run build, and relevant existing browser tests. Add targeted integration/browser coverage for the workflows changed. Run repository-required database verification in an authorized test environment; do not claim RLS verified using client mocks alone. Record executed test counts and failures. The earlier onboarding proxy failure is historical: recheck current connectivity and dependency state before treating it as a blocker. Never disable TLS or verification to install dependencies.

## Delivery

Provide implementation summary, screenshots of real running screens, test evidence, migrations requiring review/deployment, and known limitations. Separate working local behavior from unverified live behavior. Do not describe generated mockups as implemented screenshots. No Stubby integration, public discovery redesign, competitive ranking, nested goal hierarchy, or automatic AI advice is part of this scope.
