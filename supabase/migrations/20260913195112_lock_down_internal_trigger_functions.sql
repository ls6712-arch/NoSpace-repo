-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

-- These are internal helpers/triggers, never called directly from the app.
-- They currently have EXECUTE granted to anon/authenticated, meaning anyone
-- could invoke them directly via the REST RPC endpoint (bypassing the normal
-- insert/trigger flow they were written for). Revoking direct EXECUTE does
-- NOT break their use as triggers or as internal calls from other
-- SECURITY DEFINER functions, since those run under the function owner.

revoke execute on function public.enforce_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rl_category_suggestions() from public, anon, authenticated;
revoke execute on function public.rl_circle_members() from public, anon, authenticated;
revoke execute on function public.rl_circles() from public, anon, authenticated;
revoke execute on function public.rl_connections() from public, anon, authenticated;
revoke execute on function public.rl_corners() from public, anon, authenticated;
revoke execute on function public.rl_messages() from public, anon, authenticated;
revoke execute on function public.rl_notifications() from public, anon, authenticated;
revoke execute on function public.rl_participations() from public, anon, authenticated;
revoke execute on function public.rl_posts() from public, anon, authenticated;
revoke execute on function public.rl_space_members() from public, anon, authenticated;
revoke execute on function public.rl_thoughts() from public, anon, authenticated;
revoke execute on function public.sync_corner_moment_count() from public, anon, authenticated;

-- set_thread_answered and real_circle_member_counts ARE called directly by
-- the app via supabase.rpc(), so their execute grants are left alone.

-- Fix the mutable search_path warning on the one function actually flagged.
alter function public.set_thread_answered(bigint, boolean) set search_path = public, pg_temp;
