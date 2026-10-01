-- Harden trigger-function grants and pin a search_path.
--
-- BACKFILL: this file documents a migration that is already live
-- (recorded in supabase_migrations.schema_migrations as version
-- 20260925233120, name harden_trigger_function_grants) but was never
-- committed to this repo. Content reconstructed from the staged copy
-- that was applied; not re-run, not re-verified against a live pg_dump
-- of each function. Consistent with current security advisories: none
-- of the four functions below show up as publicly/anon-executable,
-- which is what revoking EXECUTE on them would produce.
--
-- Why: these SECURITY DEFINER trigger functions are exposed at /rest/v1/rpc/<name>
-- to signed-out (anon) and signed-in users. A trigger function never needs EXECUTE
-- granted to callers; Postgres checks that privilege only when the trigger is
-- created, not when it fires. The same pattern is already live on handle_new_user,
-- rl_posts, enforce_notification_insert etc. (migration lock_down_internal_trigger_functions),
-- so every trigger keeps working exactly as today.
--
-- Deliberately NOT changed:
--   * Spaces trigger functions (teammate is redesigning Spaces) -- see the
--     commented block at the bottom, for them to apply or skip.
--   * is_pursuit_participant / is_visible_profile: used inside RLS policies that
--     apply to anon; revoking would make signed-out reads error instead of filter.
--   * join_pursuit_via_link: already raises 'Sign in to join.' for anon; revoking
--     would change the error the app shows.
--   * pursuit_invite_preview: token-gated preview for the /join page.

begin;

-- 1. Pursuit and post-likes trigger functions: no direct calls.
revoke execute on function public.notify_pursuit_membership() from public, anon, authenticated;
revoke execute on function public.notify_pursuit_progress()   from public, anon, authenticated;
revoke execute on function public.rl_post_likes()             from public, anon, authenticated;
revoke execute on function public.sync_post_likes_count()     from public, anon, authenticated;

-- 2. Pin search_path on the display-name trigger (advisor: function_search_path_mutable).
--    Body only uses pg_catalog functions (lower, trim), so behaviour is unchanged.
alter function public.reject_test_display_names() set search_path = public;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL, Spaces owner to decide: same fix for the Spaces trigger functions.
-- Uncomment only with the teammate's OK.
--
-- revoke execute on function public.check_space_corners_limit()          from public, anon, authenticated;
-- revoke execute on function public.check_space_moments_featured_limit() from public, anon, authenticated;
-- revoke execute on function public.set_space_moment_status()            from public, anon, authenticated;
-- revoke execute on function public.start_host_handoff_if_last_host()    from public, anon, authenticated;
-- revoke execute on function public.sync_space_category_from_corner()    from public, anon, authenticated;
