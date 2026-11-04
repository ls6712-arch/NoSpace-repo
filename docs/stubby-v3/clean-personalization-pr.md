## Changes

Onboarding now supports the three human preference questions, one interest/exploration/Skip, an editable saved summary and contextual practical questions after useful suggestions. Photos and invitations follow suggestions. Guest conversion, Back/resume, care, age/access/quota checks and existing plan actions remain.

Shared normalization connects private preferences to Stubby, first plan, Home, Discover and calendar ranking/eligibility. Unknown cost is never free; monthly money is not divided into outings; passes do not prove admission; equipment distinguishes requirements, optional items and alternatives. Calendar picks require known duration for exact fitting. Scoped rejection reasons preserve opt-in learning and keep temporary feedback out of lasting dislikes.

Private snapshot/CAS APIs prevent failed reads, stale editors and account switches from replacing answers. Additive migrations preserve legacy fields and V1 capability JSON, mirror explicit edits atomically, and maintain revision/answer-state metadata. Public catalog traits contain no private data. Claude and current main's care/mobile navigation changes are preserved.

## Compatibility and rollout

Four new migrations `20261113000000` through `20261113000300`, each with verification and rollback. No historical migration or production deployment record is edited. `VITE_HUMAN_ONBOARDING` defaults off until database APIs/readers are deployed and isolated-project checks pass. Existing global V3 and per-account shadow controls are retained. Explicit removals override legacy resource bridges; unqualified old rejections become temporary while opted-in positive feedback is preserved.

## Validation

- Full suite: 2,211 passing tests, no failures, after rebasing onto main `efb6284`.
- Frontend/backend TypeScript, Deno Edge check, lint, production build, catalog sync, migration-order and access allowlist checks.
- Real SQL in isolated PGlite: two users/RLS, atomic rollback, stale edits, old clients, guests, removal/deletion, scoped opt-in feedback, SQL/TS parity and Home eligibility.
- Production-build Chromium fixtures: guest signup continuity, memory edit/reload/delete, new onboarding persistence/Skip/Back/summary editing, failed reads and resource/cost reranking. Mobile 390px and desktop 1440px inspected.
- Frozen provider-fact comparison: 51/51 scenarios retain main's outcomes. No live usefulness or cost claim.

Live Supabase migrations/Auth/PostgREST, real OAuth and Claude/provider validation remain release gates because no approved isolated project/credentials were available. Production was not merged or deployed. Vite retains its large-chunk warning.

## Rollback

Disable the UI flag and restore the approved prior app/Edge build, retaining additive data. If schema reversal is needed, export new private data first and apply supplied rollback files in reverse order; column removal is destructive. See [implementation, architecture and release gates](https://github.com/ls6712-arch/NoSpace-repo/blob/feature/clean-personalization/docs/stubby-v3/clean-personalization-implementation.md) for the exact sequence and checks.
