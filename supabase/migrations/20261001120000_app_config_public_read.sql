-- Fix forward from 20260924098000_spaces_rework_app_config.sql (already
-- run live — never edit that file, see CLAUDE.md).
--
-- app_config's only SELECT policy was "signed in" (auth.uid() is not
-- null). But every row in the table today is a client-side tuning knob
-- read unconditionally on mount by CornersContext.refresh() — including
-- for signed-out Discover visitors, which the app explicitly supports
-- (see CornersContext.tsx's own header comment: "derived from whatever's
-- in the local/demo feed, so tagging still works before anyone has an
-- account"). A signed-out reader, or a request that races ahead of
-- AuthContext finishing session hydration, got 0 rows back from
-- PostgREST, which the app's `.single()` calls turned into a 406 on every
-- such page load in prod and preview.
--
-- None of app_config's four seeded keys (corner_min_moments_30d,
-- space_creation_limit, trademark_blocklist, invites_per_new_member) is
-- sensitive — they're tuning numbers and a word list, not user data —
-- so the fix is to make the table genuinely publicly readable rather than
-- gating it on a session. Writes stay admin-only; "admins manage
-- app_config" is untouched.

drop policy if exists "app_config is readable when signed in" on public.app_config;
create policy "app_config is publicly readable"
  on public.app_config for select
  using (true);
