# Staging rebuild: commands to run

**Approved by the founder on Nov 6, 2026. You run these on your machine; nothing secret is shared with the assistant.**
Background and findings: `docs/staging-sync-plan.md`. Everything is read-only on production.

## Before you start

You need a Postgres client **version 17 or newer** (production is 17.6) and two connection strings from the dashboard
(Project, Connect, **Session pooler**, URI; the direct connection is IPv6-only):

```bash
pg_dump --version && psql --version
```
*Both should say 17 or higher.*

```bash
export PROD_DB_URL='postgresql://postgres.eyzokuhhbyidvmuqfmwm:PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
export STAGING_DB_URL='postgresql://postgres.iajtjxdlxzvigesecrqc:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres'
```
*Sets the two connections (replace PASSWORD; copy the exact host from each project's Connect panel). Keep these out of any file in the repo.*

```bash
echo "$PROD_DB_URL" | grep -c eyzokuhhbyidvmuqfmwm; echo "$STAGING_DB_URL" | grep -c iajtjxdlxzvigesecrqc
```
*Prints `1` then `1`. If either is `0`, stop: a string is pointing at the wrong project.*

## Step 1: dump production (read-only)

```bash
pg_dump "$PROD_DB_URL" --schema-only --schema=public --schema=private --no-owner --file=prod_schema.sql
```
*Writes the structure of the `public` and `private` schemas: tables, columns, functions, policies, triggers, indexes, grants. **`--schema-only` means no rows at all.***

```bash
sed -i.bak '/^CREATE SCHEMA public;$/d' prod_schema.sql
```
*Removes one line that would clash with the empty `public` schema the next step creates (harmless if the line isn't there).*

```bash
pg_dump "$PROD_DB_URL" --data-only --no-owner \
  --table=private.access_allowlist --table=private.stubby_settings \
  --table=public.app_config --table=public.categories \
  --table=public.corner_categories --table=public.scout_sources \
  --file=prod_reference_data.sql
```
*Writes the rows of the six configuration tables only (the member-gate allowlist, app settings, the category lists, scout sources and Stubby settings). No people.*

### Confirm there is no user data

```bash
grep -c '^COPY ' prod_schema.sql
```
*Must print `0`: the structure file contains no table data.*

```bash
grep '^COPY ' prod_reference_data.sql | cut -d' ' -f2
```
*Must list exactly these six tables and nothing else: `private.access_allowlist`, `private.stubby_settings`, `public.app_config`, `public.categories`, `public.corner_categories`, `public.scout_sources`. If a `profiles`, `posts`, `messages` or `profile_private` line appears, stop and tell the assistant.*

*Why this is safe: the six tables hold configuration (settings, category names, the list of what a signed-out visitor may reach). The columns are `key/value`, `kind/name/reason`, names and descriptions, and source domains. None has a user id, email or text a person wrote.*

## Step 2: empty staging's schemas

```bash
psql "$STAGING_DB_URL" -f supabase/staging/00_wipe_staging.sql
```
*Drops and recreates `public` and `private` on **staging only**. It refuses to run if the database has any user, so it stops itself if pointed at production (which has 11).*

## Step 3: restore into staging

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f prod_schema.sql
```
*Rebuilds the structure, grants and policies. Stops at the first error.*

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f prod_reference_data.sql
```
*Loads the six configuration tables.*

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/staging/90_post_restore.sql
```
*Adds what a schema dump can't carry: `pg_net`, the two `auth.users` triggers, the realtime publication, the 16 storage policies and the 4 missing cron jobs (the one that calls `stubby-scout` is left off).*

## Step 4: tell the assistant

Say "staging restored". I then, through the connector:

1. re-run the catalogue fingerprint on both projects until every row matches (tables, functions, policies, triggers, indexes, constraints, grants, cron, extensions, storage);
2. record production's 143 migration versions in staging's `supabase_migrations.schema_migrations`;
3. run the verification scripts on staging, each ending in rollback, and confirm no fixture rows are left;
4. report anything that differs.

If a command fails, send me the last 20 lines of its output. Staging holds nothing of value, so every step can be repeated from Step 2.

## Afterwards (separate approvals)

- Deploy `calendar-feed` and `stubby-scout` to staging, set their secrets, then switch `stubby-restock` on.
- Point Vercel's **Preview** environment at staging: `docs/preview-environment-change.md`.
