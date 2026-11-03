# Guest Stubby: try first, sign up when it's worth it

What shipped in this change, what it needs switched on, and what is still open. The build brief
was given in chat on Nov 2, 2026; the founder's decisions on it are recorded below.

## Decisions (founder, Nov 2, 2026)

- A message is an ask, a conversation is your picks; making a plan, the calendar and follow-ups
  (Cheaper, Closer and the rest) need an account.
- Limits: guests 3 asks a rolling 24 hours, accounts 6, guest asks across everyone 60 a day. Guests
  get a smaller search budget (3 searches a round, still 3 or more picks).
- Only Stubby (`/calendar`) opens to signed-out visitors; everything else keeps commit 75e4a0c's rule.
  The landing page's Get your first pick buttons lead there.
- A member is `private.is_active()`: finished onboarding or gave an 18+ birthdate. A guest who signs
  up from Stubby gets a **Stubby account**: Stubby with the account allowance, saving to the
  calendar and Make it a plan. Spaces, Moments, comments and messages need membership; trying one
  says "Finish setting up" (onboarding), never an invite prompt. Enforced in the database.
- If the Google account or email already has a Soosh account, they log in to it; the guest's picks
  are not merged into it.
- Stubby taste profile (`stubby_profiles`) and feedback (`stubby_feedback`), in the same change.

## How it works

