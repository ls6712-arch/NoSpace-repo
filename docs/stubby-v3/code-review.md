# Second code review and reasoning validation

Version: `stubby-v3.2`. All work remains on `feature/stubby-context-v3`.
No deployment, merge, production infrastructure change or live data write.

## Findings fixed

The first pass did not cover enough practical language. A new 26-case reasoning
batch initially failed 23 cases; those failures drove the corrections below.
They were not skipped or converted into expected failures.

| Finding | Correction and evidence |
| --- | --- |
| Negated activities/settings were read as positive requests | Request parser separates positive and excluded topics; tests cover not pottery/chess, not outdoors, and do not stay home |
| Decimal/word budgets and free availability were misread | Preserve cents, distinguish free time from admission, recognize dollar amounts and thousands separators, and abstain on unsupported currencies |
| Time constraints were too broad | Tonight starts in the evening; explicit dates, between/after/before and morning/afternoon windows are enforced; invalid dates, contradictory windows and ambiguous/nonexistent DST times abstain |
| A saved city overrode the current destination | Recognized current-city requests take precedence; equivalent New York names normalize |
| The activity list was too small | Public Corner names extend the bounded vocabulary; specific Corners are retained and aliases such as ceramics/pottery remain equivalent |
| Saved negative preferences could be treated as positive signals | Explicit exclusions apply to broad asks; a current explicit activity can override a saved dislike; learned feedback remains soft |
| Out-of-town ideas bypassed locality checks | Every option away from home needs a matching city; unknown travel is disclosed, or blocks a requested travel ceiling |
| Listing pages and unknown family restrictions could pass | Events need their own page; unknown child eligibility is rejected; known 21+ restrictions require both authorization and an adult request |
| Stale/weak duplicates could suppress a valid source | Deduplicate after feasibility and prefer stronger valid evidence; verified options remain ahead of weaker novelty |
| Calendar failure could leave a verified label | Failed context providers downgrade confidence and surface uncertainty on the recommendation |
| Current resource changes were ignored | Resources explicitly stated now are usable; a stated loss/removal overrides saved equipment |
| Follow-ups could round cents or fall back to earlier hours | Cheaper preserves cents; Later cannot return an earlier slot after its new lower bound exceeds the window |
| Hard constraints beyond 200 characters could disappear server-side | V3 retains the full validated 500-character server request; legacy length remains unchanged |
| Provider caps and timestamps were insufficiently strict | Honor the server search cap; reject impossible ISO dates, clock rollover and invalid offsets; no paid calls for impossible time/currency requests |
| An account switch could redirect a stale editor action | Key editor state by account, verify the expected owner on reads/writes, and require an expected-user UUID in the deletion RPC |
| Clarifying empty-state text was overwritten | Preserve specific time/currency fallback guidance through the handler |

The account-switch fix is tested in both client-unit tests and actual PostgreSQL:
a caller cannot delete another account's information by using a stale expected id.
No already-applied historical migration was edited. The new capability migration
is still undeployed; its required RPC argument was corrected before deployment.

## Executed checks

- Full regression suite: **1,994 passed, 0 failed, 0 skipped**, across **216 files**.
- V3-specific tests: **130** across **7 files**, including **64 added during this
  review**. The original 1,864 tests also pass.
- Golden comparison: **46/46** expected outcomes. Both the actual legacy checker
  and V3 process the same synthetic candidates with frozen clocks. This measures
  deterministic filtering and selection, not live model quality.
- Frontend and backend strict TypeScript, lint, copy, budget privacy, migration
  ordering, access allowlist, build-output and whitespace checks passed.
- Deno **2.9.6** checked `stubby-scout/index.ts` and its dependency graph. The
  offline check aliases JSR's Supabase import to installed npm SDK **2.116.0**;
  it does not claim a live JSR fetch or hosted Supabase runtime validation.
- Default production build and V3-flagged browser build passed. The existing
  large-bundle warning remains; default gzip is 835.68 KB, V3 test build 838.33 KB.
- Chromium guest flow passed: readiness, limits, mocked Google signup return,
  original chat, saved picks and sent draft. Authenticated memory save/reload/
  confirmed deletion passed with mocked Supabase and the expected-user RPC input.
- PostgreSQL WASM checked migration repeatability, owner access, anonymous denial,
  cross-user reads/writes/updates/deletes, consent validation, stale-account
  deletion refusal, physical caller-only deletion and rollback.
- Changed files contain no candidate API/private keys in the pattern scan. No
  raw request/profile logging was added. Existing .env and dependency locks are unchanged.

Machine-readable results: [review-report.json](../../evals/stubby/review-report.json),
[report.json](../../evals/stubby/report.json), and
[sql-report.json](../../evals/stubby/sql-report.json).

## What this proves and what remains

These checks show stronger request interpretation, deterministic safeguards and
regression coverage. They do not measure whether a live model consistently finds
interesting, accurate recommendations. Live OpenAI credentials and an approved
isolated Supabase project are still missing. Weather/calendar/travel/benefits and
structured verified-source adapters remain unconfigured; uncertainty is not
replaced with invented facts. General natural-language understanding is bounded,
including a finite recognized-city vocabulary. Unsupported requests still need
careful review and live evaluation.

Production approval is still required. Full Stubby 3.0 completion and readiness
for the final PR are not claimed.
