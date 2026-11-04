# Security and privacy review

- Existing verified tokens, allowed origins, bounded request bodies and atomic
  `claim_stubby_turn` quotas run before model work. User ids never come from the
  body. Guests retain IP/global caps and cannot use member follow-ups or memory.
- Anthropic and optional OpenAI keys exist only in Edge Function environment secrets. No `VITE_` key,
  browser SDK, response-body error logging or process-environment dump was added.
- Capability reads/writes verify the caller and use explicit owner filters plus
  RLS. Anonymous JWTs fail closed. The table/RPC are registered in both access
  allowlists. No historical migration was changed.
- Consent is enforced in code before model context construction, not just in the
  prompt. Feedback opt-in is independent. Deletion removes feedback and the
  extension atomically and requires the displayed account to match the authenticated account; account deletion cascades the extension. Original
  onboarding and existing picks/traces follow their existing lifecycle.
- Private goals/raw asks cannot enter hosted-search queries: phase one receives
  only coarse, bounded public constraints. Phase two has no tools. OpenAI requests use
  `store:false`; Anthropic receives no unsupported storage flag. Review the
  selected provider’s account retention/data-processing settings. Neither the
  client flags nor this code promise zero provider retention.
- There are no callable purchase, booking, message or database tools for the
  model. Tool definitions are server constants. Retrieved instructions cannot
  grant tools or bypass output validation and deterministic hard filters.
- URLs must be HTTPS, without userinfo, unusual ports or private/local literals.
  Models cannot choose a server fetch target: the only HTTP API destination in
  each provider adapter is a constant. A source URL must come from search citations.
- Runtime adapters receive cancellation, have bounded response sizes, candidate
  counts and deadlines. Invalid JSON, refusal, truncated output, unknown fields,
  missing offsets, fabricated URLs and bad numeric values fail honestly.
- The new private trace contains versions, counts, codes, source evidence and
  usage. It contains no raw ask, profile values, feedback text, user ids or API
  keys. Source data is capped before persistence. Existing trace size/RLS apply.
- Self-reported memberships are never proof of eligibility, including unexpired
  ones. Search citations are never elevated to trusted structured verification.
- No new automatic deletion scheduler is installed: the extension lasts until
  the owner deletes it or their account. Learning reads at most 60 days of
  feedback. Existing guest retention remains unchanged.

Local PostgreSQL tests execute the migration twice, the always-rollback SQL
verification, cross-user reads/writes/updates/deletes, anonymous denial,
malformed consent, physical caller-only deletion and rollback. They use synthetic
Auth functions, not the complete hosted schema. Hosted auth, gates, extensions
and policies still require verification in an approved test project.

Claude is the default V3 provider and uses the existing ANTHROPIC_API_KEY and
optional ANTHROPIC_WORKSPACE_ID. The provider is selected before key validation
and model work. Unknown names, missing selected-provider keys and credit errors
fail closed. There is no automatic cross-provider billing fallback. The legacy
admin/restock calls remain on their existing Anthropic path.
