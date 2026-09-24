# Ticket: username editing

**Status:** not started, no UI exists yet. Noted while auditing `profiles`
grants during the pause/deletion privacy hardening workstream
(2026-09-20) — `profile_settings.username_changed_at` exists in the schema
but nothing in `src/` reads or writes it, and `username` is deliberately
excluded from the `profiles` UPDATE column grant added in
`20260920010000_profiles_is_admin_lock.sql`.

## What's needed when this gets built (with the Settings Profile section)

1. **Column grant** — `username` isn't in the current allow-list:
   ```sql
   grant update (username) on public.profiles to authenticated;
   ```
   (alongside whatever new client code and RLS work the feature needs —
   this is just the grant piece, not the whole feature).

2. **30-day change-limit trigger** — `profile_settings.username_changed_at`
   already exists for exactly this, but nothing enforces it today. Needs a
   `BEFORE UPDATE OF username ON profiles` trigger (or a check inside a
   dedicated RPC, if username changes go through one instead of a plain
   client-side update) that:
   - rejects the change if `now() - username_changed_at < interval '30 days'`
     for that user's `profile_settings` row (skip the check if
     `username_changed_at` is null — first change is free)
   - updates `profile_settings.username_changed_at = now()` on a successful
     change

3. Decide whether username changes go through a plain client-side
   `.update()` (simplest, but the availability/uniqueness check would need
   to happen RLS/trigger-side too) or a dedicated `SECURITY DEFINER` RPC
   (centralizes the availability check, the 30-day check, and the
   `profile_settings` write in one place — closer to how `set_thread_answered`
   and the admin functions are already structured in this codebase).

Not scheduled — do not build ahead of the Settings Profile section actually
needing it.
