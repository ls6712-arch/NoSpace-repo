# Point Vercel Preview at the staging database

**Approved in principle by the founder on Nov 6, 2026; do this only after the rebuild in `docs/staging-rebuild-runbook.md`
is verified.** Today every preview link writes to the live database: on Nov 5 and 6, production's API logs showed requests
from eight `no-space-repo-*.vercel.app` previews and none to the staging project.

This is a Vercel and Supabase dashboard change; there is no code change and nothing to merge. **Production
(`www.onsoosh.com`) is not touched.**

## 1. Vercel: Preview-only environment variables

Project `no-space-repo`, Settings, Environment Variables. For each name below, set the value for **Preview only** (untick
Production and Development). If a variable currently applies to all environments, edit it so Production keeps the
existing value and add a separate Preview entry.

| Name | Preview value |
|---|---|
| `VITE_SUPABASE_URL` | `https://iajtjxdlxzvigesecrqc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **anon / publishable** key from the staging project (Project Settings, API Keys). It is public by design and ships in the app bundle; never the `service_role` key |

Check the project for any other variable that names production (for example a Turnstile site key, an analytics id, a
`STUBBY` URL). The code reads only the two above (`src/lib/supabase.ts`). Redeploy a preview afterwards: Vercel applies
variables to new builds only.

Equivalent with the Vercel CLI (run from the repo, logged in to the Nospace team):

```bash
vercel env add VITE_SUPABASE_URL preview
```
```bash
vercel env add VITE_SUPABASE_ANON_KEY preview
```
*Each asks for the value; paste the staging value from the table. If it says the variable exists, `vercel env rm <name> preview` first.*

## 2. Staging Supabase: let previews sign in

Authentication, URL Configuration on `nospace-staging`:

- **Site URL:** `https://www.trynospace.com`
- **Redirect URLs:** `https://www.trynospace.com/**`, `https://*-nospace1.vercel.app/**`, `https://no-space-repo.vercel.app/**`
- Google sign-in: the same Google OAuth client, with the staging project's callback URL added to its authorised redirects.
- Turnstile (captcha): add the preview and staging hostnames to the site key's allowed domains, or use a separate key.

## 3. Check it worked

Open a fresh preview, sign up with a throwaway account, post a Moment. Then ask the assistant to run the check below, which
should show **no** `vercel.app` previews against production and the preview traffic on staging:

- Production API logs by referer host, last 24 hours: only `www.onsoosh.com` (plus Google sign-in).
- Staging API logs by referer host: the preview hosts.

## 4. Undo

Delete the two Preview-only entries (or set them back) and redeploy. Production is unaffected throughout.

## Known gap

The preview banner: previews do not say which database they use. A small follow-up could show "Preview · test data" when
`VITE_SUPABASE_URL` is not the live project, so nobody posts into the wrong place again. Say if you want it.
