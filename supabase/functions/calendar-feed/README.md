# calendar-feed

The private `.ics` feed behind "Copy subscribe link" (calendar brief, section 6).

- URL: `https://<project>.supabase.co/functions/v1/calendar-feed?token=<token>`. The app makes the token in the browser (32 random bytes, base64url), keeps it there, and sends only its SHA-256 to the database (`set_calendar_feed_token`, migration `20261114000000_calendar_feed.sql`). A reset revokes the old hash.
- Content: the person's plans and Pursuit sessions for the next 60 days. Each event is its title, place, time and a link to that day on their calendar. **Never** blocks, free time, budget, notes or other people's names.
- A malformed, unknown or reset token gets the same plain 404.

## Deploy (not done by any PR)

```bash
supabase functions deploy calendar-feed --no-verify-jwt
supabase secrets set SITE_URL=https://<the app's address>
```

Needs the migration applied first. Without `SITE_URL` the events have no link back.
