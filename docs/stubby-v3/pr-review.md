# Pull request review

Target: `main`. Branch: `feature/stubby-context-v3`.
Required PR label/title marker: **DO NOT MERGE — OWNER APPROVAL REQUIRED**.
Recommendation: **draft pending staging verification**.

## Scope and preserved work

The feature is opt-in: existing production asks remain on the legacy engine until
STUBBY_ASK_ENGINE=v3 is selected, and the memory editor requires VITE_STUBBY_V3.
V3 defaults to Claude and uses the existing Anthropic key/workspace/model.

The remote branch already contained commits through
`f53c47ba1776c89e91ac6089601deaa3a3debe06`. They were merged, not overwritten or
force-pushed. The read-only onboarding capability contract, adapter, original
five tests and implementation-baseline.md remain available. Its pure contract
now lives in `_shared/onboardingCapability.ts`, re-exported from the original
public module. The consented memory extension is a separate contract. Both use
one pass-kind classification, so gear/bikes do not become membership claims.

## Review findings resolved

- Preserved the remote API and tests rather than replacing the similarly named
  local files. Added caller verification to the read-only adapter.
- Carried original pass kinds through server profile reads and reused the gear
  classification when constructing the V3 membership context.
- Fixed budget clauses such as “no more than $20 on pottery” incorrectly
  excluding pottery through negation scope.
- Made an unrecognized named destination fail closed rather than silently
  searching the saved home city. The fallback asks for city confirmation.
- Reviewed authentication, guest/IP/global quotas, consent, expected-account
  deletion, source provenance, provider selection, model-tool boundaries,
  private-pick persistence, frontend compatibility and migration ordering.
- Kept provider errors from triggering paid cross-provider fallback. Claude and
  OpenAI use the same runtime candidate validation and deterministic hard rules.

## Validation of reconciled code

- **2,042 tests passed, 0 failed, 0 skipped**, across **218 files**.
- **178 V3/capability tests**, including all preserved earlier capability tests.
- **46/46** frozen golden outcomes; actual baseline checker comparison retained.
- Frontend/backend strict TypeScript, Deno entrypoint check, lint, copy/privacy/
  access allowlist and build-output checks passed.
- Migration comparison with freshly fetched origin/main passed (220 files).
- Production/default and V3 browser-test builds passed. Chromium guest signup/
  limits/return and authenticated memory save/reload/delete passed with mocks.
- Local PostgreSQL WASM migration repeatability, RLS, malformed consent,
  cross-user denial, stale-account deletion, physical deletion and rollback passed.
- No historical migration, .env, package manifest or lockfile was changed.

Full machine-readable evidence: `evals/stubby/pr-review-report.json`.
No additional unresolved critical regression was found in this local review.
That is not approval of the unexecuted release gates below.

## Merge holds

1. Real Claude model/search/structured-output compatibility, account credits and
   live latency/cost have not been tested. This worker has no selected-provider key.
   Reuse the existing Edge Function secret in an approved isolated test project.
2. The new migration/RLS/deletion RPC has not been verified against that project's
   complete hosted schema. Local PostgreSQL tests use synthetic Auth fixtures.
3. Weather/calendar/travel, verified feeds and benefits providers remain
   unconfigured. Current web-derived candidates remain partial; broad natural-
   language interpretation is bounded. This PR is a foundation, not full V3 completion.
4. GitHub Actions and mergeability must be checked on the final published head.
   The repository CI notes that merging main can trigger production database
   deployment, so a green local suite is insufficient approval to merge.

The owner must review the migration, staging results and the final PR before
merging. No production deployment, live data write or merge was performed here.
