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
- **Production itself is one migration ahead of its record:** `main` has `20261117000000_weekly_free_hours.sql`, which
  production has not recorded. Staging should get it before production does.

## What I could not see (needs you)

1. **Which database does www.trynospace.com use today?** `docs/deploys.md` says both sites use the *same* Supabase
   project. If so, the staging site is writing to live data and the `nospace-staging` project is not wired in at all.
   This is set in Vercel environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), which I can't read.
2. Whether Supabase's GitHub integration applies migrations on merge. `scripts/migrationRules.ts` says "every merge to
   main is a production database deploy" while `CLAUDE.md` says migrations are applied by hand with your written
   approval, and production has not recorded `20261117000000`. I need to know which is true before moving PRs to `staging`.
3. Auth settings on `nospace-staging`: redirect URLs for `www.trynospace.com`, Google sign-in, the Turnstile key, email templates.
4. Edge function secrets (`stubby-scout`, `calendar-feed`) and the 8 production cron jobs' targets.
5. A way to read production's schema as a dump (`pg_dump`/`supabase db dump` needs the database connection string).

## Recommended approach

**Rebuild the staging database from production's schema, not by replaying migrations.** Replaying 143 files from
nothing is unproven (early history lives partly in `sql/`, and several migrations were renumbered to match live), and
it would give staging a different record from production. A schema-only copy makes staging identical by construction,
and staging has no data to lose.

### Phase 0: decisions and read-only checks (no changes)

- You answer the five items above.
- I run a **catalogue fingerprint** on both projects (a hash per table, column, function body, policy, trigger, grant
  and cron job, read-only) so "identical" is a result, not a belief. I keep the same query for the end.

### Phase 1: staging database (nothing live is touched)

1. Dump production's `public` and `private` schemas, **schema only** (`supabase db dump --db-url <prod> -f prod_schema.sql`),
   plus the reference data only: `app_config`, `categories`, `corner_categories` and any other table that holds
   configuration rather than people (I'll list them from the dump for your approval). **No user data, no `profile_private`, no Moments.**
2. On `nospace-staging` only: drop and recreate `public` and `private`, restore the dump, restore the grants.
   Supabase-managed schemas (`auth`, `storage`, `extensions`) are left alone.
3. Copy production's 142 recorded versions into staging's `supabase_migrations.schema_migrations`, so both
   projects have the same record from here on.
4. Recreate the 4 missing cron jobs pointing at the **staging** project URL and key (not production's).
5. Apply `20261117000000_weekly_free_hours.sql` (and later, each new migration) to staging first.
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
| The staging site is on the live database today | Settled in Phase 0 before anything else; if true, Phase 3 step 2 comes first |
| Dump copies personal data into staging | Schema only, plus a reviewed list of reference tables |
| Staging cron jobs or functions call production | Recreated with staging URLs and keys; checked in the fingerprint |
| Restored grants differ from live | The fingerprint compares grants, and the access-allowlist test and `member_gate_check.sql` run on staging |
| `drop schema` on the wrong project | Done only on `iajtjxdlxzvigesecrqc`, project id checked in the command, after your written approval |

## What I need from you

Approve (or change) the approach, answer the five items under "What I could not see", and tell me whether I may run
the Phase 0 read-only fingerprint now. Nothing is reset until you approve.
