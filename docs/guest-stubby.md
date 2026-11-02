# Guest Stubby: try first, sign up when it's worth it

What shipped in this change, what it needs switched on, and what is still open. The build brief
was given in chat on Nov 2, 2026; the founder's decisions on it are recorded below.

## Decisions (founder, Nov 2, 2026)

- A message is an ask, a conversation is your picks; making a plan, the calendar and follow-ups
  (Cheaper, Closer and the rest) need an account.
- Limits: guests 3 asks a rolling 24 hours, accounts 6, guest asks across everyone 60 a day. Guests
  get a smaller search budget (3 searches a round, still 3 or more picks).
- Only Stubby (`/calendar`) opens to signed-out visitors; everything else keeps commit 75e4a0c's rule.
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
| Who is who, deny by default | `supabase/migrations/20261111000000_member_gate.sql` |
| Guest limits, taste, feedback, cleanup | `supabase/migrations/20261111000100_stubby_guests.sql` |
| What non-members may reach | `supabase/security/access-allowlist.json` (checked by `accessAllowlist.test.ts` on every PR) |
| Live checks (always roll back) | `supabase/verification/member_gate_check.sql`, `stubby_guests_check.sql` |
| The ask, limits, prompt data | `supabase/functions/stubby-scout/` (`schema.ts`, `taste.ts`, `handler.ts`), `supabase/functions/_shared/access.ts` |
| The guest's own Supabase client | `src/lib/guestSupabase.ts` |
| Prompts, sheet, context card | `src/app/context/StubbyAccess.tsx`, `src/app/components/stubby/` |
| Back after sign-up | `src/app/lib/signUpReturn.ts`, `src/app/components/stubby/SignUpReturnEffect.tsx` |
| CSP and headers | `vercel.json` (hashes checked by `src/csp.test.ts`) |
| End to end | `npm run e2e:guest` (`scripts/e2e/guest-stubby.ts`) |

A guest is an anonymous Supabase user, made on the first ask (never on page load), kept in its own
client and storage key so the rest of the app still sees a signed-out visitor. Signing up links
Google or Apple to the same user (`linkIdentity`) or verifies an email on it, so the user id, the
picks, the taste profile and the feedback all carry over. The old guest session is ended.

## To switch it on (in this order, after the PR is merged)

1. **Apply the migrations** from main, with written approval naming each file (CLAUDE.md):
   `20261111000000_member_gate.sql`, then `20261111000100_stubby_guests.sql`. Run both
   verification scripts and confirm no fixture rows are left.
2. **Edge function secrets** (Supabase dashboard > Edge Functions > Secrets, or `supabase secrets set`):

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

   Then redeploy: `supabase functions deploy stubby-scout --no-verify-jwt`.
3. **Supabase Auth** (dashboard > Authentication):
   - Sign In / Providers: **Allow anonymous sign-ins** on.
   - Sign In / Providers: **Allow manual linking** on (needed by `linkIdentity`).
   - Rate limits: anonymous sign-ins per IP, **5 an hour**.
   - Emails > Change email address: include `{{ .Token }}` so a guest can confirm with a code.
   - Attack Protection: CAPTCHA (Turnstile) if wanted; then set `VITE_TURNSTILE_SITE_KEY` in Vercel.
     Note that it applies to every sign-in, not only guests.
4. **Vercel**: nothing required. Optional `VITE_TURNSTILE_SITE_KEY`. `/api/geo` deploys on its own.

## Security advisor

Before (live, Nov 2, 2026): 0 errors; WARN `authenticated_security_definer_function_executable` 108,
WARN `anon_security_definer_function_executable` 27, WARN `auth_leaked_password_protection` 1,
INFO `rls_enabled_no_policy` 11.

After: not run against a database yet, because the migrations are not applied anywhere (no
production, as asked). Expected: the 7 trigger-function warnings in the anon list go (EXECUTE
revoked); the remaining definer-function warnings stay listed by the advisor but are closed at
runtime by the RPC gate for anyone who isn't a member. Run it on a Supabase branch or staging after
applying, and again on production after the founder applies them.

## Open items

- **HEIC photos and the CSP.** `heic2any` (Emscripten) evaluates strings at load. The strict policy
  has no `'unsafe-eval'`, so HEIC to JPEG conversion fails in the browser once this ships (the
  existing "photo didn't make it" path handles it), and the console shows the refusal. Choose:
  add `'unsafe-eval'` to `script-src` (one line), or convert HEIC on the server.
- **Privacy Policy.** Guest asks are stored (taste profile, feedback, picks, a salted IP hash for 2
  days) and guests are deleted after 30 days of inactivity. The Privacy Policy needs to say so; not
  drafted here.
- **Wording** marked NEW in `src/app/lib/guestCopy.ts` is waiting for approval.
- **Entry point for signed-out visitors.** Guests reach Stubby at `/#/calendar`. The landing
  buttons all go to sign-up (glossary: "Sign up | Every landing button, all going to /onboarding"),
  so no landing link was changed. Pointing "Get your first pick" at Stubby needs approval.
- **21+ picks.** Guests and Stubby accounts never get them (default chosen; Q2 was not answered).
- **Pre-existing `npm audit` findings** (vite, vitest, react-router and transitive): not introduced
  here; this change adds no dependency.
