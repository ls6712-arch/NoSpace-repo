# stubby-scout

Stubby's scout, with three modes:

- **Find picks** (admins): on the City picks admin page. Every find is a draft.
- **Each morning** (`{"mode":"restock"}`): pg_cron calls it every 10 minutes from 4 to 6 a.m. New York time (migration `20261101180000_stubby_daily_and_ask.sql`). Each call searches the next place in **Each morning** (`scout_sources`) not yet searched today, only on that place's site, for the next 7 days. Finds from the place's trusted site publish on their own; the rest are drafts. Each place is searched at most once a day however often the function is called, so this mode needs no sign-in.
- **Ask Stubby** (`{"mode":"ask","ask":"..."}`, signed in): one person asks. 3 a day each, 200 a day in total. The ask is read in code first (`intent.ts`: when, who, budget, what kind), with their own profile read as them (`profile_private`, `user_passes`, their going Pursuits). The prompt (`askPrompt.ts`) says who is coming and puts what Soosh knows about them in an "About this person" block, as information, not instructions. Every pick is then checked in code (`ask.ts`): inside the time asked for ("tonight" also means ending by midnight, and when nothing fits, at most 3 of the soonest after, marked), the event's own page only (no landing, listing, roundup or calendar pages), no 21+ unless asked, the budget, and ideas only in their Corners or when asked for. The best 3 (at most 5) are saved as their own picks (`personal_picks`) with a why line, their rank and the ask that found them. Events are also shared as City picks (published from a trusted site, a draft otherwise) with nothing about who asked or what they typed; ideas never are. The ask text itself is never stored.
  - `"answers": {"who": "solo"}` is the person's answer to Stubby's one question; `"questions": true` asks for that question first (`{"question": "who"}`), which uses no ask. The app sends `questions` from Stubby plan PR 3.
  - `"stream": true` answers as server-sent events (Stubby plan §7): `understood` at once, then `search` (each web search, as the model runs it, read from the model's own stream), `pages`, `picking`, and `done` with the report (including `askId`) or `error`. A comment line every 10 seconds keeps the connection open. If the person stops, the work carries on and is saved; the ask still counts. Anything that stops before searching (no asks left, a bad ask) is a plain JSON answer, as before.
  - `golden.test.ts` pins the plan's golden cases with fake search results and a fixed clock. `node scripts/stubby-golden-models.ts` runs them live on two models (needs `ANTHROPIC_API_KEY`).

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

Needs `20261101155717_stubby_scout.sql`, `20261101180000_stubby_daily_and_ask.sql` and `20261107000000_stubby_smarter_picks.sql` applied first.

```bash
supabase functions deploy stubby-scout --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=<key from console.anthropic.com>
supabase secrets set STUBBY_SCOUT_ENABLED=true
```

Optional:

| Secret | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_WORKSPACE_ID` | none | Only if the API key isn't scoped to a workspace (`wrkspc_...`). Not a secret, but kept here with the key. |
| `STUBBY_SCOUT_MODEL` | `claude-haiku-5-5` | Which Claude model searches. |
| `STUBBY_SCOUT_RUNS_PER_DAY` | `3` (max 20) | Runs allowed in any 24 hours, across all admins. |
| `STUBBY_SCOUT_MAX_SEARCHES` | `5` (max 20) | Web searches per Find picks run or ask. |
| `STUBBY_RESTOCK_SEARCHES` | `3` (max 10) | Web searches per place each morning. |
| `STUBBY_ASKS_PER_PERSON` | `3` (max 20) | Asks one person can make in 24 hours. Keep in step with `ASKS_PER_DAY` in `src/app/lib/stubbyAsk.ts`. |
| `STUBBY_ASKS_PER_DAY` | `200` (max 5000) | Asks everyone together can make in 24 hours. |

Deploy **without** gateway JWT verification (`--no-verify-jwt`), because the morning schedule has no sign-in. Find picks and Ask Stubby check the caller's token themselves. Never put the key in a `VITE_` variable.

**Kill switch:** `supabase secrets set STUBBY_SCOUT_ENABLED=false`. Takes effect on the next request, no deploy needed.

## Cost

Web search is $10 per 1,000 searches plus model tokens (Haiku 5.5: $0.10 in, $0.50 out per million tokens below 100K tokens a request). Roughly:

- **Each morning:** 5 places × 3 searches = 15 searches, about $0.15, plus about $0.05 to $0.10 of tokens. **About $6 to $8 a month.**
- **Ask Stubby:** about $0.06 to $0.10 an ask. 20 asks a day is about $1.50 to $2 a day.
- **Find picks:** about $0.06 to $0.10 a run.

The daily caps limit runs and asks, not the bill: set a monthly limit in the Anthropic console too.

## Tests

`stubby-scout.test.ts` (vitest, part of `npm test`) covers the checks, the search call with a fake fetch, and the whole request with a fake database. `index.ts` only wires real clients to `handler.ts`.
