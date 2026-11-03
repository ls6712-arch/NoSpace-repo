# Stubby evaluation harness

Run `npx vitest run evals/stubby --maxWorkers=4` for deterministic golden,
provider, security and handler integration cases. The synthetic clock, profiles,
source evidence and candidates are in fixtures.ts. It includes DST in New York
and Los Angeles, Kolkata, permission revocation, budget, expiry, cancellation,
weather/calendar failures, prompt injection, credentials, quota/auth denial,
structured output, persistence, privacy, timeouts and source safety.

Generate the checked-in comparison report from the repository root:

```sh
node --input-type=module <<'JS'
import {evaluate} from './evals/stubby/run.ts';
import {writeFileSync} from 'node:fs';
const r = await evaluate();
writeFileSync('evals/stubby/report.json', JSON.stringify(r, null, 2) + '\n');
if (r.passed !== r.total) process.exitCode = 1;
JS
```

`run.ts` feeds the same frozen candidate records through the actual legacy
checker and V3. This compares deterministic filtering, not live model quality.
It does not assert that every difference is a measured product improvement.
Assertions pin desired outcomes, drop codes, verified source rules and diversity;
adding candidates cannot compensate for a violated hard constraint.

Optional isolated PostgreSQL validation needs no live Supabase credentials or
project dependency change:

```sh
npm install --prefix /tmp/stubby-sql --no-save --package-lock=false @electric-sql/pglite@0.5.15
PGLITE_MODULE=/tmp/stubby-sql/node_modules/@electric-sql/pglite/dist/index.js node evals/stubby/sql-check.mjs
```

`sql-report.json` records the real PostgreSQL WASM migration/RLS/deletion/rollback
checks against synthetic Auth fixtures. This does not prove compatibility with
the complete hosted Supabase schema. No test reads or writes a live project.

Existing browser runner now also tests authenticated memory save, reload and
confirmed deletion after the guest flow:

```sh
PLAYWRIGHT_CHROMIUM=/usr/bin/chromium npm run e2e:guest
```

It builds with the frontend V3 flag and mocks Supabase, including Google return.
It is not a live OAuth, live OpenAI or hosted RLS test. Keep those outcomes separate.

The second review adds reasoning.test.ts and expands the frozen golden set to
46 scenarios. review-report.json summarizes the executed full suite and separates
live-provider gaps. The deletion RPC now requires `expected_user`; SQL and client
tests cover switching accounts while a private editor is open.

Optional offline Edge entrypoint type check (does not execute any service):

```sh
npm install --prefix /tmp/stubby-edge-tools --no-save --package-lock=false deno@2.9.6
cat > /tmp/stubby-deno.json <<'JSON'
{"compilerOptions":{"strict":true},"nodeModulesDir":"manual","imports":{"jsr:@supabase/supabase-js@2":"npm:@supabase/supabase-js@2.116.0"}}
JSON
DENO_DIR=/tmp/stubby-deno-cache DENO_NO_UPDATE_CHECK=1 /tmp/stubby-edge-tools/node_modules/.bin/deno check --no-remote --config /tmp/stubby-deno.json supabase/functions/stubby-scout/index.ts
```

Claude provider tests are in anthropic.test.ts and provider.test.ts. Both adapters
share modelContract.ts and are covered by the original OpenAI protocol tests.
compatibility-review-report.json contains the latest complete local validation
summary. pr-review-report.json preserves the reconciliation review,
provider-report.json the provider-stage results, and review-report.json the
earlier reasoning review. Real credit balances
and charges are not asserted by HTTP mocks. See docs/stubby-v3/claude-provider.md
for the default routing, existing secret reuse and explicit OpenAI opt-in.
