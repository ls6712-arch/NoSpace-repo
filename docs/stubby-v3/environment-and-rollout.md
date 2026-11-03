# Test environment, deployment and rollback

No deployment, production change, live migration, live data write or PR merge
was performed. The owner must explicitly approve any production action.

## Server configuration

Use an isolated Supabase test project with the existing application schema.
Keep credentials in its server-side secret settings; never send values in chat.

| Name | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | The existing Claude key. V3 is Claude only (Nov 3, 2026): no other provider, no failover |
| `ANTHROPIC_WORKSPACE_ID` | Reuse the existing optional workspace binding |
| `STUBBY_CLAUDE_MODEL` | Optional V3 override; otherwise reuse STUBBY_SCOUT_MODEL, then claude-haiku-5-5 |
| `STUBBY_V3_TESTERS` | User ids (comma separated) that get V3, with legacy run alongside on the same ask (shadow compare); everyone else stays on legacy; guests never test |
| `STUBBY_ASK_ENGINE=v3` | V3 for everyone. Only when the founder says so; then the legacy ask engine is removed in a separate PR |
| `STUBBY_SCOUT_ENABLED=true` | Existing kill switch |
| `STUBBY_IP_SALT` | Existing guest HMAC salt and readiness requirement |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase-injected server bindings |
| `ALLOWED_ORIGINS` | Leave unset for onsoosh.com; add a preview origin only to test from one |

Retain the existing user/guest/IP/global cap settings. Claude V3 needs HTTPS to api.anthropic.com,
the existing destination. Local mocked checks use no API credentials.

Frontend: nothing is needed for testers. `VITE_STUBBY_V3=true` only shows the What Stubby knows
editor (Settings and onboarding) to everyone, so keep it off in production until V3 is on for
everyone; V3 uses the onboarding answers without it.

## Testing on production, per account (founder, Nov 3, 2026)

1. Merge (applies `20261112000000_stubby_capabilities.sql`, approved by name first), deploy
   `stubby-scout` from main, read it back and record it (`scripts/record-stubby-deploy.ts`).
2. Run `supabase/verification/stubby_capabilities_check.sql`; confirm no fixture rows remain.
3. Add the founder's user id to `STUBBY_V3_TESTERS`. Their asks show the V3 deck; the legacy deck
   for the same ask is saved alongside in `stubby_asks.decision_trace.legacy` (titles, kinds and
   reason counts only, never the ask), so the two can be compared.
4. V3 for everyone (`STUBBY_ASK_ENGINE=v3`) only when the founder says so. The care step needs its
   expert review and the resources their check against each service's page first
   (`v3/careResources.ts`).

## Approval gates and sequence

1. Owner supplies the approved test project ref and configures server secrets.
   Confirm the project identity before any remote write; never use the existing
   checked-in project implicitly. Inspect its current schema read-only.
2. Review `20261112000000_stubby_capabilities.sql` against the test schema. It
   creates only the extension, RLS and caller-scoped deletion RPC and registers
   their narrow access. Apply only the approved migration in the test project.
3. Run `supabase/verification/stubby_capabilities_check.sql` there using two test
   account users. It ends in RESULTS and rolls back. Confirm no fixture remains.
4. Deploy the Edge Function to that test project using the existing deployment
   process (`--no-verify-jwt` remains necessary for legacy restock); application
   auth still runs for asks. Do not deploy any production project.
5. Build/test the frontend with the test bindings. Run real guest and member asks,
   limits, consent revoke/delete, signup return, and the adversarial scenario set.
   Review factual quality, source freshness and unsupported-constraint behavior.
6. Record live latency and the selected provider’s token/search usage, enforce provider project
   spend limits, review data-processing settings and compare with the baseline.
7. Only after outstanding gates pass, create a PR targeting main, clearly labeled
   **DO NOT MERGE — OWNER APPROVAL REQUIRED**. Do not merge or publish production.

## Cost and latency bounds

There are two model phases, one allowed transient HTTP retry across them, and
at most three total API calls per ask. Hosted search is the only tool, with at
most two searches per research attempt (a retried research call may be charged
again). Phase outputs cap at 2500/4000 tokens, input text/candidate payloads are
bounded, and V3 context/discovery orchestration has a 35-second deadline
(45-second maximum for injected configurations). This does not bound all database
work or end-to-end UI latency. The UI uses the existing stream and Stop behavior.
No second search round, agent continuation loop or background inference exists
in V3. Existing atomic daily quotas bound ask volume. These are request bounds,
not a guaranteed dollar bill; provider spend limits and measured live latency
remain required. Mock token counts are not live cost measurements. Claude calls use the selected
API key/workspace’s Anthropic billing and available credits; no balance check or
live charge has been performed. A credit/authentication failure never triggers
automatic spending anywhere else. See claude-provider.md for the tested provider contract.

## Rollback

Empty `STUBBY_V3_TESTERS` (and unset `STUBBY_ASK_ENGINE`); retain the Anthropic key
and existing legacy function files. `STUBBY_SCOUT_ENABLED=false` is the immediate
kill switch. The capability table can remain safely unused. If approved, apply
`rollback_20261112000000_stubby_capabilities.sql` after V3 is disabled; it removes
only the extension/RPC/allowlist entries, irreversibly deleting extension data.
It leaves original onboarding, passes, picks and legacy tables intact.
