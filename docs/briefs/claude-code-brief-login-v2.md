# Build: Log in, matched to the Soosh onboarding (add to PR 2, #227)

Founder request, Oct 29, 2026: "change the current login to match this." The returning-user door should look, sound and behave like the new onboarding (Transfer tokens, Stubby). Builds on `claude-code-brief-onboarding-stubby.md`; same rules (tokens only, sentence case, no em dashes, glossary).

**Revised Oct 29 (after #227 review):**
1. **Unknown emails no longer get "No Soosh account for that email yet."** That told anyone whether a person is on Soosh, a safety risk on an app where people meet in person. See §3.
2. **Passwords are a real option, not a hidden link** (founder: "Instagram works on code, but it still has a password option"). Codes stay the default because they also prove the email is real; a password sits next to them as an equal choice on sign-in, can be set during sign-up (optional, one screen) and added or changed in Settings. See §2, §3 and §6.
3. **A late code is never treated as "you might be new."** (founder: a member waiting on a slow email must not be told they might be new.) The code screen handles delay the way large consumer apps do: a wait message, a resend countdown, then spam, resend, password and a different email. "New to Soosh? Get started" is always on screen from the start, never shown as a reaction to a missing code. See §2 (Code) and §7.

## 1. What changes
`/login` today is the old two-mode page (Sign up / Welcome back) with email + password and Google, in the old theme. With the Soosh flow on, sign-up already redirects to `/onboarding`. This brief makes the sign-in side match, and reuses the onboarding screens instead of a second design.

## 2. The screens (inside `.soosh-transfer`, reusing `ScreenFrame`, `TransferButton`, `CodeScreen`)

| Screen | Content | Stubby |
|---|---|---|
| Welcome back | Headline "Welcome back." Buttons: Continue with Google / Continue with Apple (behind `appleSignInEnabled`) / Continue with email. Link: "New here? Get started" goes to `/onboarding`. | Starts `sleep` on the platform background and wakes (the built-in wake beat, then `idle`) when the person taps any button or focuses a field. Never "we missed you". |
| Email | Email field, then a password field (optional, labelled "Password (if you have one)"). Two buttons of equal size: **"Send me a code"** (primary) and **"Log in with password"** (secondary, enabled once the password field has text). The device remembers which one the person used last and puts it first next time. | `idle`, `followPointer` |
| Code | The existing `CodeScreen`, reused. See the three stages below. Right code: `stamped`, then go on. Wrong code: `shrug` and "That code didn't match. Try again or send a new one." | `thinking` while waiting (the slot spins), then as onboarding |
| Wrong password | One message for a wrong email or a wrong password: "That email and password don't match." Under it: "Forgot your password?" and "Send me a code instead". | `shrug` |
| Forgot password | The existing reset flow, restyled with the same frame. "If there's an account for {email}, we've sent a link." The reset page lets them set a new password (10 characters minimum, as Settings already requires). | `idle` |
| Signing in | While the session is created. | `thinking` |

**The Code screen, in three stages** (identical for known and unknown emails):
1. **Sent (0 to 30 seconds):** "Check your inbox at {email}." and "Codes usually arrive in under a minute." Below the field, a countdown: "Send a new code in 0:30".
2. **Still waiting (after 30 seconds):** the countdown is replaced by "Still nothing? Check your spam folder." and three equal options: **Send a new code** · **Log in with password** · **Use a different email** (back to the Email screen with the field filled in and selected). Resends follow Supabase's rate limit; when it's hit, say "You can ask for another code in {time}." using `dates.ts`.
3. **Always, from the first second:** a small footer link, "New to Soosh? Get started" (to `/onboarding`, email carried over). It sits in the same place on every sign-in screen, so it never reads as a reaction to a missing code.

Never on this screen: "you might be new", "no account", "we couldn't find you", or anything that changes depending on whether the email has an account.

After sign-in:
- `onboarding_completed` false: resume onboarding at `profile_private.onboarding_step` (the PR 2 column). Never restart from screen 1.
- otherwise: go to `?redirect=` or Home.

## 3. Rules
- **Codes by default, passwords always available.** Code: `signInWithOtp` with `shouldCreateUser: false` (an existing email gets the Magic link template, which now prints the code). Password: `signInWithPassword`.
- **Never say whether an email has an account.** Known and unknown emails see the same Code screen, stages and timings; an unknown email simply never receives a code (Supabase's "user not found" error is caught and not shown). Wrong email and wrong password share one message. "Forgot your password?" always says the same thing. An account with no password set gets the same "don't match" message (it can use a code).
- **Never create an account from sign-in.** Unit tests assert sign-up is never called on this path.
- The Terms checkbox is not on sign-in (people already accepted).
- `?mode=signin` and `?mode=signup` links keep working: signin lands on Welcome back, signup goes to `/onboarding`.
- With `sooshOnboardingEnabled` off (production until PR 4), the old `/login` stays exactly as it is. Same flag, no new one.
- Keep custom SMTP and Supabase's email rate limits on.
- Accessibility as onboarding §8. Error text and the stage change at 30 seconds are announced (`aria-live="polite"`). The countdown is not announced every second. Password fields use `autocomplete="current-password"` on sign-in and `"new-password"` when setting one; the code field uses `autocomplete="one-time-code"` so phones offer the code from the email.

## 4. New copy (glossary, proposed)
Welcome back. · Continue with email · Password (if you have one) · Send me a code · Log in with password · Send me a code instead · New here? Get started · New to Soosh? Get started · Check your inbox at {email}. · Codes usually arrive in under a minute. · Send a new code in {time} · Still nothing? Check your spam folder. · Send a new code · Use a different email · You can ask for another code in {time}. · That email and password don't match. · If there's an account for {email}, we've sent a link. · Want a password too? · Optional. You can always log in with a code. · Add a password · Change password · Skip for now

Removed: "No Soosh account for that email yet." · "Use my password instead" · "If there's a Soosh account for {email}, your code is on its way." · "No code? You might be new here."

## 5. Tests and proof
- Unit: unknown and known emails render identical screens, copy and stage timings; unknown email never calls sign-up; password and code paths both sign in; a wrong password and an unknown email show the same message; the 30-second stage appears and offers resend, password and different email; "New to Soosh? Get started" is present from the first render; incomplete onboarding resumes at the saved step; `?mode` links route correctly; flag off renders the old page.
- Screenshots at 390 and 1440 of every sign-in screen, including both Code stages; a recording of the sleep-to-wake on Welcome back, a wrong then right code, the 30-second stage, and a wrong then right password.

## 6. Passwords at sign-up and in Settings (onboarding addendum)
- **Sign-up, email path only:** right after the code screen (screen 3), one optional screen: "Want a password too?" with "Optional. You can always log in with a code." A password field (10 characters minimum, show/hide toggle, `autocomplete="new-password"`), **Add a password** (primary) and **Skip for now** (equal weight, never hidden). Saved with `supabase.auth.updateUser({ password })` on the session the code just created. Stubby: `idle`; on save, `yours` (wink, the tab punched). Google and Apple sign-ups skip this screen.
- It is not a numbered step and does not change "1 of 3" (that counter is for screens 7 to 9 only). Resume treats it as part of the code step.
- **Settings > Account:** "Add a password" when the account has none, "Change password" when it has one (the existing change-password form, 10 characters minimum). Both are reachable for code-only, Google and Apple accounts.
- Copy for both is in §4.
- The sign-up Code screen (onboarding screen 3) uses the same three stages as §2, without "Log in with password" (there is no password yet).

## 7. Follow-up PR (after #227): tell a newcomer in their inbox, not on screen
When a sign-in code is requested for an email with no account, send that address one short email instead of nothing: subject "Your Soosh login", body "Someone tried to log in to Soosh with this email, but there's no account for it yet. If that was you, you can join here: [Get started]. If it wasn't you, you can ignore this." The person who owns the inbox gets a clear answer; anyone else learns nothing from the screen.
- Needs a server-side step (an Edge Function or database hook) because Supabase sends nothing for unknown emails with `shouldCreateUser: false`.
- Limit: at most one such email per address per 24 hours, and the normal per-IP request limits, so it can't be used to spam people.
- Never reveal in the response or its timing whether this email or a code was sent.
- Not in #227. Its own small PR, with a verification script for the limit.
