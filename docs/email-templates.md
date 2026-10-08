# Auth email templates

Soosh versions of every Supabase Auth email live in `supabase/templates/`. They
are not applied automatically to the hosted project. Paste each one by hand:

**Supabase dashboard → Authentication → Emails** (Email Templates). For each
row: open the tab, set **Subject**, replace the **Message body** (source view)
with the file, save.

| File | Dashboard tab | Subject line | Button |
|---|---|---|---|
| `invite.html` | Invite user | You’re invited to Soosh | Accept invite |
| `confirmation.html` | Confirm sign up | Confirm your email for Soosh | Confirm email |
| `magic_link.html` | Magic link | Your Soosh login link | Log in |
| `recovery.html` | Reset password | Reset your Soosh password | Reset password |
| `email_change.html` | Change email address | Confirm your new email for Soosh | Confirm new email |

## Rules these follow

- Style guide: sentence case, no dashes, no exclamation marks, curly apostrophes, one label per action.
- One button per email. Below it, a plain link repeats the same URL for mail clients that block buttons.
- Only real Supabase variables, and only: `{{ .ConfirmationURL }}` (every template), `{{ .Email }}` (every template), `{{ .NewEmail }}` (`email_change.html` only). No placeholders.
- Inline styles and tables only (mail clients drop `<style>`), light colors from the paper theme in `src/styles/theme.css`, 480px wide so it fits a phone.
- The name "Soosh" is written out: the templates are plain HTML and cannot read `APP_NAME` from `src/app/config.ts`. If the app is renamed, search `supabase/templates/` too.

## Also set by hand

- **Authentication → URL Configuration:** Site URL and redirect URLs must be the production domain (`SITE_ORIGIN` in `src/app/config.ts`), or the button in every email points at the wrong place.
- **Sender:** the From name and address come from the project's SMTP settings (Authentication → SMTP). The default Supabase sender is rate limited and shows "Supabase Auth"; set your own SMTP sender named Soosh.
- Previews: rendered screenshots are in `docs/qa/round-3/email-*.png`.
