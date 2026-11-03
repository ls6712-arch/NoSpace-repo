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

**What:** the secrets `stubby-scout` reads. `STUBBY_IP_SALT` is required. Without it, the function
refuses every guest ask (503 `GUESTS_NOT_READY`) while members carry on as normal.

**Make the salt** on your own computer. It is 32 random bytes written as 64 hex characters.
Never reuse it anywhere else, and never paste it into a chat, a PR or a document:

```bash
openssl rand -hex 32
```

(If `openssl` isn't there: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.)

**Where:** Supabase dashboard > project `eyzokuhhbyidvmuqfmwm` > **Edge Functions** > **Secrets**.
Add each name and value, then Save. Or with the CLI, logged in as the project owner:

```bash
supabase secrets set --project-ref eyzokuhhbyidvmuqfmwm STUBBY_IP_SALT=<the 64 characters> GUEST_DAILY_MESSAGE_LIMIT=3 USER_DAILY_MESSAGE_LIMIT=6 GUEST_GLOBAL_DAILY_CAP=60
```

| Secret | Value | What it does |
|---|---|---|
| `STUBBY_IP_SALT` | the 64 characters from above | Turns each guest's network address into a one-way hash for the per-network limits; the address itself is never kept. Changing it later only resets those counts. |
| `GUEST_DAILY_MESSAGE_LIMIT` | `3` | A guest's asks in a rolling 24 hours |
| `USER_DAILY_MESSAGE_LIMIT` | `6` | An account's asks in a rolling 24 hours. The app's "Sign up to keep your picks and get 6 asks a day." reads this number from the server. |
| `GUEST_GLOBAL_DAILY_CAP` | `60` | Guest asks across everyone in 24 hours; past it, guests see "Lots of asks right now. Sign up to keep going." and accounts carry on |
| `ALLOWED_ORIGINS` | leave unset | Defaults to `https://www.onsoosh.com,https://onsoosh.com`. Set it only to add a staging or preview origin (comma separated). |

Leave `GUEST_IP_DAILY_LIMIT` (3 times the guest limit), `GUEST_NEW_PER_IP_HOUR` (5) and
`GUEST_MAX_SEARCHES` (3) unset unless there is a reason.

**Verify:**
- [ ] `supabase secrets list --project-ref eyzokuhhbyidvmuqfmwm` (or the Secrets page) lists all four names. It shows a digest, never the value.
- [ ] After step 3: as a member on the live site, open Stubby with the browser's developer tools on
  the Network tab. The request to `stubby-scout` with `"status":true` answers with
  `"accountPerDay":6`. Guest numbers show in step 7.

### 3. Deploy `stubby-scout` from main

**What:** the live function is still #309's, deployed Nov 3 at 13:23 UTC; merging #303 didn't
deploy it. The new one adds the guest limits, the taste profile, the 21+ birthday flag and the
startup check. Members keep working through the switch: it falls back to the old claim and member
rule if anything is missing (see "Before the migrations are applied").

**Where:** from an up-to-date `main`, logged in to the Supabase CLI as the project owner:

```bash
supabase functions deploy stubby-scout --project-ref eyzokuhhbyidvmuqfmwm --no-verify-jwt
```

**Verify:**
- [ ] Dashboard > **Edge Functions**: `stubby-scout` shows a new version and an updated time after the deploy.
- [ ] As a member on the live site, ask Stubby something. Picks come back, and the ask count goes down by one.
- [ ] As a member with no birthday on file, ask for "a wine tasting tonight". "Add your birthday to see 21+ picks." shows under the picks. With an adult birthday on file it doesn't.
- [ ] Dashboard > Edge Functions > `stubby-scout` > **Logs**: no errors. One `guests not ready` line is expected until step 7, because no guests can exist yet.

### 4. Supabase Auth settings (everything except anonymous sign-ins)

All under Supabase dashboard > project `eyzokuhhbyidvmuqfmwm` > **Authentication**.

**4a. Manual linking: on.** `linkIdentity()` needs it. That's how a guest's Google sign-up keeps the
same account, picks and taste profile.
- Where: **Sign In / Providers** > **User Signups** > **Allow manual linking**: on > Save.
- [ ] Verify: the switch stays on after a reload. The end-to-end proof is the Google sign-up in step 7.

**4b. Anonymous sign-ins: 5 per IP an hour.** This must be set before step 7 turns them on.
- Where: **Rate Limits** > **Rate limit for anonymous users** (sign-ins per hour per IP address): `5` > Save.
- [ ] Verify: the Rate Limits page shows 5 after a reload. Live proof: a 6th new guest from one network within an hour is refused (it shows "Log in to use Stubby."). Optional.

**4c. "Change email address" email: include the code.** A guest who signs up with email confirms with a
6-digit code, not a link.
- Where: **Emails** > **Templates** > **Change Email Address**. In the message body, add a line with
  `{{ .Token }}`, for example `Your code: {{ .Token }}`. Keep the existing link too, then Save.
- [ ] Verify: on a test account, Settings > change email to an address you can read. The email that arrives shows a 6-digit code. Then change it back.

**4d. Leaked password protection: on.** People can set a password (Settings), so this rejects
passwords known from breaches (HaveIBeenPwned). It clears the advisor's last warning. It may need a
paid plan; if the switch is greyed out, that's why.
- Where: **Attack Protection** (in some versions, **Policies** > Password security) > **Prevent use of leaked passwords**: on > Save.
- [ ] Verify: rerun the security advisor. `auth_leaked_password_protection` is gone. Setting a password like `password123` on a test account is refused.

**4e. CAPTCHA (Cloudflare Turnstile): optional, and don't turn it on yet.** Supabase's CAPTCHA setting
applies to **every** sign-in. The app sends a Turnstile token only when it makes a guest, not for
email codes or passwords (`AuthContext.tsx`), so switching it on today would block email sign-ins
for everyone. It needs a small change first, so every sign-in sends a token; ask for it if wanted.
Once that change is live:
- Cloudflare dashboard > **Turnstile** > Add widget: domains `onsoosh.com` and `www.onsoosh.com`, mode **Invisible**. Copy the site key and the secret key.
- Supabase > **Attack Protection** > **Enable CAPTCHA protection** > provider **Turnstile** > paste the **secret** key > Save.
- Vercel > project `no-space-repo` > **Settings** > **Environment Variables** > add `VITE_TURNSTILE_SITE_KEY` = the **site** key, Production only. Then **Deployments** > the latest production deployment > **Redeploy**, because the key is read at build time.
- The Privacy Policy then needs a line naming Cloudflare in "Who else sees it".
- [ ] Verify: on the live site, logging in with an email code and with Google both work. In a private window, a guest's first ask still works. The browser console shows no Content Security Policy error (`challenges.cloudflare.com` is already allowed in `vercel.json`).

### 5. Vercel (production): nothing to set

`/api/heic` and `/api/geo` use the Supabase URL and anon key that are already set.
- [ ] Verify: as a member on the live site, add an iPhone (HEIC) photo to a Moment. It converts and posts.

### 6. Privacy Policy: written, in #313

`src/app/pages/PrivacyPolicy.tsx` (last updated November 3, 2026) now says what the code does:
- **A new section, "Trying Stubby without an account":**
  - a guest account is made on the first ask, with no email, name or password;
  - a guest's taste, thumbs and picks are kept the same way as an account's;
  - a salted one-way hash of the network address is kept for 2 days, never the address itself;
  - the city is suggested from the connection, and only the city name is used, only if kept;
  - everything moves into the new account on sign-up, and nothing is merged on logging in to an existing account;
  - a guest quiet for 30 days is deleted, with everything in it.
- **Accounts:** the taste profile and thumbs are kept with the account and deleted with it. Asks are
  counted for 30 days to limit them; no fixed number is written (the old "3 a day" was out of date).
- **Birthdays:** it decides 21+ picks; it's locked once on file (correct it through us); and an
  under-18 date isn't kept, and the account becomes Stubby only.
- **Who else sees it:** Vercel converts HEIC photos and doesn't keep them. Analytics gets steps like
  asking Stubby or signing up as counts only, never what you ask.

`legalCopy.test.tsx` checks each of these sentences, so a later edit can't drop one by accident.

- [ ] Founder's decision: whether existing accounts should accept the Privacy Policy again. If so, `TERMS_VERSION` in `src/app/config.ts` moves to the day it goes live. The checkbox and the database pick it up, and everyone is asked once on their next visit.
- [ ] Verify after merge: the live `/privacy-policy` shows "Trying Stubby without an account" and "Last updated November 3, 2026".

### 7. Anonymous sign-ins on, last (only when the founder says so)

Before this step: 2, 3 and 4a to 4c are done and verified, and the Privacy Policy is live.

**Where:** Supabase > **Authentication** > **Sign In / Providers** > **User Signups** > **Allow anonymous sign-ins**: on > Save.

**Verify (live smoke test).** Use a private window on a computer and on a phone. Keep the SQL editor
open in another tab:
1. [ ] Open `https://www.onsoosh.com` and tap **Get your first pick**. Stubby opens on `/calendar` with
   the field showing, and no "Log in to use Stubby." panel. SQL
   `select count(*) from auth.users u where u.is_anonymous;` is unchanged, because opening the page makes nobody.
2. [ ] The quick-context card shows. Pick something, or tap Skip.
3. [ ] Ask once, for example "pottery this weekend". Picks come back, and the count from step 1 is one higher.
4. [ ] Ask twice more. After the 3rd answer, the card "Sign up to keep your picks and get 6 asks a day." shows under the picks.
5. [ ] Ask a 4th time. The field gives way to the limit panel: "Sign up for 3 more asks today, or ask
   again after {time}", with the time in your own time zone. SQL
   `select sa.guest, (sa.ip_hash is not null) as hashed, count(*) from public.stubby_asks sa where sa.asked_at > now() - interval '1 hour' group by 1, 2;`
   shows 3 guest asks with a hash.
6. [ ] Tap **Sign up** > **Continue with Google** and finish with a Google account that has never used
   Soosh. You come back to Stubby, signed in, with the 3 guest picks there, and your 4th ask is sent
   for you. SQL: that user now has `is_anonymous = false` (same id), and
   `select p.signed_up_from, p.onboarding_completed from public.profiles p where p.id = '<that id>';`
   shows `stubby`, `false`.
7. [ ] As that new Stubby account, try a **Space**, **logging a Moment** and **Messages**: open
   `/#/space/<any Space's slug>`, the Log button (`/#/create`) and `/#/messages`. Each shows
   "Finish setting up" with **Set up now** and Not now, and no Space, Moment or message is shown. In
   Stubby, **Bring someone** shows the same sheet. The database refuses these to a Stubby account
   anyway (`member_gate_check` checks 7 to 9 and 22 to 28); this checks what the person sees.
8. [ ] Tap **Set up now**. Onboarding starts, and finishing it makes the account a full member.
9. [ ] Clean up the test account afterwards (Settings > delete account, or ask support).

### Rollback: turning guests off fast

Two switches, in this order. Neither one touches members, their Stubby or their data.

1. **New guests stop at once.** Supabase > **Authentication** > **Sign In / Providers** > **Allow
   anonymous sign-ins**: off > Save.
   - What people see: a signed-out visitor who opens Stubby gets "Log in to use Stubby." with **Log in**
     and **Sign up** buttons. No field, no error, and no guest is made.
   - What it doesn't do: a guest who already has a session in an open tab keeps it until it ends.
2. **Existing guests stop within 5 minutes.** Supabase > **Edge Functions** > **Secrets**: delete
   `STUBBY_IP_SALT` (keep the value somewhere safe if you want the same per-network counts back
   later).
   - The function then refuses every guest ask (503 `GUESTS_NOT_READY`), and the app shows those
     guests the same "Log in to use Stubby." panel.
   - The check is cached for up to 5 minutes per function instance.
   - Members are unaffected: their asks never need the salt.

Verify the rollback:
- [ ] `GET https://eyzokuhhbyidvmuqfmwm.supabase.co/auth/v1/settings` (header `apikey: <the public anon key>`) shows `"anonymous_users": false` under `external`.
- [ ] A private window on the live site shows "Log in to use Stubby." on Stubby.
- [ ] Edge Functions > `stubby-scout` > Logs shows `stubby-scout: guests not ready` for guest requests.
- [ ] A member's ask still works.

To turn guests back on: put `STUBBY_IP_SALT` back first, then switch anonymous sign-ins on.
Guests made before the rollback are deleted by the nightly cleanup after 30 quiet days; nothing
else needs doing.

### After launch

- [ ] The nightly cleanup runs. SQL: `select j.jobname, d.status, d.start_time from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname in ('purge-inactive-guests', 'purge-stubby-rows') order by d.start_time desc limit 4;`
- [ ] Guest load stays under the cap. SQL: `select count(*) from public.stubby_asks sa where sa.guest and sa.asked_at > now() - interval '24 hours';` stays under 60.
- [ ] Rerun the security advisor and compare it with step 1.

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
