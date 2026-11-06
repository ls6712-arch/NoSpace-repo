# Plan: bring staging up to date with main

**Status: proposal for founder approval. Nothing in this plan has been run.** No branch has been reset and
neither Supabase project has been changed. Everything below was found with read-only queries and `git` on Nov 6, 2026.

## What is out of date

### The `staging` branch

- `staging` is **153 commits behind `main`**, last updated Nov 2 (PR #290).
- Its one unique commit is a merge of `main`; `git diff` from the merge base to `staging` is empty. **It holds no work
  of its own**, so bringing it up to date loses nothing.
- Recent PRs (#339, #340) were merged straight into `main`, and `docs/deploys.md` still says "into `staging`".

### The staging database (project `nospace-staging`, `iajtjxdlxzvigesecrqc`)

| | Production (`eyzokuhhbyidvmuqfmwm`) | Staging |
|---|---|---|
| Recorded migrations | 142, through `20261116000000` | 23, `20261030191653` to `20261101134601` |
| Tables in `public` | 77 | 62 |
| Functions (`public` / `private`) | 169 / 79 | 139 / 50 |
| Policies | 299 | 165 |
| Triggers | 70 | 49 |
| Cron jobs | 8 | 4 |
| Storage buckets | 3 | 3 |
| Rows: users, Moments, Spaces, Corners, `app_config`, categories | 11, 21, 2, 6, 7, 15 | 0, 0, 0, 0, 0, 0 |

- **Staging's migration versions are not the repo's.** It was built from a snapshot around Oct 30 and its 23 recorded
  versions do not match any of the repo's 143 migration files. So "apply the missing migrations" is not possible:
  there is no shared history to continue from.
- **Missing tables (15):** `personal_picks`, `pursuit_applause`, `pursuit_attendance`, `pursuit_contributions`,
  `pursuit_discussion`, `pursuit_meetings`, `pursuit_notices`, `pursuit_personal_goals`, `pursuit_session_declines`,
  `scout_runs`, `scout_sources`, `stubby_asks`, `stubby_capabilities`, `stubby_feedback`, `stubby_profiles`.
- **No members-only gate:** `private.is_member()` and the "members only" policies (`20261111000050_member_gate.sql`)
  do not exist there, so staging does not behave like live for guests, Stubby accounts or signed-out visitors.
- Other differences I hit while testing on it: `posts.city` is missing and `posts.media_url` is still NOT NULL.
- It has no reference data (`app_config`, `categories`), so Discover, limits and thresholds would all fall back to defaults.
- **One migration on `main` is live on production but not recorded there:** `20261117000000_weekly_free_hours.sql`
  (see "Findings from the comparison" below). It is the only difference between `main`'s 143 migrations and production's 142 records.

## Findings from the comparison (read-only, Nov 6, 2026)

**Catalogue fingerprint** (a hash per object, `public` and `private` schemas, storage and cron; the query is in the session
notes and can be re-run on both projects at any time). Only the 3 storage buckets match.

| Object | Production | Staging | Same? |
|---|---|---|---|
| Tables | 79 (77 `public`, 2 `private`) | 62 | no |
| Functions | 248 | 189 | no |
| Policies | 299 | 165 | no |
| Triggers | 70 | 49 | no |
| Constraints / indexes | 446 / 189 | 334 / 153 | no |
| Table grants (anon, authenticated, service_role) | 194 | 164 | no |
| Enums | 13 | 12 | no |
| Extensions | 7 (adds `pg_net`) | 6 | no |
| Cron jobs | 8 | 4 | no |
| Storage policies | 16 | 15 | no |
| Storage buckets | 3 | 3 | **yes** |

- **Cron.** Seven of production's eight jobs are plain SQL calls with no environment-specific target. Staging lacks
  `purge-inactive-guests`, `purge-stubby-rows`, `pursuit-session-reminders` and `stubby-restock`. Only `stubby-restock`
  calls out: it posts to production's own host, so on staging it must be recreated against the staging host, and it
  needs the `pg_net` extension, which staging does not have. No cron command contains key text.
- **Edge functions.** Production: `calendar-feed` (v13) and `stubby-scout` (v26). Staging: `calendar-feed` (v1) only, so
  there is no Stubby on staging.
- **Secrets.** Postgres Vault is empty on both projects, so the function secrets live in each project's edge-function
  settings, which the connector cannot read (it can only create one). Names and values are unknown to me.
- **`20261117000000_weekly_free_hours.sql`.** This migration (merged to `main` Nov 5, commit `2502af4`) lets the private
  "free windows" setting hold exact weekly hours such as `mon@1140-1260` alongside the old `mon-day` values, and makes
  Home's ranking use them. **Production already has all of it:** both new functions, the replaced check constraint, and
  `home_suggestions` rewired. I ran its own verification script (`supabase/verification/weekly_free_hours_check.sql`, no
  fixture rows) against production: **13 of 13 PASS**. Production simply has no row for the version in
  `supabase_migrations.schema_migrations`, so it was applied outside the migration tool (the SQL editor, most likely).
  Running the file again would fail on purpose (its guard refuses to rewrite a ranking function that has already been
  rewritten), so the fix is to **record the version, not re-apply it**:
  `insert into supabase_migrations.schema_migrations (version, name) values ('20261117000000', 'weekly_free_hours')`.
  That is a change to the live database, so I have not run it; say go and I will.
- **Which database each site uses.** Production's API logs for the last 24 hours show requests from `www.onsoosh.com`
  (8,101) and from eight Vercel preview URLs (`no-space-repo-*.vercel.app`, about 300 together), and **none from
  `www.trynospace.com`**. The staging project's logs show **no requests at all**. So: the live site and every preview use
  the production database, and the `nospace-staging` project is not wired to anything. The live bundle at
  `www.onsoosh.com` names `eyzokuhhbyidvmuqfmwm` (production). I could not fetch `www.trynospace.com` (the network
  allowlist refused it), and nobody used it in the last day, so I cannot confirm what it points at; `docs/deploys.md`
  says production, and nothing contradicts that.

## What I still cannot see (needs you)

1. **Auth settings on `nospace-staging`** (redirect URLs, Google sign-in, Turnstile/captcha, email templates): the connector
   has no tool for them. Please check them in the dashboard: Authentication, URL Configuration and Providers.
2. **Edge function secrets** on both projects: names and values (see above).
3. **Vercel environment variables** for `www.trynospace.com` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). One look at
   Project Settings, Environment Variables, answers it for certain.
4. **A way to get the production schema.** See the next section.

## Can the schema be copied through the connector?

Possible, but not a good idea. Production's catalogue is about 580 KB of definitions (248 function bodies alone are 289 KB,
plus 299 policies, 635 constraints and indexes, 1,220 grants and 70 triggers). Through the connector every byte would have to
come back into my context and then be sent out again to staging: roughly 150,000 tokens each way, with a real chance of a
dropped or mangled statement in a security-critical schema. The connector also cannot read auth settings or secrets.

