-- An index under every foreign key that had none: 20261201000000_foreign_key_indexes.sql.
--
-- Not a migration. Run AFTER 20261201000000_foreign_key_indexes.sql; before it, cases 1, 2 and 4 fail.
-- One transaction, one do $$ ... $$ block, ending unconditionally in RAISE EXCEPTION 'RESULTS: ...'.
-- No select-into, no returning-into, no delete (CLAUDE.md). Read-only: it only reads the catalog, and
-- every lookup is scoped to the 54 foreign keys and the two corners constraints named here.
--
-- Cases:
--   1  each of the 54 indexes exists, is valid, and is on the table and column it is named for
--   2  each of the 54 foreign keys now has an index that starts with its column
--   3  corners (space_slug, slug) is still unique, by corners_space_slug_slug_key
--   4  the duplicate constraint corners_space_slug_unique is gone
--   5  the foreign key that depends on the kept constraint is still there

begin;

do $$
declare
  v_i int := 0;
  v_n int;
  v_t text;
  results text[] := '{}';
  -- table|column|foreign key
  v_expected text[] := array[
    'bookmarks|post_id|bookmarks_post_id_fkey',
    'category_suggestions|reviewed_by|category_suggestions_reviewed_by_fkey',
    'category_suggestions|suggested_by|category_suggestions_suggested_by_fkey',
    'city_picks|corner_id|city_picks_corner_id_fkey',
    'city_picks|created_by|city_picks_created_by_fkey',
    'conversation_reads|participation_id|conversation_reads_participation_id_fkey',
    'drops|created_by|drops_created_by_fkey',
    'invites|claimed_by|invites_claimed_by_fkey',
    'messages|from_user|messages_from_user_fkey',
    'moderation_queue|reported_by|moderation_queue_reported_by_fkey',
    'notifications|actor_id|notifications_actor_id_fkey',
    'personal_picks|ask_id|personal_picks_ask_id_fkey',
    'personal_picks|corner_id|personal_picks_corner_id_fkey',
    'plan_suggestions|friend_id|plan_suggestions_friend_id_fkey',
    'plans|creator_id|plans_creator_id_fkey',
    'post_reflections|user_id|post_reflections_user_id_fkey',
    'private_logs|project_id|private_logs_project_id_fkey',
    'profiles|cover_post_id|profiles_cover_post_id_fkey',
    'profiles|invited_by|profiles_invited_by_fkey',
    'pursuit_applause|pursuit_id|pursuit_applause_pursuit_id_fkey',
    'pursuit_applause|user_id|pursuit_applause_user_id_fkey',
    'pursuit_attendance|pursuit_id|pursuit_attendance_pursuit_id_fkey',
    'pursuit_attendance|user_id|pursuit_attendance_user_id_fkey',
    'pursuit_contributions|post_id|pursuit_contributions_post_id_fkey',
    'pursuit_contributions|session_id|pursuit_contributions_session_id_fkey',
    'pursuit_contributions|user_id|pursuit_contributions_user_id_fkey',
    'pursuit_discussion|parent_id|pursuit_discussion_parent_id_fkey',
    'pursuit_discussion|user_id|pursuit_discussion_user_id_fkey',
    'pursuit_invite_links|created_by|pursuit_invite_links_created_by_fkey',
    'pursuit_meetings|user_id|pursuit_meetings_user_id_fkey',
    'pursuit_members|invited_by|pursuit_members_invited_by_fkey',
    'pursuit_notices|pursuit_id|pursuit_notices_pursuit_id_fkey',
    'pursuit_personal_goals|user_id|pursuit_personal_goals_user_id_fkey',
    'pursuit_progress|post_id|pursuit_progress_post_id_fkey',
    'pursuit_progress|user_id|pursuit_progress_user_id_fkey',
    'pursuit_sessions|created_by|pursuit_sessions_created_by_fkey',
    'pursuits|space_id|pursuits_space_id_fkey',
    'reactions|user_id|reactions_user_id_fkey',
    'reports|reviewed_by|reports_reviewed_by_fkey',
    'reports|target_user_id|reports_target_user_id_fkey',
    'scout_runs|started_by|scout_runs_started_by_fkey',
    'space_deletion_approvals|host_user_id|space_deletion_approvals_host_user_id_fkey',
    'space_deletion_requests|requested_by|space_deletion_requests_requested_by_fkey',
    'space_deletion_requests|space_id|space_deletion_requests_space_id_fkey',
    'space_events|created_by|space_events_created_by_fkey',
    'space_host_invites|invited_by|space_host_invites_invited_by_fkey',
    'space_host_invites|invited_user_id|space_host_invites_invited_user_id_fkey',
    'space_join_requests|user_id|space_join_requests_user_id_fkey',
    'space_members|invited_by|space_members_invited_by_fkey',
    'spaces|created_by|spaces_created_by_fkey',
    'standing_slots|created_by|standing_slots_created_by_fkey',
    'stubby_feedback|pick_id|stubby_feedback_pick_id_fkey',
    'stubs|event_id|stubs_event_id_fkey',
    'stubs|issued_by|stubs_issued_by_fkey'
  ];
