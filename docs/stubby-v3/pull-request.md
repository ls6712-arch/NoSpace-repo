**DO NOT MERGE — OWNER APPROVAL REQUIRED**

Stubby currently has a legacy ask engine and an onboarding-specific first-plan
matcher. This branch adds an opt-in V3 ask pipeline with consented private memory,
deterministic feasibility/ranking, and Claude discovery using existing Anthropic
API credentials. Legacy remains the default until explicitly switched.

Changes:

- Add owner-only memory editing/deletion, additive SQL/RLS, verification and rollback.
- Add bounded hosted research and tool-free structured extraction, shared candidate
  validation, evidence/uncertainty notices, hard filters and private picks/traces.
- Default V3 to Claude; keep OpenAI an explicit alternative with no automatic paid failover.
- Preserve earlier remote capability contracts/tests and existing guest, quota,
  signup, follow-up, SSE, admin and restock behavior.
- Fix compatibility defects found during rereview: preserve the birthday response
  notice and match saved Corner slugs/synonyms to ordinary candidate tags.
- Document the architecture and onboarding redesign. **The proposed new onboarding
  flow is not implemented in this PR.** Existing first-plan matching remains separate.

Validation:

- **2,050 tests passed across 218 files**, zero failures/skips; includes 186 V3/
  capability tests, eight new compatibility cases and 46/46 frozen golden outcomes.
- Frontend/backend types, offline Deno Edge entrypoint check, default/V3 test builds,
  lint, migration ordering against freshly fetched main and build-output checks pass.
- Chromium guest signup continuity and account memory edit/reload/delete pass with
  mocked Supabase/OAuth. Local PostgreSQL WASM isolation/deletion/rollback checks pass
  with synthetic Auth fixtures; these are not hosted-project checks.
- No historical migration, package manifest, lockfile, environment file or CI workflow
  change. Local merge simulation against main reports no conflict.

Merge holds:

- Run real Claude/model/search/structured-output and API-credit/usage checks, plus
  hosted migration/RLS/auth tests in an approved isolated Supabase project.
- Guest quick-context fields beyond city, the original-gear bridge and unified
  onboarding/V3 matching remain incomplete. Review that scope explicitly.
- Weather/calendar/routing, verified feeds and eligibility/benefit providers remain
  unconfigured. Current search results remain partial; language interpretation is bounded.
- Check GitHub CI and hosted mergeability on the final head. CI uses Node 22; local
  tests used Node 24. Main can trigger production database deployment.

Review: `docs/stubby-v3/compatibility-review.md`.
Evidence: `evals/stubby/compatibility-review-report.json`.
Guide: `docs/stubby-v3/guide.md`.
Setup/rollback: `docs/stubby-v3/environment-and-rollout.md`.

No production activation, deployment, live database write or merge was performed.
