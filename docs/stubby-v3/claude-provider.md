# Claude provider and existing API credits

V3 now defaults to Anthropic. It can use the same Claude API key and workspace
as the existing Stubby scout. No new OpenAI key is required for that route.
All changes remain on `feature/stubby-context-v3`; nothing has been deployed.

## Routing

With `STUBBY_ASK_ENGINE=v3`, leaving `STUBBY_V3_PROVIDER` unset selects Anthropic.
Explicit `STUBBY_V3_PROVIDER=anthropic` does the same. The server uses:

1. Existing `ANTHROPIC_API_KEY` and optional `ANTHROPIC_WORKSPACE_ID`.
2. `STUBBY_CLAUDE_MODEL`, if supplied for V3.
3. Otherwise the existing `STUBBY_SCOUT_MODEL`.
4. Otherwise `claude-haiku-5-5`, matching the legacy scout's default.

The chosen model must support hosted web search and JSON-schema structured
outputs. If the legacy model lacks either capability, set STUBBY_CLAUDE_MODEL
to a compatible model before enabling V3; the code never silently substitutes
another provider.

Calls go only to `https://api.anthropic.com/v1/messages` with the existing
version/workspace authentication contract. Anthropic bills that API account
and its available credits. This does not inspect the credit balance or establish
that the key/workspace currently has funds or model/search access.

`STUBBY_V3_PROVIDER=openai` is an explicit alternative requiring OPENAI_API_KEY.
No missing key, credit error, timeout, malformed response or provider outage can
silently switch billing providers. Unknown provider values fail closed. The
legacy admin/restock/ask rollback path and its settings remain available.

## Shared intelligence and safety

The provider swap does not replace the V3 context, consent, feasibility, ranking,
source-evidence, authentication or quota services. Both providers share the same
candidate schema and runtime validators in modelContract.ts.

Claude uses two bounded Messages calls. Research has only the hosted
`web_search_20250305` tool and coarse public context. It cannot search with raw
asks, private goals, feedback or owned-resource lists. Extraction receives the
private context as data and has no tools, with `output_config.format` set to the
candidate JSON schema. Citation URLs are checked against search output, dates
and all candidate fields are validated, and Claude search evidence is always
partial rather than independently verified.

The response format, model names, tool definition and authentication were checked
against official `@anthropic-ai/sdk` version **1.4.0** type/source declarations
retrieved from npm. The SDK was inspected under /tmp, not added as a project
runtime dependency. This does not replace a live Anthropic request.

Each research attempt is capped at 2 searches or the lower server cap. There are
at most 3 HTTP calls total, including at most one transient-status retry per
phase within that total. Refusals, truncation, pause_turn and unexpected tool
calls fail honestly. The shared deadline and body/token limits still apply.
Input usage includes cache-read/cache-creation counts when returned. Billing
rates and live costs still need verification in the API account.

## Validation and activation

Provider tests cover the real Messages wire format with synthetic responses:
headers and workspace/model reuse, structured extraction, provenance, privacy,
malformed output, search errors, credit/auth errors, retry limits, caps, aborts
and oversized payloads. An authenticated handler integration test runs the full
Claude adapter and ranking pipeline and checks private-pick storage. Existing
OpenAI tests continue to run against the shared contract.

The current worker has no injected Anthropic API key; the deployed Supabase
function may already have one. Reuse its existing secret rather than duplicating
it. A live credit-funded call remains unrun until an approved test project and
its existing server binding are available. Configure no secrets in the browser
or chat. Enable the V3 server/frontend flags together in that approved test
project, following environment-and-rollout.md. Production deployment still needs
explicit owner approval.
