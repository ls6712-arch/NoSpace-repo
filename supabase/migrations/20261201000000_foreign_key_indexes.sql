-- Soosh: an index under every foreign key that had none, and one duplicate index removed.
--
-- Rollback: rollback_20261201000000_foreign_key_indexes.sql.
-- Verification: supabase/verification/foreign_key_indexes_check.sql.
--
-- Supabase's advisor (unindexed_foreign_keys) listed 54 foreign keys with no index on Nov 11, 2026
-- (launch audit). Without one, deleting or renaming the row a key points at (a person closing their
-- account, a Moment removed, a Space deleted) scans the whole referencing table, and so does any join
-- along that key. Every one is a single column. The tables are small today, so plain
-- "create index" inside the migration is quick; nothing here changes what a query returns.
--
-- The advisor also found two identical unique constraints on corners (space_slug, slug):
-- corners_space_slug_slug_key and corners_space_slug_unique. The first is the one a foreign key
-- depends on, so it stays; the second is dropped. The uniqueness rule itself is unchanged.

create index if not exists bookmarks_post_id_fk_idx on public.bookmarks (post_id);
create index if not exists category_suggestions_reviewed_by_fk_idx on public.category_suggestions (reviewed_by);
create index if not exists category_suggestions_suggested_by_fk_idx on public.category_suggestions (suggested_by);
create index if not exists city_picks_corner_id_fk_idx on public.city_picks (corner_id);
create index if not exists city_picks_created_by_fk_idx on public.city_picks (created_by);
create index if not exists conversation_reads_participation_id_fk_idx on public.conversation_reads (participation_id);
create index if not exists drops_created_by_fk_idx on public.drops (created_by);
create index if not exists invites_claimed_by_fk_idx on public.invites (claimed_by);
create index if not exists messages_from_user_fk_idx on public.messages (from_user);
create index if not exists moderation_queue_reported_by_fk_idx on public.moderation_queue (reported_by);
create index if not exists notifications_actor_id_fk_idx on public.notifications (actor_id);
create index if not exists personal_picks_ask_id_fk_idx on public.personal_picks (ask_id);
create index if not exists personal_picks_corner_id_fk_idx on public.personal_picks (corner_id);
create index if not exists plan_suggestions_friend_id_fk_idx on public.plan_suggestions (friend_id);
create index if not exists plans_creator_id_fk_idx on public.plans (creator_id);
create index if not exists post_reflections_user_id_fk_idx on public.post_reflections (user_id);
create index if not exists private_logs_project_id_fk_idx on public.private_logs (project_id);
create index if not exists profiles_cover_post_id_fk_idx on public.profiles (cover_post_id);
create index if not exists profiles_invited_by_fk_idx on public.profiles (invited_by);
create index if not exists pursuit_applause_pursuit_id_fk_idx on public.pursuit_applause (pursuit_id);
create index if not exists pursuit_applause_user_id_fk_idx on public.pursuit_applause (user_id);
create index if not exists pursuit_attendance_pursuit_id_fk_idx on public.pursuit_attendance (pursuit_id);
create index if not exists pursuit_attendance_user_id_fk_idx on public.pursuit_attendance (user_id);
create index if not exists pursuit_contributions_post_id_fk_idx on public.pursuit_contributions (post_id);
create index if not exists pursuit_contributions_session_id_fk_idx on public.pursuit_contributions (session_id);
create index if not exists pursuit_contributions_user_id_fk_idx on public.pursuit_contributions (user_id);
create index if not exists pursuit_discussion_parent_id_fk_idx on public.pursuit_discussion (parent_id);
create index if not exists pursuit_discussion_user_id_fk_idx on public.pursuit_discussion (user_id);
create index if not exists pursuit_invite_links_created_by_fk_idx on public.pursuit_invite_links (created_by);
create index if not exists pursuit_meetings_user_id_fk_idx on public.pursuit_meetings (user_id);
create index if not exists pursuit_members_invited_by_fk_idx on public.pursuit_members (invited_by);
create index if not exists pursuit_notices_pursuit_id_fk_idx on public.pursuit_notices (pursuit_id);
create index if not exists pursuit_personal_goals_user_id_fk_idx on public.pursuit_personal_goals (user_id);
create index if not exists pursuit_progress_post_id_fk_idx on public.pursuit_progress (post_id);
create index if not exists pursuit_progress_user_id_fk_idx on public.pursuit_progress (user_id);
create index if not exists pursuit_sessions_created_by_fk_idx on public.pursuit_sessions (created_by);
create index if not exists pursuits_space_id_fk_idx on public.pursuits (space_id);
create index if not exists reactions_user_id_fk_idx on public.reactions (user_id);
create index if not exists reports_reviewed_by_fk_idx on public.reports (reviewed_by);
create index if not exists reports_target_user_id_fk_idx on public.reports (target_user_id);
create index if not exists scout_runs_started_by_fk_idx on public.scout_runs (started_by);
create index if not exists space_deletion_approvals_host_user_id_fk_idx on public.space_deletion_approvals (host_user_id);
create index if not exists space_deletion_requests_requested_by_fk_idx on public.space_deletion_requests (requested_by);
create index if not exists space_deletion_requests_space_id_fk_idx on public.space_deletion_requests (space_id);
create index if not exists space_events_created_by_fk_idx on public.space_events (created_by);
create index if not exists space_host_invites_invited_by_fk_idx on public.space_host_invites (invited_by);
create index if not exists space_host_invites_invited_user_id_fk_idx on public.space_host_invites (invited_user_id);
create index if not exists space_join_requests_user_id_fk_idx on public.space_join_requests (user_id);
create index if not exists space_members_invited_by_fk_idx on public.space_members (invited_by);
create index if not exists spaces_created_by_fk_idx on public.spaces (created_by);
create index if not exists standing_slots_created_by_fk_idx on public.standing_slots (created_by);
create index if not exists stubby_feedback_pick_id_fk_idx on public.stubby_feedback (pick_id);
create index if not exists stubs_event_id_fk_idx on public.stubs (event_id);
create index if not exists stubs_issued_by_fk_idx on public.stubs (issued_by);

alter table public.corners drop constraint if exists corners_space_slug_unique;
