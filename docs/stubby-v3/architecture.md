# Stubby 3.0 architecture

Implementation lives on `feature/stubby-context-v3`. Enable only in an approved
test environment until the live gates in final-audit.md pass.

One selected provider powers the orchestrator. Claude Messages is now the
default, reusing the existing Anthropic API/workspace bindings and configured
Claude model. OpenAI Responses is available only by explicit server selection.
This is not a multi-agent system. The existing handler remains responsible for identity,
guest readiness, strict request parsing, atomic database quotas and SSE. V3 adds:

| Responsibility | Implementation |
| --- | --- |
| Personal intelligence | shared capability contract; owner-scoped remote editor; separately opted-in feedback |
| Context | server clock, IANA timezone, local calendar windows, city, budget, equipment and consent precedence |
| World discovery | normalized `DiscoveryAdapter` pipeline and Claude and optional OpenAI hosted web search adapters |
| Feasibility | deterministic time, price, location, setting, travel, age, equipment, membership and calendar filters |
| Recommendation | bounded deterministic score, novelty penalty, topic diversity and reasons |
| Evidence | safe source URLs, 24-hour check freshness, provider versus search provenance, explicit uncertainty |

Files are under `supabase/functions/stubby-scout/v3/`. Ports are typed in
`types.ts`; data, prompt and response contracts have explicit versions.
No new runtime dependency or service is introduced to the application. Both
adapters share modelContract.ts for privacy, schema, provenance and validation.

## Ask lifecycle

1. Authenticate through existing Supabase Auth/access checks. Claim the existing
   atomic ask quota, including guest IP/global caps and free-follow-up rules.
2. Load capability extension as the caller. Missing/invalid data fails closed.
   Without memory consent no saved onboarding or learned data enters V3.
   Guests can use the city they explicitly submitted in the quick-context card;
   they cannot create durable capability memory.
3. Derive a hard request contract using the server clock and selected timezone.
   Current typed budget/time/setting/city wins over saved defaults. Saved monthly
   budget, weekly windows, goals and resources inform ranking. Monthly budget is
   not a statement of money remaining. Existing passes remain self-reported.
4. Run hosted search with coarse constraints only. It receives no raw ask,
   private goal, equipment list, calendar content or feedback. The tool-free
   extraction phase receives request/profile data as untrusted JSON and produces
   a strict versioned schema. Only URLs actually supplied by search are accepted. Public Corner names extend the activity vocabulary without putting raw requests or private goals in hosted-search queries.
5. Normalize, classify, check evidence, filter hard constraints, deduplicate,
   then rank. Stronger valid evidence wins over weaker duplicates, and diversity does not displace verified matches. Unknown price fails an explicit budget; a maximum total price is
   used rather than the minimum in a range. Indoors can mean a venue; at home
   means home. Unknown travel fails an explicit travel ceiling. Self-reported
   memberships never qualify a discount or admission claim.
6. Return verified, partial, or no verified match. Web-search output is always
   partial, even if the model calls it verified. A trusted structured adapter
   would be needed for fully verified recommendations. No match has an honest
   fallback and preserves the existing empty-state actions.
7. Save only private picks, source links, uncertainty and a bounded owner-only
   trace (version, counts, reason codes, token usage and source check timestamps).
   There is no V3 write to City picks, no booking, purchase, sharing or messaging.

`legacy` remains the default ask engine. Anthropic admin/restock paths remain
unchanged. The small timezone refactor in intent.ts retains New York defaults
for legacy callers and adds explicit zones for V3. Existing guest and member
request/response contracts remain compatible; the new intelligence notice is
optional.

## Personal information

Onboarding's Corners, windows, monthly budget and passes stay in their original
owner-only tables. The optional editor appears in onboarding and `/account`
only when `VITE_STUBBY_V3=true`. It adds equipment, goals, explicit preferences,
per-activity budget, timezone, memberships/expiry, and three independent consent
choices. Every choice starts off. Original answers can be edited through the
existing onboarding route. The editor shows load/save failures and never
replaces unreadable information with an empty successful save.

`stubby_capabilities` is one bounded owner-only JSON row per non-anonymous
account. `forget_stubby_memory(expected_user)` physically removes the extension and feedback
in one caller-scoped transaction. The expected account must match the verified caller, so an account switch cannot redirect deletion. Imported onboarding remains in the original
tables and is no longer used by V3 after deletion; users can edit those answers
or delete their account separately. Feedback is a separate type, used only with
its own consent, limited to the newest 20 entries from the last 60 days. No
background inference or automatically generated memory is written.

## Honest boundaries

Weather and calendar have typed context ports and tested unavailable fallbacks;
no live provider is configured. Travel and opening/admission details require
source facts. Unknown details are disclosed or block a hard requirement.
No Instagram, TikTok, Pinterest or YouTube API/scraping integration is claimed.
Approved structured event, benefits and trend adapters remain unconfigured.
The deterministic intent parser supports a bounded vocabulary, not arbitrary
natural-language constraints. Broad semantic interpretation and live quality
coverage remain review gates; unsupported constraints must not be described as
verified. This is a locally validated milestone, not the full definition of done.