A `pg_dump` connection from this environment is also unlikely to work: the sandbox reaches the internet through an HTTPS
proxy with a host allowlist, and Postgres is not HTTPS. **So I would not ask you for a connection string.**

**Recommended instead: you run two commands on your machine, nothing is shared with me.** (Do not run them until you
approve the plan.)

```bash
supabase db dump --db-url "$PROD_DB_URL" -f prod_schema.sql
```
```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f prod_schema.sql
```

(After the staging wipe in Phase 1.) Then I take over through the connector: re-run the fingerprint on both projects until
it matches, run the verification scripts on staging, and record the migration versions.

## Recommended approach

**Rebuild the staging database from production's schema, not by replaying migrations.** Replaying 143 files from
nothing is unproven (early history lives partly in `sql/`, and several migrations were renumbered to match live), and
it would give staging a different record from production. A schema-only copy makes staging identical by construction,
and staging has no data to lose.

### Phase 0: decisions and read-only checks (no changes)

- Done (Nov 6): the catalogue fingerprint on both projects and the checks above. You answer the open items.
- Still to do before Phase 1: your answers on auth settings, secrets and Vercel variables.

### Phase 1: staging database (nothing live is touched)

1. You dump production's `public` and `private` schemas, **schema only**, on your machine (commands above),
   plus the reference data only: `app_config`, `categories`, `corner_categories` and any other table that holds
   configuration rather than people (I'll list them from the dump for your approval). **No user data, no `profile_private`, no Moments.**
2. On `nospace-staging` only: drop and recreate `public` and `private`, then you restore the dump (grants included). Create
   the `pg_net` extension first.
   Supabase-managed schemas (`auth`, `storage`, `extensions`) are left alone.
3. Copy production's 142 recorded versions into staging's `supabase_migrations.schema_migrations`, so both
   projects have the same record from here on.
4. Recreate the 4 missing cron jobs pointing at the **staging** project URL and key (not production's).
5. Record `20261117000000` too (staging gets the *schema* from the dump, so the migration file is not re-run there either), and
   from here on apply each new migration to staging first.
6. **Gate:** the fingerprint matches production; `supabase/verification/member_gate_check.sql` and the existing
   verification scripts pass on staging, each ending in rollback with no fixture rows left.

*Rollback:* staging holds nothing of value, so the fallback is to repeat step 2. Production is only ever read.

### Phase 2: functions, storage, auth

Deploy `stubby-scout` and `calendar-feed` to staging from `main`, read them back, set their secrets (you supply the
keys; I never see them), check the 3 storage buckets and their policies match, set the auth redirect URLs and providers.

### Phase 3: the branch and the site

1. Bring the `staging` branch up to date by **merging `main` into it** (a normal merge PR, no force push, no history
   rewrite). Because `staging` has no work of its own, the result is identical to `main`.
2. Point the staging Vercel deployment at `nospace-staging` (you change the env vars; I can't).
3. Smoke test on www.trynospace.com with a throwaway account: sign up, post a Moment, open Discover, open Stubby.

### Phase 4: the process afterwards

- Feature PRs go to `staging` per `docs/deploys.md`, migrations are applied to **staging first** with their
  verification script, then `staging` is promoted to `main` and the same migration goes to production with your written approval.
- Update `docs/deploys.md` (it currently says both sites share one database) and `scripts/migrationRules.ts`'s
  assumption about `main`, once you've answered item 2.
- Optional: a read-only CI check that fails when staging's recorded migrations differ from the repo's, so it can't drift for weeks again.
- Open PRs: #343 (the lockfile fix) is a small fix to a broken `npm ci` on `main`; it can go straight to `main` and be
  merged back into `staging`. #342 and #344 move to `staging` once Phase 3 is done.

## Risks

| Risk | Handling |
|---|---|
| The staging site and every preview are on the live database today | Evidence above; Phase 3 step 2 repoints the staging deployment, and previews should be pointed at staging too |
| Dump copies personal data into staging | Schema only, plus a reviewed list of reference tables |
| Staging cron jobs or functions call production | Recreated with staging URLs and keys; checked in the fingerprint |
| Restored grants differ from live | The fingerprint compares grants, and the access-allowlist test and `member_gate_check.sql` run on staging |
| `drop schema` on the wrong project | Done only on `iajtjxdlxzvigesecrqc`, project id checked in the command, after your written approval |

## What I need from you

1. Approve (or change) the approach, including that **you** run the dump and restore rather than sharing a connection string.
2. Say **go** to record `20261117000000` on production (one row; its effects are already live and verified).
3. Check the auth settings and Vercel variables above (or tell me the values that are not secret, such as the Supabase URL).

Nothing is reset or changed until you approve.
