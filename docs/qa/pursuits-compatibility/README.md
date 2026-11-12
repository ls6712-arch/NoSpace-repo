# Existing Pursuits compatibility

The profile's old Category / Goal / Number of Moments dialog was a separate creation component. It now opens `/pursuits/new`. Owner cards open `/pursuit/:id`. Archive and delete remain under More options.

Existing participants see the current detail layout without a bulk conversion. Original measured counts stay totals with their original units, decimal rules, starting amounts and descriptions. Scalar milestone amounts are not converted into invented completed checklist items. Old numeric goals retain their undated current amount. Date/feeling goals retain their description and deadline as Moments only. Profile Moment targets count actual linked Moments, never manual sessions.

Historical progress retains its original source table, id, author, timestamp, image and Moment link. Corrections change only amount/note. Original shared sessions and attendance remain in their original tables and keep their ids. Personal plans remain personal. More options links to the original advanced controls; one-off calendar plans retain their existing route.

Screenshots are from Chromium running the local app, 390 × 844, using isolated local fixtures and blocked external requests. They are actual UI captures, not production account screenshots or generated designs.

| Screen | Screenshot |
| --- | --- |
| Existing measured Pursuit, including its starting progress | [Paintings](01-existing-paintings.png) |
| Existing numeric goal | [Numeric goal](02-existing-number.png) |
| Original profile Moment target | [Moments](03-existing-moments.png) |
| Existing paused Pursuit | [Paused](04-existing-paused.png) |
| Existing feeling goal | [Moments only](05-existing-updates.png) |
| Unified creation reached from profile | [Creation](06-unified-creation.png) |

## Verification

The original browser suite passed 24 checks. The separate compatibility suite covers old progress correction, original metadata, combined totals, new entries and reload, original goal descriptions, Moment-only targets, status dates, resume/reopen and unified creation. It passed 17 checks, with six screenshots and no page errors.

The isolated PostgreSQL runner installs the original workflow migrations followed by the additive compatibility migration. Both rollback-only verification scripts pass, including all original 25 checks and 18 compatibility checks. It confirms fixture rows do not remain after either rollback. These tests use a minimal schema and test identities, not a replay of the complete production database.

The owner supplied the live columns, policies, historical triggers and workflow function definitions from `compatibility-live-schema.sql`. The required columns and existing workflow functions match this implementation. The new profile reader delegates visibility/redaction to the live original reader; only a fully enrolled owner gets enriched progress. Both guest and non-owner equality are checked. The security allowlist explicitly records this same public profile surface.

No PR merge, live migration, production write or deployment was performed. Type checking, design-token lint and the production build pass. The build retains the existing large-chunk warning. The final full run completed 235 files / 2,268 tests: 2,265 passed and three Login tests exceeded their default five-second timing budget. An unchanged isolated rerun passed those three but timed out a different Login test. The isolated diagnostic with `--testTimeout=30000` passed all 23 Login tests. No Login code, test or repository timeout was changed. All Pursuits, profile and security tests pass in the full run.

## Supabase and release order

1. Review and merge the compatibility PR manually.
2. In Supabase SQL Editor, run **only** `supabase/migrations/20261115000000_pursuit_compatibility.sql` from the merged main branch. The two previous workflow migrations are already installed, as confirmed by the owner.
3. Run `supabase/verification/pursuit_compatibility_check.sql`. Its final `RESULTS: PASS ...` exception is intentional and rolls back all fixtures. Any FAIL or ERROR requires investigation.
4. In a fresh query, confirm cleanup with the SQL below. Expected: zero.
5. Let Vercel build the merged main commit, confirm the production deployment is Ready and uses that commit, then refresh the app. Check Start a Pursuit on the profile, an existing measured Pursuit, an existing Moment target and a joined friend's Chat/session.

```sql
select count(*) as compatibility_fixture_rows
from public.pursuits p
where p.id like 'compatibility-check-%';
```

The compatibility migration installs adapters, restricted editing/attendance RPCs and owner profile summaries. It does not bulk rewrite existing Pursuits or move/delete their progress. Agents must follow CLAUDE.md: a live migration requires a merged PR and written approval naming the exact file. Manual owner execution remains available.

Commands:

```sh
npm test -- --maxWorkers=1
npx tsc --noEmit
npm run lint
npm run build
npm run test:pursuits:db
npm run e2e:pursuits
npm run e2e:pursuits:compatibility
```

Run browser checks against a local app with empty Supabase configuration. Use `PURSUIT_TEST_ORIGIN` if it runs on a port other than 5173. Finish browser/build work before the full unit suite to avoid the repository Calendar tests' existing five-second timeout under load.
