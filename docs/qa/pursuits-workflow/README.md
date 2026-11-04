# Pursuits workflow: real UI review

These screenshots come from the running local app through Playwright, not image generation. Mobile viewport: 390 × 844. Desktop viewport: 1440 × 1000. Reduced motion enabled; browser timezone America/New_York. External requests are blocked in this local/demo browser test.

| Screen | Artifact |
| --- | --- |
| Session progress | [Mobile](01-progress-mobile.png) |
| Finish below the target | [Mobile](02-finish-mobile.png) |
| Comment on progress | [Mobile](03-comment-mobile.png) |
| Accumulated total | [Desktop](04-total-desktop.png) |
| Checklist | [Desktop](05-checklist-desktop.png) |
| Unified creation | [Desktop](06-create-desktop.png) |
| Friends and individual goals | [Mobile](07-friends-mobile.png) |
| Chat and a shoutout | [Mobile](08-chat-mobile.png) |
| Weekly sessions | [Mobile](09-plan-session-mobile.png) |

Friends/Chat/session screenshots use isolated local group fixtures rendered by the actual components. They do not establish that a production group or real account was used. The separate PostgreSQL verification switches actual database roles and checks authorization.

## Checks

- Browser: 24 workflow checks passed, 9 screenshots, no page errors. Covers all tracking types, reload persistence, target edits, finishing below target, reopening, comments, attendance, Chat, and a saved weekly series.
- PostgreSQL: 25 checks passed, with rollback verified. Includes invite privacy, independent finish state, tracking locks, private notices, duplicate shared sessions, reminders, checklist/total contributions, adding friends after solo progress, removal, paused/nonmember writes, outsiders, and blocking.
- Full unit/integration suite: 211 files and 1,893 tests passed.
- Notification-bell integration added afterward: 7 focused tests passed (5 new notice tests and 2 existing menu tests).
- Type check, lint, and production build passed. Build retains the existing large-chunk warning.
- Migration-version checks and git diff whitespace checks passed.

The repository's Calendar tests can exceed their existing five-second timeout under simultaneous build/browser load. Final full-suite validation uses one worker without simultaneous build or browser work. Tests are not disabled and their timeout settings are unchanged.

## Boundaries

No live migration, production write, or PR merge was performed. Live function definitions were reviewed from the owner's supplied SQL results. The remaining live columns/policies and actual PostgREST/cron integration still need staging review. In-app reminders are not push notifications or email. Profile reporting is reused; reporting a specific new message by its UUID is not a new report type.

Implementation and schema mapping: [verification notes](../../verification/pursuits-workflow/implementation.md).
