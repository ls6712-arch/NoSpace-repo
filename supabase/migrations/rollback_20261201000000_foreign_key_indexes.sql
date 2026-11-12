-- Rollback for 20261201000000_foreign_key_indexes.sql: removes the 54 indexes it added and
-- puts the second, identical unique constraint on corners back.
drop index if exists public.bookmarks_post_id_fk_idx;
drop index if exists public.category_suggestions_reviewed_by_fk_idx;
drop index if exists public.category_suggestions_suggested_by_fk_idx;
drop index if exists public.city_picks_corner_id_fk_idx;
drop index if exists public.city_picks_created_by_fk_idx;
drop index if exists public.conversation_reads_participation_id_fk_idx;
drop index if exists public.drops_created_by_fk_idx;
drop index if exists public.invites_claimed_by_fk_idx;
drop index if exists public.messages_from_user_fk_idx;
drop index if exists public.moderation_queue_reported_by_fk_idx;
drop index if exists public.notifications_actor_id_fk_idx;
drop index if exists public.personal_picks_ask_id_fk_idx;
drop index if exists public.personal_picks_corner_id_fk_idx;
drop index if exists public.plan_suggestions_friend_id_fk_idx;
drop index if exists public.plans_creator_id_fk_idx;
drop index if exists public.post_reflections_user_id_fk_idx;
drop index if exists public.private_logs_project_id_fk_idx;
drop index if exists public.profiles_cover_post_id_fk_idx;
drop index if exists public.profiles_invited_by_fk_idx;
drop index if exists public.pursuit_applause_pursuit_id_fk_idx;
drop index if exists public.pursuit_applause_user_id_fk_idx;
drop index if exists public.pursuit_attendance_pursuit_id_fk_idx;
drop index if exists public.pursuit_attendance_user_id_fk_idx;
drop index if exists public.pursuit_contributions_post_id_fk_idx;
drop index if exists public.pursuit_contributions_session_id_fk_idx;
drop index if exists public.pursuit_contributions_user_id_fk_idx;
drop index if exists public.pursuit_discussion_parent_id_fk_idx;
drop index if exists public.pursuit_discussion_user_id_fk_idx;
drop index if exists public.pursuit_invite_links_created_by_fk_idx;
drop index if exists public.pursuit_meetings_user_id_fk_idx;
drop index if exists public.pursuit_members_invited_by_fk_idx;
drop index if exists public.pursuit_notices_pursuit_id_fk_idx;
drop index if exists public.pursuit_personal_goals_user_id_fk_idx;
drop index if exists public.pursuit_progress_post_id_fk_idx;
drop index if exists public.pursuit_progress_user_id_fk_idx;
drop index if exists public.pursuit_sessions_created_by_fk_idx;
drop index if exists public.pursuits_space_id_fk_idx;
drop index if exists public.reactions_user_id_fk_idx;
drop index if exists public.reports_reviewed_by_fk_idx;
drop index if exists public.reports_target_user_id_fk_idx;
drop index if exists public.scout_runs_started_by_fk_idx;
drop index if exists public.space_deletion_approvals_host_user_id_fk_idx;
drop index if exists public.space_deletion_requests_requested_by_fk_idx;
drop index if exists public.space_deletion_requests_space_id_fk_idx;
drop index if exists public.space_events_created_by_fk_idx;
drop index if exists public.space_host_invites_invited_by_fk_idx;
drop index if exists public.space_host_invites_invited_user_id_fk_idx;
drop index if exists public.space_join_requests_user_id_fk_idx;
drop index if exists public.space_members_invited_by_fk_idx;
drop index if exists public.spaces_created_by_fk_idx;
drop index if exists public.standing_slots_created_by_fk_idx;
drop index if exists public.stubby_feedback_pick_id_fk_idx;
drop index if exists public.stubs_event_id_fk_idx;
drop index if exists public.stubs_issued_by_fk_idx;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint con
     where con.conrelid = 'public.corners'::regclass and con.conname = 'corners_space_slug_unique'
  ) then
    alter table public.corners add constraint corners_space_slug_unique unique (space_slug, slug);
  end if;
end
$$;
