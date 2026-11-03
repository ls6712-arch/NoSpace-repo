# Compatibility review before PR creation

Branch: `feature/stubby-context-v3`; target: `main`.
Compared against freshly fetched `origin/main` at `7e552af`.

**Result:** two V3 compatibility defects were reproduced and fixed. Existing
legacy flows pass the local regression suite. The branch is suitable for a
**draft PR**, with the live-provider/database and product-scope holds below
explicitly retained. This review does not approve production activation or merge.

## Fixed in this review

1. **Birthday response compatibility.** V3 omitted `adultsLeftOut` even though
   the handler calculated it. The existing frontend uses that optional flag to
   decide whether to offer adding a birthday after adult picks are excluded.
   V3 now returns the same flag as legacy, for both JSON and SSE responses.
   Guests and verified 21+ callers do not receive an inappropriate account
   birthday prompt. The frontend still checks whether a birthday is on file;
   age eligibility is not weakened.
2. **Existing Corner interests did not reliably affect ranking.** Onboarding
   stores keys such as `arts-crafts/oil-painting`, while source tags can be
   `oil painting`. Literal substring matching missed those interests and could
   falsely match `art` inside `party`. V3 now normalizes slugs once per run,
   resolves supported activity synonyms/specific Corners, and uses word-boundary
   matching. Regression cases cover oil painting, life drawing/sketching,
   run clubs/jogging and unrelated word fragments.

The new tests reproduced six failures before the fixes. All eight added cases,
including the birthday negative controls, pass after the fixes.

## Compatibility checked

| Boundary | Finding |
| --- | --- |
| Default behavior | `STUBBY_ASK_ENGINE` still defaults to legacy; `VITE_STUBBY_V3` still controls the optional editor |
| Signup/onboarding | Existing step order, account/age gates, first-plan actions, invites and resume code remain in place |
| Guest continuity | Three-ask limit, signup, same-account chat/pick continuity and pending ask pass in the mocked browser flow |
| HTTP/stream responses | Existing ask/status/clarification/limit/SSE shapes remain; intelligence is optional, and the birthday flag is preserved |
| Authorization/quotas | Caller identity, guest readiness, atomic quota claims and account-only follow-up rules are retained |
| Public capability API | Earlier read-only contract, adapter, exports and original tests remain compatible; no original onboarding rewrite |
| Private memory | Owner-scoped editor/read/save/delete, anonymous denial, expected-account deletion, RLS and allowlist registration checked |
| Existing user data | Additive extension table; original onboarding, passes, picks and legacy tables remain; no historical migration edited |
| Provider selection | Reuses existing Anthropic bindings by default; OpenAI requires explicit selection; no paid automatic failover |
| Legacy scout paths | Admin/restock retain Anthropic and their existing access requirements |
| Deployment inputs | Package manifests, lockfile, environment files and CI workflow unchanged |
| Git history | Earlier remote capability commits retained; latest main is an ancestor; local merge simulation reports no conflict |

## Validation of the final code

- **2,050 tests passed, zero failed or skipped, across 218 files.**
- **186 V3/capability tests** across nine files; **46/46** frozen golden outcomes.
- Frontend and backend/evaluation TypeScript checks passed. Deno 2.9.6 checked
  the actual Edge entrypoint using the documented offline Supabase type alias.
- Production/default and V3 browser-test builds passed. The existing large
  bundle warning remains; default output was 835.68 KB gzip.
- Chromium guest and authenticated memory save/reload/delete flows passed with
  mocked Supabase and OAuth, under the production response headers.
- Local PostgreSQL WASM passed migration repeatability, owner/anonymous/cross-user
  isolation, malformed consent, stale-account deletion, physical deletion and rollback.
- Lint, whitespace, migration ordering against freshly fetched main, access/privacy
  tests and tracked-build-output checks passed.

Full-suite JSON was generated locally; the compact checked-in summary is
[`compatibility-review-report.json`](../../evals/stubby/compatibility-review-report.json).
Tests ran on the prepared Node 24 environment; GitHub CI uses Node 22 and still
needs to run on the published PR. The Deno type check is not a hosted deployment.
Browser mocks and local SQL fixtures do not prove live OAuth or compatibility
with a complete hosted Supabase schema.

## Remaining release holds and scope

- **Live integration:** no real Claude call, credit/model entitlement, cost or
  latency verification; no approved hosted Supabase migration/RLS/end-to-end test.
- **V3 inputs:** guest quick context currently contributes its city, not all mood/
  timing/budget fields. Generic original gear is not yet bridged into specific
  V3 equipment. Both gaps are documented rather than presented as complete.
- **Onboarding semantics:** the existing first-plan matcher remains separate
  from V3 and interprets budget, availability and pass coverage differently.
  The proposed redesign and shared-matching work are documentation only in this PR.
- **Provider coverage:** weather, external calendar, routing, independently
  verified feeds and benefits remain unconfigured. Search-derived results are
  partial; hard requirements with unknown facts can produce no match.
- **Hosted checks:** GitHub Actions and hosted mergeability are unverified.
  Merging main can trigger production database deployment according to repo CI.
  Complete staging validation and owner review before merge or activation.

## PR creation status

The branch can be pushed over the allowed GitHub Git transport. A fresh GitHub
API request was rejected with `Forbidden`; the runtime still lacks
`api.github.com` in its allowed destinations. The saved environment draft
already adds exactly that host but has not been published/applied.

The intended PR targets `main`, is a draft, and carries
**DO NOT MERGE — OWNER APPROVAL REQUIRED**. Its prepared description is in
[`pull-request.md`](pull-request.md). PR creation and hosted status checks remain
blocked until the saved network configuration is applied. No PR number or
successful creation is claimed by this review.
