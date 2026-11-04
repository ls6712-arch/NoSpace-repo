# Calendar and Pursuit sessions

This change joins the existing Calendar to both generations of Pursuit sessions. A goal target creates no Calendar events by itself: only explicitly scheduled session records appear.

## Resulting workflows

1. Personal Pursuit -> schedule a session -> Calendar and the private subscription feed read that session with its own title, time and stable identity.
2. Pursuit with friends -> invited people accept the Pursuit -> participants can see scheduled sessions. A person declining/skipping a session removes it from their Calendar/feed without cancelling it for friends or leaving the Pursuit. Responding I’m in restores it.
3. Rescheduling a workflow session uses the existing permission/progress rules and preserves its identity, note, timezone and recurrence metadata. A shared reschedule explicitly says it changes the time for everyone. Shared plans cannot be moved by an unannounced drag, including before invitees respond.
4. Cancelling a personal workflow session keeps its record with cancelled status. Sessions linked to recorded progress cannot have their original date changed or be cancelled through Calendar. Cancelling an old one-off plan can remove only a genuinely empty plan shell, never an ongoing Pursuit or one with newer session/progress/discussion records.
5. Calendar refreshes on focus and while visible. A successfully empty range replaces stale cached plans. Older requests cannot overwrite a newer result. Optimistic time changes clear when acknowledged by the server, allowing later remote changes to appear.
6. Failed block/free-time reads pause free-time slots and automatic in-slot suggestions, keep known blocks, and expose Retry. Retry actually reloads availability. A new date range does not generate free-time suggestions before its plans load.
7. Grid selection, block placement, current-time placement and cross-day drags use New York wall-clock time on daylight-saving change dates. The existing product timezone remains New York.

## Database and privacy

`20261116000000_calendar_pursuit_sessions.sql` is additive. It adds a small legacy-session decline table, scoped attendance/session-change RPCs, and one normalized read contract shared by the app and the subscription function. Original sessions, progress, authors, timestamps and links are not bulk converted. Modern sessions keep UUIDs; older sessions keep their numeric ids.

The authenticated reader is bound to the caller. The service-role feed supplies a user only after resolving a valid private token; its reader still checks that user's membership and blocking. Pending invitations and outsiders cannot read sessions or responses. Unenrolled accounts retain access only to their own private one-off plans. Session responses remain visible only to authorized participants. Queued attendance/cancellation writes are bound to the original user, preventing an account switch from applying one person's queued RSVP to another.

The private feed exports only scheduled title/place/time and a link. It does not export blocks, free-time windows, budgets, private notes or attendee names. Stable UIDs let external calendars update rescheduled events. External calendars refresh on their own schedule; the existing feed requests hourly refresh and permits a five-minute HTTP cache.

The owner ran the read-only preflight and all eleven prerequisite checks returned true. The new migration has not been applied live by this task.

## Actual screenshots

These are the running production build against an isolated Supabase fixture server, with the normal authenticated app components, at 390 x 844 in America/New_York. No production account or data was used. The browser is Chromium, reduced motion enabled, and unrelated external requests are blocked.

| Screen | Capture |
| --- | --- |
| Legacy, personal and shared Pursuit sessions on one day | [Calendar](01-personal-and-shared-mobile.png) |
| Explicit shared rescheduling context | [Reschedule](02-shared-reschedule-mobile.png) |
| Failed availability read with plans retained and Retry | [Retry](03-availability-retry-mobile.png) |

## Verification

- Isolated PostgreSQL: 65 assertions pass across original workflow, legacy compatibility and new Calendar verification. All three transactions roll back with no fixture Pursuits remaining. This uses a minimal schema, not a complete production replay.
- Targeted Calendar/Pursuit/security/copy regression run: 254 tests passed before the final user-binding hardening; the focused final user-binding/Pursuit/Calendar suite passed 58 tests.
- Browser: 12 checks passed with three screenshots and no page errors. Covers both session types, rescheduling/reload, shared-change warning, per-person skip/reload, retained other sessions and failed-availability Retry.
- Type checking, design-token lint and production build passed. The pre-existing large-chunk warning remains.
- Full regression: 2,291 tests passed; two Admin City Picks tests hit the default five-second timeout, and the Code Entry worker failed to start within its timeout. All three affected files (including the final Calendar action tests) passed separately at normal timeouts: 38 tests. No timeout settings or unrelated product code were changed. The full run is therefore not reported as entirely green.
- The two short migration copies and compact verification copy were also executed against isolated PostgreSQL: all 65 assertions passed and fixture counts returned zero.

Reproduce the browser test:

```sh
VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_ANON_KEY=fixture-anon-key npm run build -- --outDir dist-calendar-integration --emptyOutDir
node scripts/e2e/calendar-pursuit-sessions.ts
```

## Release

1. Manually review and merge the PR. No agent merge or live migration was performed.
2. Apply only `supabase/migrations/20261116000000_calendar_pursuit_sessions.sql` from merged main. The two short `docs/verification/calendar-pursuits/apply-*.sql` files contain exactly those statements wrapped in separate transactions, each below 100 lines. Run both, in order, if copying from a preview that truncates long files.
3. Run `supabase/verification/calendar_pursuit_sessions_check.sql` or its whitespace-only compact copy in `docs/verification/calendar-pursuits/verify-compact.sql`. Its final `RESULTS: PASS ...` exception is intentional and rolls back test data. Any FAIL or ERROR needs investigation. Run `cleanup.sql` afterward; expected fixture count is zero.
4. Redeploy the existing `calendar-feed` Edge Function from merged main, including its shared modules. The existing deployment uses `--no-verify-jwt` because a calendar app authenticates with its private feed token, not an app JWT. This change does not create or replace the older feed-token setup or its secrets.
5. Confirm the production app deployment is Ready on the merged commit, then check an existing session, a newly scheduled session, a skip and a reschedule in Calendar. The new app/function requires the migration; coordinate promotion accordingly.

Example Edge Function command, for an already authenticated Supabase CLI:

```sh
supabase functions deploy calendar-feed --project-ref eyzokuhhbyidvmuqfmwm --no-verify-jwt
```

Repository policy requires a merged PR and written approval naming the exact migration before an agent can apply live SQL. The current session has no Supabase connector or database credentials.
