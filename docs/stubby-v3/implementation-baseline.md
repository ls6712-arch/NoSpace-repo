# Stubby 3.0 — implementation baseline (draft)

Branch: `feature/stubby-context-v3`. Do not deploy until reviewed and evaluated.

## Confirmed repository architecture
- React 18 / TypeScript / Vite, React Router hash routes; calendar at `/#/calendar`.
- Existing Stubby is implemented: `src/app/pages/Calendar.tsx`, `src/app/components/stubby/`, `src/app/lib/stubbyAsk.ts`, `supabase/functions/stubby-scout/`.
- Server-side Supabase Edge Function `stubby-scout` handles asks, guest limits, admin scouting and scheduled restocks.
- The current Edge Function defaults to an Anthropic Claude model; migration to OpenAI must be explicit and regression-tested.
- Existing profile reads `profile_private` picks/free_windows/monthly_budget/city/area, `user_passes`, and active `pursuits`.
- Existing `stubbyPicks` already performs client-side calendar-aware ranking; preserve its behavior until benchmarked.
- Existing E2E script `scripts/e2e/guest-stubby.ts` tests guest-to-account continuity and guest limits.
- Existing calendar comment indicates New York time. Global support requires timezone audit and migration.

## Build sequence
1. Baseline tests and failing-example corpus; inspect scout handler, search, taste, ranking, SQL, time/location helpers and frontend integration.
2. Add typed context resolver (server clock, IANA timezone, explicit vs confirmed vs inferred location, request time window, calendar availability). Unknown must remain unknown.
3. Add weather adapter with TTL and provenance; never fabricate weather.
4. Add feasibility validation (event start/end, registration, travel, preparation, cost, group size, weather hazards). Distinguish feasible, infeasible, unknown.
5. Add evidence-backed source connectors, trend observations, freshness and geographic coverage; retain current working scout until replacement is validated.
6. Add consented preference feedback and user-correctable memory; no unconsented location or mood inference.
7. Add Surprise Me and optional goal reminders only after ranking and consent evals pass.

## Contracts
ContextResolutionV1:
- requestId, resolvedAtUtc, userTimezone, requestedWindowUtc, location { city, countryCode, source, confidence, preciseConsent }, availableMinutes, budget, groupSize, mood?, energy?, weather { observedAt, source, validity }, missingFields.
- `source` enum: explicit_request | permissioned_device | confirmed_profile | inferred_unconfirmed | unknown.
- Never use inferred_unconfirmed as precise current location.

FeasibilityResultV1:
- candidateId, status: feasible | infeasible | unknown, reasons[], verifiedAtUtc, evidenceIds[], requiredMinutes?, estimatedCost?.
- Hard constraints are deterministic. Unknown is not equivalent to feasible.

RecommendationV1:
- candidateId, rank, explanation, evidenceIds[], freshness, feasibility, preferenceSignalsUsed[], isExploration.

## Release gates
- No regressions in guest limits, authentication, profile isolation or E2E guest signup.
- No OpenAI or other provider secrets in browser bundles.
- No false assertions of live events, weather, membership entitlement or precise location.
- Test midnight, DST transitions, travel, stale weather, canceled events, expired offers, no-source and API-outage scenarios.
- Audit RLS for every new personal table, and provide consent, correction and deletion paths.
- Deploy only after explicit review and staging validation.

## Open decisions
- Source/API access rights, weather provider, queue implementation, OpenAI model and budgets, regional coverage.
- Full production environment and live Supabase schema are not audited by this document.
