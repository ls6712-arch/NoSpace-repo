# stubby-scout

Stubby's scout. An admin presses **Find picks** on the City picks admin page (`#/admin/city-picks`); the scout searches the web for real, dated things to do in New York in the next 14 days and saves what it finds as **City pick drafts**. Nothing is published. An admin reads each draft, opens its source link, fixes anything, and publishes it by hand.

## What it does, step by step

1. Checks the caller is signed in, the scout is switched on, a key is set, and the daily run cap isn't reached. All before any search is paid for.
2. Starts a run in `scout_runs` **as the caller**. The database only lets admins do this, so anyone else stops here.
3. Asks Claude, with the web search tool and nothing else, for up to 12 activities, optionally around a focus ("pottery, running").
4. Checks every pick in code (`picks.ts`), whatever the model said:
   - a title (80 characters at most) and a New York start time between 1 hour and 14 days away;
   - an https link that is **one of the pages the search actually returned**, so it can't invent a page;
   - not already a City pick (same title and start), not a repeat;
   - no price on the page stays no price (never "free"), with a note saying so.
5. Saves each kept pick as a draft (`published = false`, `found_by = 'scout'`, `source_url`, `checked_at`, `scout_note`), as the caller.
6. Returns what was added and why anything was dropped.

Web pages are treated as data. The model can't touch the database, can't publish, and can't pick a URL to fetch; its whole answer goes through the checks above.

## Deploy (not done by any PR)

Needs `20261101155717_stubby_scout.sql` applied first.

```bash
supabase functions deploy stubby-scout
supabase secrets set ANTHROPIC_API_KEY=<key from console.anthropic.com>
supabase secrets set STUBBY_SCOUT_ENABLED=true
```

Optional:

| Secret | Default | What it does |
| --- | --- | --- |
| `STUBBY_SCOUT_MODEL` | `claude-haiku-5-5` | Which Claude model searches. |
| `STUBBY_SCOUT_RUNS_PER_DAY` | `3` (max 20) | Runs allowed in any 24 hours, across all admins. |
| `STUBBY_SCOUT_MAX_SEARCHES` | `8` (max 20) | Web searches per run. |

Deploy with JWT verification on (the default). Never put the key in a `VITE_` variable.

**Kill switch:** `supabase secrets set STUBBY_SCOUT_ENABLED=false`. Takes effect on the next request, no deploy needed.

## Cost

Web search is $10 per 1,000 searches plus model tokens (check current pricing). At the defaults, the most it can do is 3 runs a day × 8 searches = 24 searches, about $0.24 a day in search fees, plus tokens. Set a monthly spend limit in the Anthropic console as well; the cap here limits runs, not the bill.

## Tests

`stubby-scout.test.ts` (vitest, part of `npm test`) covers the checks, the search call with a fake fetch, and the whole request with a fake database. `index.ts` only wires real clients to `handler.ts`.
