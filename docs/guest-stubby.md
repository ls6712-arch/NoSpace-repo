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
| Members-only RPCs, onboarding (hotfix #304) | `supabase/migrations/20261111000000_member_rpc_gate.sql` |
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

## Launch order (each step only after the one before it is done)

Nothing here is done by a PR. Migrations are applied from main, each with the founder's written
approval naming the file (CLAUDE.md), then their verification scripts are run and checked for
leftover fixture rows.

1. **Hotfix applied.** `20261111000000_member_rpc_gate.sql` (PR #304): members-only RPCs, and
   `finish_onboarding()`. Verify with `supabase/verification/member_rpc_gate_check.sql`.
2. **Guest Stubby migrations applied.** `20261111000050_member_gate.sql`, then
   `20261111000100_stubby_guests.sql`, then `20261111000150_birthdate_rules.sql`. Verify with
   `member_gate_check.sql`, `stubby_guests_check.sql` and `birthdate_rules_check.sql`. Run the
   security advisor.
3. **Secrets set, function deployed.** Edge function secrets (Supabase dashboard > Edge Functions >
   Secrets, or `supabase secrets set`):

   | Secret | Value |
   |---|---|
   | `STUBBY_IP_SALT` | 32+ random characters. **Required**: without it every guest ask is refused. |
   | `GUEST_DAILY_MESSAGE_LIMIT` | `3` (default) |
   | `USER_DAILY_MESSAGE_LIMIT` | `6` (default; replaces `STUBBY_ASKS_PER_PERSON`) |
   | `GUEST_GLOBAL_DAILY_CAP` | `60` (default) |
   | `GUEST_IP_DAILY_LIMIT` | optional, default 3x the guest limit |
   | `GUEST_NEW_PER_IP_HOUR` | optional, default 5 |
   | `GUEST_MAX_SEARCHES` | optional, default 3 |
   | `ALLOWED_ORIGINS` | optional, comma separated; default `https://www.onsoosh.com,https://onsoosh.com`. Add preview or staging origins here or their browser calls are refused. |

   Then `supabase functions deploy stubby-scout --no-verify-jwt`.
4. **Dashboard settings** (Supabase > Authentication), everything except anonymous sign-ins:
   - Sign In / Providers: **Allow manual linking** on (needed by `linkIdentity`).
   - Rate limits: anonymous sign-ins per IP, **5 an hour**.
   - Emails > Change email address: include `{{ .Token }}` so a guest can confirm with a code.
   - Attack Protection: CAPTCHA (Turnstile) if wanted, then `VITE_TURNSTILE_SITE_KEY` in Vercel.
     It applies to every sign-in, not only guests.
5. **Anonymous sign-ins turned on, last.** Sign In / Providers: **Allow anonymous sign-ins**.

### The startup check

`stubby-scout` refuses every guest ask (503 `GUESTS_NOT_READY`; the app shows its usual
"couldn't look" line) unless `public.stubby_guest_ready()` is true and `STUBBY_IP_SALT` is set. That
function is true only when the RPC gate is on, the member gate and the guest migration are applied
(`my_access`, `claim_stubby_turn`, `stubby_profiles`, the Storage policy). It is read once every 5
minutes per function instance. So if anonymous sign-ins are switched on too early, Stubby still
gives a guest nothing.

What the check can't do: it protects Stubby, not the rest of the database. An anonymous user made
before step 2 would be a signed-in user to every other table until the member gate is applied.
That is why anonymous sign-ins come last.

## Security advisor

Before (live, Nov 2, 2026): 0 errors; WARN `authenticated_security_definer_function_executable` 108,
WARN `anon_security_definer_function_executable` 27, WARN `auth_leaked_password_protection` 1,
INFO `rls_enabled_no_policy` 11.

After: not run against a database yet, because the migrations are not applied anywhere (no
production, as asked). Expected: the 7 trigger-function warnings in the anon list go (EXECUTE
revoked); the remaining definer-function warnings stay listed by the advisor but are closed at
runtime by the RPC gate for anyone who isn't a member. Run it on a Supabase branch or staging after
applying, and again on production after the founder applies them.

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
- **Wording** marked NEW in `src/app/lib/guestCopy.ts` is waiting for approval.
- **Pre-existing `npm audit` findings** go in their own PRs (react-router first, then vite and vitest).
