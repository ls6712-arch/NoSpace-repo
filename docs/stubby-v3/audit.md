# Stubby 3.0 audit

Baseline: 7e552af78169a41276282ce15312293e6faaf1db. Work is isolated on
`feature/stubby-context-v3`. No production access or deployment is authorized.

## Existing behavior to preserve

- `stubby-scout/index.ts` wires verified Supabase users, caller-scoped profile
  reads, service-role inserts, strict origins, and atomic database quota claims.
- `handler.ts` supports admin drafts, scheduled restock, accounts, anonymous
  guests, streaming progress, one clarification, free follow-ups, and signup continuity.
- `intent.ts`, `ask.ts`, `contract.ts` implement deterministic constraints and
  versioned traces. `search.ts` uses Anthropic search with provenance link checks.
- Onboarding already stores Corners, weekly availability and monthly budget in
  owner-only `profile_private`, and self-reported passes in `user_passes`.
- A second, smaller taste model in `stubby_profiles` serves guests. Feedback is
  stored in `stubby_feedback`; models must not silently combine it without consent.
- 209 test files / 1864 tests and the mocked guest browser flow passed in setup.

## Gaps and risks

- No capabilityProfile files or docs/stubby-v3 existed. Equipment and passes are
  conflated. No per-activity budget, goals or explicit AI-memory consent control.
- The legacy intent parser treats indoors as at home and misses "have $20".
  Search and time parsing assume New York. Unknown prices can pass paid ceilings;
  a price range uses its minimum, and free text can imply free eligibility.
- Search citation membership proves a page was found, not pricing, availability,
  opening hours, weather or eligibility. Legacy ranking mostly follows model order.
- Scheduled restock and member asks can publish trusted-host events automatically.
  V3 must never share personal recommendations or call booking/message tools.
- Existing evals are substantial but do not cover capability consent, OpenAI,
  configurable timezone, or source verification levels.
- Schema snapshots are historical evidence only. No live schema connector or
  isolated database credentials are available; new SQL must be verified on a test
  database before enabling V3. No legacy migration is edited.

## Implementation strategy

Keep legacy admin/restock/guest contracts. Add an opt-in V3 ask engine behind
`STUBBY_ASK_ENGINE=v3`, reusing authentication, atomic quotas, streaming and
personal-pick persistence. Its one OpenAI orchestrator discovers candidates;
deterministic context, evidence, feasibility and ranking services decide the
response. No model tool can write data. Provider selection is server-side, and
Anthropic remains the rollback route. Missing provider access is reported honestly.

Add a separate owner-only capability extension with explicit consent, optional
onboarding reuse, independently revocable feedback learning and physical deletion.
Use existing tables for original onboarding data. No raw prompts/profile text in
traces. Web-derived claims remain partial; only trusted structured source adapters
can supply verified facts. Unknown hard constraints reject a candidate.