begin

  v_t := (select string_agg(e.tbl || '.' || e.col, ' ' order by e.tbl, e.col) from (select split_part(u.s, '|', 1) as tbl, split_part(u.s, '|', 2) as col, split_part(u.s, '|', 3) as fk from unnest(v_expected) as u(s)) e
           where not exists (
             select 1 from pg_catalog.pg_index x
               join pg_catalog.pg_class i on i.oid = x.indexrelid
               join pg_catalog.pg_class t on t.oid = x.indrelid
               join pg_catalog.pg_namespace n on n.oid = t.relnamespace
               join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = x.indkey[0]
              where n.nspname = 'public' and t.relname = e.tbl and i.relname = e.tbl || '_' || e.col || '_fk_idx'
                and a.attname = e.col and x.indisvalid and x.indnatts = 1 and x.indpred is null));
  v_i := v_i + 1;
  results := results || (v_i || case when v_t is null then ' PASS all 54 indexes exist and are valid' else ' FAIL missing: ' || v_t end);

  v_t := (select string_agg(e.fk, ' ' order by e.fk) from (select split_part(u.s, '|', 1) as tbl, split_part(u.s, '|', 2) as col, split_part(u.s, '|', 3) as fk from unnest(v_expected) as u(s)) e
           where not exists (
             select 1 from pg_catalog.pg_constraint con
               join pg_catalog.pg_class t on t.oid = con.conrelid
               join pg_catalog.pg_namespace n on n.oid = t.relnamespace
               join pg_catalog.pg_index x on x.indrelid = con.conrelid and x.indpred is null and x.indisvalid and x.indkey[0] = con.conkey[1]
              where n.nspname = 'public' and t.relname = e.tbl and con.conname = e.fk and con.contype = 'f'));
  v_i := v_i + 1;
  results := results || (v_i || case when v_t is null then ' PASS all 54 foreign keys are covered' else ' FAIL not covered (or gone): ' || v_t end);

  v_n := (select count(*) from pg_catalog.pg_constraint con
           where con.conrelid = 'public.corners'::regclass and con.conname = 'corners_space_slug_slug_key' and con.contype = 'u');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 1 then ' PASS corners (space_slug, slug) is still unique' else ' FAIL the kept unique constraint is missing' end);

  v_n := (select count(*) from pg_catalog.pg_constraint con
           where con.conrelid = 'public.corners'::regclass and con.conname = 'corners_space_slug_unique');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n = 0 then ' PASS the duplicate constraint is gone' else ' FAIL the duplicate constraint is still there' end);

  v_n := (select count(*) from pg_catalog.pg_constraint con
            join pg_catalog.pg_class i on i.oid = con.conindid
           where con.contype = 'f' and con.confrelid = 'public.corners'::regclass and i.relname = 'corners_space_slug_slug_key');
  v_i := v_i + 1;
  results := results || (v_i || case when v_n >= 1 then ' PASS the foreign key on the kept constraint is still there' else ' FAIL no foreign key uses the kept constraint' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;

rollback;
