## What this changes

Starting a Pursuit now uses one form with Sessions, Total, Checklist, or Moments only. Participants can track individual or shared goals, correct progress, comment and reply, mention friends, plan weekly sessions, and receive opt-in in-app reminders. Finishing below a target preserves the actual progress instead of generating a completed-target recap.

New Pursuits use a versioned workflow. Legacy Pursuits, advanced measurements, and existing open-group hosting/joining keep their compatibility path. The existing Moment composer, Shelf progress cache, Inbox, and notification bell are integrated with the new workflow.

## Validation

- Rebased onto current main (`2db3bed`): 233 test files / 2244 tests passed.
- Local PostgreSQL: 25 authorization/behavior checks passed, fixture rollback verified.
- Playwright: 24 workflow checks passed; 9 real screenshots in [QA review](docs/qa/pursuits-workflow/README.md). Group screenshots use local fixtures, not production accounts.
- Type check, lint, production build, migration ordering against origin/main, and whitespace checks passed after rebasing.
- Existing large production-bundle warning remains.

## Rollout gates

**Do not merge for production rollout until the live columns/policies and staging integration have been reviewed.** Supplied live function definitions were checked; remaining live schema results are pending. No live SQL writes or migrations have been applied by this task.

New additive migrations, sequenced after current main:

1. `supabase/migrations/20261114000000_pursuit_workflow.sql`
2. `supabase/migrations/20261114000100_pursuit_workflow_reminders.sql`

Run `supabase/verification/pursuit_workflow_check.sql` on an authorized staging database after both migrations. PGlite tests use minimal prerequisite fixtures and do not validate all existing production triggers, PostgREST integration, or pg_cron scheduling. Reminders are in-app only. Reports reuse the existing profile-report path; this adds no message-specific report kind.

The owner merges this PR. Applying migrations from main requires the repository's separate written approval naming the files. No automatic merge or direct production deploy is requested.

## Checklist

- [x] Copy follows `docs/style-guide.md` (sentence case, shared plural/date helpers).
- [x] Approved terminology recorded in the glossary; no new capitalized product nouns.
- [x] Consistent action labels.
- [x] Real screens checked at 390px and desktop widths.
- [x] No test fixture content is shipped as an application default.
- [x] Unit tests and lint passed on the rebased branch.

Implementation and schema mapping: [release notes](docs/verification/pursuits-workflow/implementation.md).
