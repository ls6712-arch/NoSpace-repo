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

## Scope of revocation — decided: `'global'`

`supabase.auth.admin.signOut(userId, scope)` takes `'global' | 'local' |
'others'`. Going with `'global'` — sign out everywhere, including whatever
session just made the pause request. Keeps "pause" and "resume"
symmetric — pause signs you out, resume requires signing back in.

**What `signOut` alone does not do: the access token stays valid until it
expires on its own.** `signOut` revokes the *refresh token*, so no new
access token can be minted after it — but the *current* access token is a
self-contained, signed JWT that Supabase's API gateway accepts purely by
checking its signature and expiry, with no server-side revocation list
consulted per request. A session paused mid-session keeps working with
whatever access token the browser already holds until that token's own
expiry passes, however long that is.

I could not read this project's actual configured JWT expiry through any
tool available to me — it's a GoTrue/Auth setting (Studio → Authentication
→ Settings → "Access token (JWT) expiry"), not something exposed through
the Postgres catalog or the Supabase management tools this session has.
Supabase's platform default is **3600 seconds (1 hour)** if it was never
changed, but that's a default to check against, not a confirmed value for
this project — please check that setting directly and tell me the real
number if it matters for how urgent this gap is. Whatever it is, that's
the maximum window a paused account's already-open tab keeps working
after `signOut` fires. If that's too long, the fix isn't a shorter
`signOut` — it's making the RLS policies themselves check the actor's own
`paused_at`, which is exactly what the write-side check below does: even
with a still-valid access token, an `INSERT`/`UPDATE` from a paused
account gets rejected at the database, immediately, regardless of token
expiry.

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
