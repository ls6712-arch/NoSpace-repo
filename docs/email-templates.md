# Auth email templates

Soosh versions of every Supabase Auth email live in `supabase/templates/`. They
are not applied automatically to the hosted project. Paste each one by hand:

**Supabase dashboard → Authentication → Emails** (Email Templates). For each
row: open the tab, set **Subject**, replace the **Message body** (source view)
with the file, save.

| File | Dashboard tab | Subject line | Button |
|---|---|---|---|
| `invite.html` | Invite user | You’re invited to Soosh | Accept invite |
| `confirmation.html` | Confirm sign up | Your Soosh code | Confirm email (and the 6-digit code) |
| `magic_link.html` | Magic link | Your Soosh code | Log in (and the 6-digit code) |
| `recovery.html` | Reset password | Reset your Soosh password | Reset password |
| `email_change.html` | Change email address | Confirm your new email for Soosh | Confirm new email |

## Rules these follow

- Style guide: sentence case, no dashes, no exclamation marks, curly apostrophes, one label per action.
- One button per email. Below it, a plain link repeats the same URL for mail clients that block buttons. `confirmation.html` and `magic_link.html` also print the 6-digit code above the button.
- Only real Supabase variables, and only: `{{ .ConfirmationURL }}` (every template), `{{ .Email }}` (every template), `{{ .Token }}` (`confirmation.html` and `magic_link.html` only: the 6-digit sign-in code), `{{ .NewEmail }}` (`email_change.html` only). No placeholders.
- Inline styles and tables only (mail clients drop `<style>`), light colors from the paper theme in `src/styles/theme.css`, 480px wide so it fits a phone.
- The name "Soosh" is written out: the templates are plain HTML and cannot read `APP_NAME` from `src/app/config.ts`. If the app is renamed, search `supabase/templates/` too.

## Also set by hand

- **Authentication → URL Configuration:** Site URL and redirect URLs must be the production domain (`SITE_ORIGIN` in `src/app/config.ts`), or the button in every email points at the wrong place.
- **Sender:** the From name and address come from the project's SMTP settings (Authentication → SMTP). The default Supabase sender is rate limited and shows "Supabase Auth"; set your own SMTP sender named Soosh.
- Previews: rendered screenshots are in `docs/qa/round-3/email-*.png`.

## Turn on email codes (do this before the onboarding flag goes on in production)

The new sign-up (Soosh onboarding) has no password: a person types their email,
gets a 6-digit code, and types it back. Supabase sends that code in the same
emails it uses for links, so two templates have to print `{{ .Token }}`. A
brand-new address gets the **Confirm sign up** email; an address that already
has an account gets the **Magic link** email. Both need the change, and both
files still carry the button, so the older password sign-up keeps working.

1. Open the Supabase dashboard, pick the Soosh project, and go to
   **Authentication** in the left menu, then **Emails** (older dashboards call
   this **Email Templates**).
2. Open **Templates**, then the **Confirm sign up** tab.
   - **Subject**: `Your Soosh code`
   - **Message body**: switch to the **Source** view, select everything, delete
     it, and paste the whole contents of `supabase/templates/confirmation.html`.
   - Click **Save changes**.
3. Open the **Magic link** tab and do the same with the subject `Your Soosh code`
   and the contents of `supabase/templates/magic_link.html`. Save.
4. Go to **Authentication**, then **Sign In / Providers** (older: **Providers**),
   and open **Email**. Check that:
   - **Enable Email provider** is on,
   - **Confirm email** is on (this is what makes a new person's first email the
     Confirm sign up one),
   - **Email OTP Length** is `6` (the default). Leave the expiration at the
     default (3600 seconds).
   Save if you changed anything.
5. Go to **Authentication**, then **SMTP Settings**, and check custom SMTP is on
   with a sender named Soosh. Supabase's built-in sender is limited to a few
   emails an hour, which is far too few for sign-ups. If it is not set up, set it
   up first; also check **Authentication**, **Rate Limits**, **Rate limit for
   sending emails** is high enough for launch day.
   Also set the minimum time between emails to the same person (**SMTP Settings**,
   **Minimum interval between emails being sent**, or **Minimum interval per
   user**) to `30` seconds. The code screen counts down 30 seconds before it
   offers another code; with Supabase's default of 60 seconds a person who asks at
   the 30 second mark would be told to wait again.
6. Test on a preview build with `VITE_SOOSH_ONBOARDING=1`, not on production:
   - Sign up with an address that has no account. The email must show a 6-digit
     code and a button. Type the code in; you land on the name screen.
   - Ask for a code with an address that already has an account (use
     **I already have an account**, then the log in page): that email must show a
     code too.
   - Log in with an existing password account on `/login`: unchanged.
7. Only then add `VITE_SOOSH_ONBOARDING=1` to the production environment in
   Vercel (**Settings**, **Environment Variables**) and redeploy.

If the email arrives with a link and no code, the template was not saved or the
wrong tab was edited: check **Confirm sign up** and **Magic link** both show
`{{ .Token }}` in the Source view.
