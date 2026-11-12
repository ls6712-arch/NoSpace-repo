# Deploys: staging and live

One Vercel project (`no-space-repo`, team Nospace), two sites:

| Site | Branch | What it is |
|---|---|---|
| **www.onsoosh.com** (`onsoosh.com` redirects here) | `main` | Live. What people use. |
| **www.trynospace.com** (`trynospace.com` redirects here) | `staging` | Staging. Shows a "Staging · not the live site" strip. |

Every other branch and PR still gets its own `*.vercel.app` preview link.

## Shipping a change

1. Open the feature PR **into `staging`** (not `main`).
2. Merge it. Vercel rebuilds www.trynospace.com in a minute or two.
3. Try it on www.trynospace.com.
4. When it's approved, open a PR **from `staging` into `main`** and merge it.
   That rebuilds www.onsoosh.com.

Urgent fix on live: PR straight into `main`, then merge `main` back into
`staging` so the two don't drift.

## Things to know

- **Both sites use the same Supabase project.** Anything done on staging
  (sign-ups, Moments, deletes) is real data, and a database migration hits
  live the moment it's applied, whichever branch it came from. Apply
  migrations only when the code that needs them is about to reach `main`.
  **So do preview links:** on Nov 5 and 6, 2026 production's API logs showed
  requests from `www.onsoosh.com` and from eight `no-space-repo-*.vercel.app`
  previews, and none from `trynospace.com`. A separate `nospace-staging`
  Supabase project exists (`iajtjxdlxzvigesecrqc`) but nothing uses it, and it
  is out of date (see `docs/staging-sync-plan.md`). This note changes once the
  founder approves that plan.
- **Migrations are never applied automatically.** Merging to `main` does not
  run a migration. The founder says go, then it is applied from `main` and its
  verification script run (CLAUDE.md). Check `supabase_migrations.schema_migrations`
  against `supabase/migrations/` now and then: `20261117000000` was applied
  by hand without a record.
- **Sign-in on a new domain** needs that domain in Supabase → Authentication →
  URL Configuration → Redirect URLs, or people are sent back to the Site URL
  after Google sign-in or a password reset. Both domains are needed:
  `https://www.onsoosh.com/**` and `https://www.trynospace.com/**`.
- The live domain is written in one place in the code: `SITE_DOMAIN` in
  `src/app/config.ts`. The staging domain is `STAGING_DOMAIN` next to it.