| Piece | Where |
|---|---|
| Members-only RPCs, onboarding (hotfix #304) | `supabase/migrations/20261111000010_member_rpc_gate.sql` |
| Who is who, deny by default | `supabase/migrations/20261111000050_member_gate.sql` |
| Guest limits, taste, feedback, cleanup | `supabase/migrations/20261111000100_stubby_guests.sql` |
| What non-members may reach | `supabase/security/access-allowlist.json` (checked by `accessAllowlist.test.ts` on every PR) |
| Live checks (always roll back) | `supabase/verification/member_gate_check.sql`, `stubby_guests_check.sql` |
| The ask, limits, prompt data | `supabase/functions/stubby-scout/` (`schema.ts`, `taste.ts`, `handler.ts`), `supabase/functions/_shared/access.ts` |
| The guest's own Supabase client | `src/lib/guestSupabase.ts` |
| Prompts, sheet, context card | `src/app/context/StubbyAccess.tsx`, `src/app/components/stubby/` |
| Back after sign-up | `src/app/lib/signUpReturn.ts`, `src/app/components/stubby/SignUpReturnEffect.tsx` |
| CSP and headers | `vercel.json` (hashes checked by `src/csp.test.ts`) |
| HEIC to JPEG | `api/heic.ts` (checks in `api/heicCheck.ts`), `src/app/lib/heicServer.ts` |
| End to end | `npm run e2e:guest` (`scripts/e2e/guest-stubby.ts`) |

A guest is an anonymous Supabase user, made on the first ask (never on page load), kept in its own
client and storage key so the rest of the app still sees a signed-out visitor. Signing up links
Google or Apple to the same user (`linkIdentity`) or verifies an email on it, so the user id, the
picks, the taste profile and the feedback all carry over. The old guest session is ended.

## Launch checklist (each step only after the one before it is done)

Every merge to main is a production database deploy (founder, Nov 3, 2026): the Supabase GitHub
integration applies new migrations from main. Nothing below is done by an agent unless the
founder says so in writing; settings in the Supabase and Vercel dashboards are the founder's.
Anonymous sign-ins stay **off** until the founder says otherwise.

The "Verify" checks marked SQL are read-only, or are verification scripts that always roll back
(CLAUDE.md). Run them in the Supabase SQL editor or through the connector.

### 1. Migrations applied and verified: done (Nov 3, 2026)

`20261111000010_member_rpc_gate.sql` (#304, renumbered in #311), then
`20261111000050_member_gate.sql`, `20261111000100_stubby_guests.sql` and
`20261111000150_birthdate_rules.sql` (#303), all applied from main.

- [x] Recorded on production: `select sm.version, sm.name from supabase_migrations.schema_migrations sm where sm.version >= '20261111000000' order by 1;` lists all four.
- [x] Verification scripts, Nov 3: `member_rpc_gate_check` 30 of 30, `member_gate_check` 41 of 41,
  `stubby_guests_check` 26 of 26, `birthdate_rules_check` 16 of 16 (setup fixed in #312), and no
  fixture rows left behind.
- [x] Every function body, owner, `search_path` and grant matches the migration files; policies,
  triggers and the allowlist match `supabase/security/access-allowlist.json`.
- [x] Security advisor: 0 errors (before and after); definer warnings 27 to 21 (`anon`) and
  108 to 106 (`authenticated`).

### 2. Edge function secrets

Supabase dashboard > Edge Functions > Secrets (or `supabase secrets set NAME=value`):

| Secret | Value |
|---|---|
| `STUBBY_IP_SALT` | 32 or more random characters (`openssl rand -hex 32`). **Required**: without it every guest ask is refused. Never reuse it anywhere else; changing it later only resets the per-network counts. |
| `GUEST_DAILY_MESSAGE_LIMIT` | `3` (the default if unset) |
| `USER_DAILY_MESSAGE_LIMIT` | `6` (the default; replaces `STUBBY_ASKS_PER_PERSON`) |
| `GUEST_GLOBAL_DAILY_CAP` | `60` (the default) |
| `GUEST_IP_DAILY_LIMIT` | optional, default 3 times the guest limit |
| `GUEST_NEW_PER_IP_HOUR` | optional, default 5 |
| `GUEST_MAX_SEARCHES` | optional, default 3 |
| `ALLOWED_ORIGINS` | optional, comma separated; default `https://www.onsoosh.com,https://onsoosh.com`. Add preview or staging origins, or their browser calls are refused. |

Verify:
- [ ] `supabase secrets list` (or the dashboard) shows `STUBBY_IP_SALT` and any limits you set. Values aren't shown, only names and digests.
- [ ] After step 3, the function's logs (Edge Functions > stubby-scout > Logs) show no `stubby-scout: guests not ready` line after a guest-shaped request. That line means the salt or the database check is missing.

### 3. Deploy `stubby-scout` from main

The live function is still #309's (deployed Nov 3, 13:23 UTC); merging #303 didn't deploy it. Members
keep working either way: the new function falls back to the old claim and member rule if anything
is missing (see "Before the migrations are applied").

`supabase functions deploy stubby-scout --no-verify-jwt` from an up-to-date main.

Verify:
- [ ] Supabase > Edge Functions: `stubby-scout`'s updated time is after the deploy.
- [ ] As a member in the app: ask Stubby something. Picks come back, the ask count goes down by one.
- [ ] As a member, ask for something 21+ ("a wine tasting tonight") on an account with no birthday:
  "Add your birthday to see 21+ picks." shows under the picks. On an account with an adult birthday
  it doesn't, and 21+ places can appear.
- [ ] SQL: `select count(*) from public.stubby_asks sa where sa.asked_at > now() - interval '10 minutes';` went up by your asks.

### 4. Vercel (production)

- [ ] `/api/heic`: as a member on the live site, add a real iPhone (HEIC) photo to a Moment. It
  converts and posts. As a signed-out visitor the endpoint answers 401.
- [ ] If CAPTCHA is wanted (step 5), `VITE_TURNSTILE_SITE_KEY` is set in Vercel's production
  environment, then redeploy. Verify: the sign-in page loads the Turnstile widget with no console
  error, and the CSP test (`src/csp.test.ts`) still passes on main.

### 5. Supabase Authentication settings (everything except anonymous sign-ins)

- [ ] Sign In / Providers: **Allow manual linking** on (`linkIdentity` needs it). Verify: on a
  preview or staging project with anonymous sign-ins on, a guest who taps Continue with Google comes
  back as the same user (the guest end-to-end test, `npm run e2e:guest`, checks the app side).
- [ ] Rate limits: anonymous sign-ins per IP, **5 an hour**. Verify: the Rate limits page shows 5.
- [ ] Emails > Change email address: the template includes `{{ .Token }}`, so a guest can confirm
  their email with a code. Verify: send it to a test address and check the code is in the email.
- [ ] Attack Protection: CAPTCHA (Turnstile) if wanted. It applies to every sign-in, not only
  guests. Verify: a normal email or Google sign-in still works on the live site.

### 6. Privacy Policy

Guest asks are stored (taste profile, feedback, picks, and a salted hash of the network address
for 2 days), and a guest quiet for 30 days is deleted with everything they made. The Privacy Policy
(`src/app/pages/PrivacyPolicy.tsx`) has to say so before guests can ask. Not drafted yet: the
wording needs the founder's approval like any copy.

- [ ] The new section is approved, merged and live. Verify: `/privacy-policy` on the live site shows
  it; `npm test` passes (the policy and `config.ts` are checked together).
- [ ] If people should accept it again, `TERMS_VERSION` in `src/app/config.ts` moves to the day it
  takes effect. Verify: an existing account is asked to accept once on its next visit.

### 7. Anonymous sign-ins on, last (only when the founder says so)

Sign In / Providers: **Allow anonymous sign-ins**.

Verify, in this order:
- [ ] The app's own check: `GET https://<project>.supabase.co/auth/v1/settings` (with the public
  anon key) shows `"anonymous_users": true` under `external`.
- [ ] Signed out on the live site, open Stubby: no "Log in to use Stubby." panel; the field shows.
  No guest is made just by opening the page: SQL `select count(*) from auth.users u where u.is_anonymous;` is unchanged.
- [ ] Ask once: a guest is made (that count goes up by one), and picks come back.
- [ ] Ask 3 times: the sign-up card shows after the 3rd, then the 4th is the limit panel with the
  time you can ask again, in your own time zone.
- [ ] SQL: `select sa.guest, count(*) from public.stubby_asks sa where sa.asked_at > now() - interval '1 hour' group by 1;` shows your guest asks counted as guest.
- [ ] Sign up from the limit panel with Google: you come back as the same user, your guest picks are
  there, and your blocked ask is sent. SQL: that user's `is_anonymous` is now false and their
  profile says `signed_up_from = 'stubby'`.

**To undo:** switch anonymous sign-ins off. Guests see "Log in to use Stubby." at once; nothing else
changes. Existing guests are deleted by the nightly cleanup after 30 quiet days.

### After launch

- [ ] The nightly jobs run: SQL `select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname in ('purge-inactive-guests', 'purge-stubby-rows') order by d.start_time desc limit 4;`
- [ ] Guest load against the cap: SQL `select count(*) from public.stubby_asks sa where sa.guest and sa.asked_at > now() - interval '24 hours';` stays under `GUEST_GLOBAL_DAILY_CAP`.
- [ ] Run the security advisor again; compare with step 1.

### The startup check

`stubby-scout` refuses every guest ask (503 `GUESTS_NOT_READY`; the app shows "Log in to use
Stubby.") unless `public.stubby_guest_ready()` is true and `STUBBY_IP_SALT` is set. That
function is true only when the RPC gate is on, the member gate and the guest migration are applied
(`my_access`, `claim_stubby_turn`, `stubby_profiles`, the Storage policy). It is read once every 5
minutes per function instance. So if anonymous sign-ins are switched on too early, Stubby still
gives a guest nothing.

What the check can't do: it protects Stubby, not the rest of the database. An anonymous user made
before step 2 would be a signed-in user to every other table until the member gate is applied.
That is why anonymous sign-ins come last.

## Before the migrations are applied

Every merge to main is a production database deploy, and the app can still be live before its
migrations (a failed run, or a deploy that lands first). Members see no change until then:

| Piece | Without its migration |
|---|---|
| `/api/heic` | `claim_heic_conversion()` missing (PGRST202): the old member rule from the person's own `my_profile_private()` row (active, onboarding finished), 30 an hour counted per function instance. Guests and non-members are still refused. |
| `stubby-scout`, who is asking | `my_access()` missing: the same old member rule, never 21+. A real failure (not "missing") is never covered this way: nobody is a member. |
| `stubby-scout`, the ask | `claim_stubby_turn()` missing: the old `claim_stubby_ask()` for accounts, with the old limits. Guests are refused (the startup check, and here). |
| Taste profile, feedback | `stubby_profiles` missing: the profile is unknown, not empty, so the quick-context card stays hidden. Feedback that can't be saved is dropped quietly. |
| Stubby accounts | `profiles.signed_up_from` missing: nobody is one, so nobody is sent to "Finish setting up". |
| Guests | Anonymous sign-ins are off until the last launch step: "Log in to use Stubby." |

Tested in `heicApi.test.ts`, `guests.test.ts` and `guestStubby.test.ts`.

## Security advisor

Before (live, Nov 2, 2026): 0 errors; WARN `authenticated_security_definer_function_executable` 108,
WARN `anon_security_definer_function_executable` 27, WARN `auth_leaked_password_protection` 1,
INFO `rls_enabled_no_policy` 11.

After (production, Nov 3, 2026, once the four migrations were applied): 0 errors; WARN
`authenticated_security_definer_function_executable` 106, WARN
`anon_security_definer_function_executable` 21, WARN `auth_leaked_password_protection` 1,
INFO `rls_enabled_no_policy` 9. The remaining definer functions are still listed by the advisor
but closed at runtime by the RPC gate for anyone who isn't a member, unless they are on
`private.access_allowlist`. Leaked password protection is a dashboard setting (Authentication >
Attack Protection), the founder's call.

## Decisions after review (founder, Nov 2, 2026)

- **HEIC conversion rules** (`api/heicCheck.ts`, tested in `src/app/lib/heicApi.test.ts`): the JWT is
  verified by Supabase Auth; anonymous guests and non-members are refused; at most 30 an hour each
  (`claim_heic_conversion()`, in the member gate migration); 4.4 MB, checked on the header and again
  while reading; HEIF bytes only; at most 40 megapixels, read from the file's own size boxes before
  anything is decoded; 10 seconds; nothing stored or logged; generic errors only. Until the member
  gate migration is applied, every conversion is refused (the "photo didn't make it" message). The
  size-box reader is tested on spec-built files; check one real iPhone photo on a preview deploy.
- **HEIC and the CSP.** `heic2any` is asm.js and calls `new Function` (3 places), so it needs
  `'unsafe-eval'`; `'wasm-unsafe-eval'` would not do. The policy keeps it out: HEIC to JPEG now
  runs on the server (`api/heic.ts`, with `heic-convert`), for signed-in people with a real login,
  4.4 MB at most, HEIF bytes only. `heic2any` is removed.
- **Landing.** Get your first pick (the hero and the last card) opens Stubby as a guest. Noted in
  `docs/glossary.md` as the one exception to "every landing button goes to sign-up".
- **Birthdays** (`20261111000150_birthdate_rules.sql`): once set, a birthday is locked; only
  support (the database owner) can change it. A member who gives an under-18 date is not deleted:
  `profiles.access` becomes `under_18`, so they are no longer a member (Stubby only, no 21+), and
  they can't try another date. The under-18 date itself isn't stored. Onboarding's own under-18
  stop for brand-new sign-ups is unchanged. The app's sheet and message wait for wording approval.
- **21+ picks.** Only with a birthdate on file at least 21 years ago (`my_access().adult21`). Never
  for a guest; not for a member without one, even when asked.
- **The two live gaps** shipped first as their own hotfix (PR #304); this change is rebased on it.

## Open items

- **Privacy Policy.** Guest asks are stored (taste profile, feedback, picks, a salted IP hash for 2
  days) and guests are deleted after 30 days of inactivity. The Privacy Policy needs to say so; not
  drafted here.
- **Wording**: all approved (founder, Nov 3, 2026), recorded in `docs/glossary.md`.
- **Pre-existing `npm audit` findings** go in their own PRs (react-router first, then vite and vitest).
