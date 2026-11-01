# stubby-scout

Stubby's scout finds real, dated things to do in New York on the web and saves them as City picks.

## Three ways it runs

| Who | How | Limit |
| --- | --- | --- |
| **The morning sweep** | pg_cron (`stubby-scout-sweep`, every 15 minutes, 09:00 to 13:45 UTC) calls `private.scout_sweep_call()`, which posts here with the sweep token from Vault. Each call searches the one active watch that has waited longest and not run in 20 hours. | 5 searches a watch |
| **A member asks** | "Looking for something else?" under This week in New York. `{ "mode": "member", "focus": "..." }` with their session. | 3 asks a day each, 4 searches an ask |
| **An admin** | Find picks on City picks. `{ "focus": "..." }` with their session. | 3 a day, 8 searches |

All kinds together stop at the app's daily limit (40 runs), checked before anything is paid for.

## What happens to a find

Every pick is checked in code (`picks.ts`), whatever the model said: a New York start time 1 hour to 14 days away; an https link that is one of the pages the search actually returned (so it can't invent a page); not already a City pick; no repeats. No price on the page stays no price, never "free".

- **Clean** (nothing to double check): goes live for everyone at once (founder, Nov 1, 2026).
- **With a note** (price not listed, end unclear, the model unsure): a draft. An admin checks it on City picks.
- **Found by a member's ask**: `requested_by` is that member, so they see it at once, even as a draft.

Admins can unpublish or delete anything. Web pages are data: the model has only the web search tool, no database, no publishing, no choosing URLs.

## Auth

Deployed **without gateway JWT verification** (the cron job has no user), so the function checks every caller itself before using the service role:
- sweep: `x-scout-sweep` must match the Vault secret `stubby_scout_sweep_token` (`public.scout_sweep_token_ok`, service role only);
- member and admin: the session in `Authorization` (`auth.getUser`), and `profiles.is_admin` for admin.

## Setup

Needs `20261101155717_stubby_scout.sql` and `20261101170000_stubby_scout_sweep.sql` applied.

```bash
supabase functions deploy stubby-scout --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=<key> STUBBY_SCOUT_ENABLED=true
```

Then, once, on the live project only (turns the sweep on; staging stays quiet without it):

```sql
select vault.create_secret('https://<project>.supabase.co/functions/v1/stubby-scout', 'stubby_scout_url');
```

Optional secrets (clamped):

| Secret | Default (max) |
| --- | --- |
| `STUBBY_SCOUT_MODEL` | `claude-haiku-5-5` |
| `STUBBY_SCOUT_DAILY_LIMIT` | 40 (300) runs a day, every kind |
| `STUBBY_SCOUT_MEMBER_PER_DAY` | 3 (10) asks per member |
| `STUBBY_SCOUT_RUNS_PER_DAY` | 3 (20) admin runs |
| `STUBBY_SCOUT_SWEEP_SEARCHES` | 5 (20) |
| `STUBBY_SCOUT_MEMBER_SEARCHES` | 4 (10) |
| `STUBBY_SCOUT_MAX_SEARCHES` | 8 (20), admin runs |

**Kill switch:** `STUBBY_SCOUT_ENABLED=false`. Takes effect on the next request.

## Cost

About $0.01 to $0.02 a search ($10 per 1,000) plus model tokens; a run is roughly $0.05 to $0.15. Six watches swept daily: about $10 to $20 a month. Each member ask: about $0.05 to $0.10. The daily limit caps the worst case; set a monthly spend limit in the Anthropic console too.

## Tests

`stubby-scout.test.ts` (vitest, part of `npm test`): the checks, the search call with a fake fetch, and every caller with a fake database. `supabase/verification/stubby_scout_check.sql` and `stubby_scout_sweep_check.sql` check the database side.
