# Pause: server-side session revocation — plan (not implemented)

Nothing here has been built. This is the design question and a recommended
approach, for review before any code changes.

## Why this matters

`paused_at` (migration a, already applied) makes a paused account invisible
to *other people's* queries. It does nothing about the paused account's
*own* already-open sessions — a browser tab left signed in on another
device, or a session token that leaked, keeps working exactly as before:
posting, editing the profile, everything. If pausing is meant to mean
"nothing happens under this account while it's paused," not just "other
people can't see it," the account's existing sessions need to be killed
the moment `paused_at` is set, not just left to expire naturally on their
own schedule (Supabase's default access-token lifetime is an hour, so
"naturally" could mean up to an hour of continued activity).

## Mechanism options

**Recommended: an Edge Function the client calls to pause, not a raw
`UPDATE`.** Pausing stops being "the client sets a column" and becomes "the
client calls a function that sets the column and revokes sessions in the
same step":

1. Client calls a new Edge Function (`pause-account`), authenticated with
   the caller's own JWT (proves who's asking — no service role key ever
   reaches the client, same rule the brief already sets for hard deletion
   in section 4.7).
2. The function verifies the JWT, sets `profiles.paused_at = now()` for
   that user (using the service role key server-side, bypassing RLS
   deliberately since this is a trusted server context, not the client),
   then calls `supabase.auth.admin.signOut(userId, scope)` with the same
   service role key.
3. `resume` is the mirror: another Edge Function, clears `paused_at`. No
   session revocation needed on resume — the whole point of pausing was to
   sign them out, so resuming naturally requires signing back in first.

**Alternative considered: a Postgres trigger using `pg_net` + Vault.**
Supabase supports firing an async HTTP call from a trigger (`pg_net`),
with the service role key pulled from Vault (`vault.decrypted_secrets` —
already present in this project) instead of hardcoded in SQL. This would
make pausing work even from a direct `UPDATE profiles SET paused_at = ...`
with no Edge Function involved. **Not recommending this as the primary
approach** — a trigger calling out to an external HTTP API is harder to
observe when it fails (no request/response to inspect from the client,
just a fire-and-forget queued call), and mixes "data changed" with "an
external side effect happened" in a way that's easy to lose track of
during review. Worth keeping in mind only as a fallback if the Edge
Function path turns out to be impractical for some reason.

## Scope of revocation

`supabase.auth.admin.signOut(userId, scope)` takes `'global' | 'local' |
'others'`. For pausing, `'global'` — sign out everywhere, including
whatever session just made the pause request. Reasoning: if pausing is
supposed to mean "this account is not active right now," leaving the
initiating session logged in contradicts that, and it keeps "pause" and
"resume" symmetric — pause signs you out, resume requires signing back in.
Flagging this as a decision point, not asserting it's obviously right: a
product could reasonably want `'others'` instead, so the person pausing
can still see their own paused-state UI without re-authenticating. Confirm
before building either way.

## Trigger condition

Only fire on the transition `paused_at` NULL → NOT NULL, not on every
profile update. Setting `paused_at` to the same non-null value it already
had (e.g., a retry) shouldn't re-fire a revocation — sessions already
being gone is a no-op success, but there's no reason to call the admin API
again for a state that hasn't changed. Whatever calls the Edge Function
should check that itself before calling (or the function should check
current `paused_at` before acting), not rely on `signOut` simply being
idempotent enough to not matter.

## What this doesn't cover

- **Deletion's own session revocation** (brief section 4.7) is a separate,
  already-planned flow (grace period, then hard delete) — this plan is
  pause-specific, though the same Edge-Function-holds-the-service-key
  pattern applies there too and the two could share code.
- **Rate limiting the pause/resume endpoints themselves** — not addressed
  here, would follow the same `enforce_rate_limit()` pattern already used
  elsewhere in this schema (`sql/security-hardening.sql`).
