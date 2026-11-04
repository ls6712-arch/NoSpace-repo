# Pursuits workflow implementation

Implemented locally. No PR merged and no live migration applied.

## Workflow and compatibility

New Pursuits use `measure.workflow.version = 2`. Existing Pursuits keep their data and open through `LegacyPursuit.tsx`; the previous advanced builder remains available through More options. The Corner sheet routes personal/friend creation into the unified form, while existing open-group hosting and joining keep their original semantics.

The new workflow supports Sessions, Total, Checklist, and Moments only; optional targets/dates; individual or shared goals; edits and corrections; personal pause/finish/reopen; member invitations/removal/leaving; comments, one-level replies, mentions, appreciation, and Chat; session attendance, comments, weekly recurrence, occurrence/series edits, and honest progress/recaps.

Adding friends after solo progress preserves individual tracking. Converting individual progress into a shared total is not offered after logging. Checklist items have stable ids and are archived instead of removed. Attending never counts as completing a session. Shared session-count goals count an occurrence once; individual goals count it for each person who explicitly logs it.

## Data mapping

| Existing model | New use |
| --- | --- |
| `pursuits` | Identity, owner, title, taxonomy, visibility, shared lifecycle, and versioned workflow inside existing measure JSON |
| `pursuit_members` | Existing invitations, acceptance, membership, and join behavior |
| `pursuit_progress` | Legacy progress stays unchanged |
| `pursuit_sessions` and RSVPs | Legacy/open-group sessions stay unchanged |
| Local journal | Legacy data plus a derived compatibility cache for Shelf progress; never the authority for another participant's settings |
| `pursuit_contributions` | New workflow progress, occurrence date, stable checklist/session links, optional existing Moment link |
| `pursuit_personal_goals` | Individual target/date/lifecycle, muting, and reminder preference |
| `pursuit_discussion` | Chat, entry/session comments, replies, and mentions |
| `pursuit_meetings`, `pursuit_attendance` | New occurrences, timezone/series identity, attendance independent of progress |
| `pursuit_applause` | One appreciation per participant/message |
| `pursuit_notices` | Private in-app mentions, replies, changed sessions, and opted-in reminders |

RPC creation is atomic and retries retain the Pursuit id. Session batches save atomically. Contribution ids persist through retries. Composer-linked progress uses deterministic ids so a retry does not double count a Moment. Captions from restricted-audience Moments are not copied into group progress. Existing Moment comments and media permissions remain authoritative for linked Moments.

Progress and personal lifecycle are projected into existing Shelf cards and restored on sign-in. Shared configuration and group data refresh while the page is visible and on focus. Multi-person changes are server-confirmed, not reported as successful local writes.

## Migrations for review

- `20261112000000_pursuit_workflow.sql`: additive tables, policies, validations, rate limits, typed RPC boundaries, private in-app notices, and membership operations. Notices are included in the existing bell badge and its Mark all read action. No existing rows are converted.
- `20261112000100_pursuit_workflow_reminders.sql`: private reminder dispatcher and registration with existing pg_cron where available.

New tables use explicit restrictive member policies and joined-participant checks. Pending invitations are not membership. Blocked/removed users cannot read the new private collections. If a blocking relationship exists within a group, access to its new private collections is denied for the affected person rather than leaking partial conversations. Contributions stay attributed after a person leaves.

The owner supplied live definitions for `is_active`, `is_member`, `is_blocked_between`, `request_gate`, `is_pursuit_participant`, and `write_blocked`; these match the relevant assumptions. Live column/policy results remain pending. The migration preflight checks required functions before creating objects. Check the full live schema and migration integration on staging before deployment. Do not apply these files live from this task.

## Validation commands

```bash
npm ci
npm test -- --maxWorkers=1
npx tsc --noEmit
npm run lint
npm run build
npm run test:pursuits:db
node scripts/check-migrations.ts
# Start the local/demo server in another terminal:
VITE_SUPABASE_URL='' VITE_SUPABASE_ANON_KEY='' npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
PLAYWRIGHT_CHROMIUM=/usr/bin/chromium npm run e2e:pursuits
```

The database runner uses real isolated PostgreSQL through PGlite with minimal prerequisite tables and membership helpers. It applies both new migrations and runs the rollback-only verification script. It checks authorization, invite privacy, blocked/nonmember writes/reads, counter semantics, independent lifecycle, notification privacy/deduplication, and reminder dispatch. It verifies no fixture Pursuits remain. This does not verify every production trigger or PostgREST integration.

The browser test exercises actual app components in local/demo mode. Friend/group screenshots use isolated local fixtures; they are real rendered screens, not proof of deployed multi-user behavior. Backend access control is exercised separately in PostgreSQL. Final test counts/results are recorded in the QA README.

## Practical limits

- No live deployment, production writes, or real-account end-to-end validation occurred.
- In-app reminders require the reviewed migration and a working pg_cron dispatcher. They are not device push or email. PGlite tests the dispatcher directly; it cannot validate Supabase cron scheduling.
- Reminder preference is per Pursuit, applies to sessions you RSVP to, and is available to signed-in accounts.
- Group refresh is periodic (15 seconds while visible) and on focus, not websocket delivery.
- Reports reuse the existing profile-report dialog. This does not add a new report-target kind for individual Pursuit messages.
- Extra advanced legacy measurement settings and existing open-group sessions remain on their compatibility path. No automatic historical conversion is performed.
- No Stubby coaching, nested monthly goals, competitive ranking, or AI assessment was introduced.
