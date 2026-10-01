-- Harden trigger-function grants and pin a search_path — verification.
--
-- Not a migration — nothing here alters the schema. Run this AFTER
-- 20260925233120_harden_trigger_function_grants.sql.
--
-- Same pattern as every earlier script: one transaction, one do $$ ... $$
-- block, ends unconditionally in RAISE EXCEPTION 'RESULTS: ...' so results
-- land in the error message the Editor shows and a rollback is guaranteed
-- regardless of outcome (this script performs no writes, so the rollback
-- is a formality here, not a safety net).
--
-- This migration only ever touched grants and one function's search_path
-- — it didn't change any trigger body or table — so the checks are scoped
-- to exactly that, not to exercising the triggers themselves (those are
-- covered by whichever script verifies the feature that defined them,
-- e.g. pursuit/post-likes checks).

begin;

do $$
declare
  v_i int := 0;
  results text[] := '{}';
  v_search_path text;
begin
  -- ───────────────────────────────────────────────────────────────────────
  -- 1-4. EXECUTE revoked from public, anon, and authenticated on each of
  -- the four trigger functions. has_function_privilege checks the
  -- *effective* grant (including via the PUBLIC pseudo-role), so this
  -- also catches the case where only an explicit anon/authenticated grant
  -- was revoked but PUBLIC's own grant was left standing.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_function_privilege('anon', 'public.notify_pursuit_membership()', 'EXECUTE')
          and not has_function_privilege('authenticated', 'public.notify_pursuit_membership()', 'EXECUTE')
         then 'PASS' else 'FAIL notify_pursuit_membership still callable' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_function_privilege('anon', 'public.notify_pursuit_progress()', 'EXECUTE')
          and not has_function_privilege('authenticated', 'public.notify_pursuit_progress()', 'EXECUTE')
         then 'PASS' else 'FAIL notify_pursuit_progress still callable' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_function_privilege('anon', 'public.rl_post_likes()', 'EXECUTE')
          and not has_function_privilege('authenticated', 'public.rl_post_likes()', 'EXECUTE')
         then 'PASS' else 'FAIL rl_post_likes still callable' end));

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when not has_function_privilege('anon', 'public.sync_post_likes_count()', 'EXECUTE')
          and not has_function_privilege('authenticated', 'public.sync_post_likes_count()', 'EXECUTE')
         then 'PASS' else 'FAIL sync_post_likes_count still callable' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 5. Spaces trigger functions were deliberately left untouched (teammate
  -- call) — confirms this migration didn't accidentally sweep them in too.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_function_privilege('anon', 'public.check_space_corners_limit()', 'EXECUTE')
         then 'PASS' else 'FAIL check_space_corners_limit was revoked too (out of scope for this migration)' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 6. is_pursuit_participant stayed callable by anon — revoking it would
  -- have broken RLS policies that call it directly for signed-out reads.
  -- ───────────────────────────────────────────────────────────────────────
  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when has_function_privilege('anon', 'public.is_pursuit_participant(text, uuid)', 'EXECUTE')
         then 'PASS' else 'FAIL is_pursuit_participant lost anon EXECUTE' end));

  -- ───────────────────────────────────────────────────────────────────────
  -- 7. reject_test_display_names: search_path pinned to 'public'.
  -- ───────────────────────────────────────────────────────────────────────
  select (select option_value from unnest(proconfig) as option_value
          where option_value like 'search_path=%' limit 1)
    into v_search_path
    from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'reject_test_display_names';

  v_i := v_i + 1;
  results := array_append(results, format('%s %s', v_i,
    case when v_search_path = 'search_path=public' then 'PASS' else 'FAIL search_path=' || coalesce(v_search_path, 'null (mutable)') end));

  -- ───────────────────────────────────────────────────────────────────────
  -- Done. This is the ONLY way this block ends.
  -- ───────────────────────────────────────────────────────────────────────
  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;

rollback;
