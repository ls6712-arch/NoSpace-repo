-- Verification for supabase/migrations/20261007000000_communication_phase5_notifications.sql.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Same impersonation pattern as Phases 1-4's own scripts — one transaction
-- ending in ROLLBACK, `set_config('role', 'authenticated', true)` once,
-- then `set_config('request.jwt.claims', ...)` per step to switch which
-- real account auth.uid() resolves to. Three real accounts:
--   Sush ........ the actor throughout (leaves Thoughts, invites, etc.)
--   spd0008 ..... the recipient who mutes things, across every category
--   Nani ........ an uninvolved bystander — proves muting is per-recipient,
--                 not global, and that nobody else can read or change
--                 spd0008's settings
--
-- Proves:
--   1.  A missing profile_settings row reads as "nothing muted".
--   2.  Muting 'thoughts' drops a new `thought` notification for that
--       recipient only.
--   3.  A different category, same (muted) recipient, is unaffected.
--   4.  The same category, a different (unmuted) recipient, is unaffected.
--   5.  Unmuting restores delivery.
--   6.  A notification inserted by a SECURITY DEFINER trigger
--       (notify_pursuit_membership, on a real pursuit_members insert) is
--       dropped the same way when its category is muted, and restored
--       once unmuted — muting isn't something a client-side insert path
--       can route around.
--   7.  Every space_* kind is never dropped, even with every mutable
--       category (and circle_invites) muted at once.
--   8.  Circle invitations mute through the EXISTING `circle_invites`
--       boolean, not the new array, and restore the same way. Every kind
--       under 'make_together_explore_together' (make_together,
--       explore_together, accepted, joined) and 'message_requests' is
--       also confirmed dropped while muted.
--   9.  The Phase 1 block-between rule still holds (unrelated to muting).
--  10.  `message` is still accepted by the kind allowlist (Phase 3's own
--       behaviour — nothing here narrows it further).
--  11.  Nobody but the recipient can read or change their own mute
--       settings: profile_settings' existing RLS is unchanged, and the new
--       private helper itself is unreachable by anyone (SQL-level
--       permission-denied, not just "not exposed via PostgREST" — the
--       latter isn't something this script can observe directly).

-- Fixed Sept 26 before the live run: a sender can't SELECT the recipient's
-- notifications, so `insert ... returning` failed RLS and the pursuit checks
-- read as the wrong person. Now uses row counts, reads as the recipient,
-- and only counts rows created in this transaction. Live result: all 20 true.
begin;

do $$
declare
  v_sush uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_spd uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';
  v_nani uuid := '2410e037-9cb5-4459-a0ca-e70a59b8f2c0';

  v_post_spd bigint;  -- spd0008's own Moment, for Sush to leave Thoughts on
  v_post_nani bigint; -- Nani's own Moment, same purpose

  v_pursuit_id text := 'phase5v-mute-test';

  v_missing_row_not_muted boolean;
  v_muted_thoughts_dropped boolean;
  v_muted_other_kind_unaffected boolean;
  v_muted_other_person_unaffected boolean;
  v_unmuted_restores boolean;
  v_security_definer_dropped boolean;
  v_security_definer_restored boolean;
  v_space_kind_never_dropped boolean;
  v_circle_invite_muted boolean;
  v_circle_invite_restored boolean;
  v_make_explore_ask_dropped boolean;
  v_explore_ask_dropped boolean;
  v_make_explore_accepted_dropped boolean;
  v_make_explore_joined_dropped boolean;
  v_message_requests_dropped boolean;
  v_block_rule_still_holds boolean;
  v_message_kind_still_accepted boolean;
  v_helper_unreachable_by_others boolean;
  v_others_cant_read_settings boolean;
  v_others_cant_update_settings boolean;

  v_notif_id bigint;
  v_caught boolean;
  v_rows_updated int;
begin
  perform set_config('role', 'authenticated', true);

  -- ═══════════════════════════════════════════════════════════════════
  -- Setup: one Moment each for spd0008 and Nani (for Thoughts targets),
  -- and a clean slate on both test recipients' profile_settings.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_spd, 'writing', 'written', '', 'Phase 5 verification post (spd0008)', 'public')
  returning id into v_post_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_nani, 'writing', 'written', '', 'Phase 5 verification post (Nani)', 'public')
  returning id into v_post_nani;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  delete from public.profile_settings where user_id = v_spd;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  delete from public.profile_settings where user_id = v_nani;

  -- ═══════════════════════════════════════════════════════════════════
  -- 1. Missing settings row = nothing muted.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'thought', 'Sush left a thought on your moment.', '/moment/' || v_post_spd, 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_missing_row_not_muted := (v_rows_updated > 0);

  -- ═══════════════════════════════════════════════════════════════════
  -- 2-5. Mute 'thoughts' for spd0008 only.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.profile_settings (user_id, notification_preferences)
  values (v_spd, jsonb_build_object('muted', jsonb_build_array('thoughts')))
  on conflict (user_id) do update set notification_preferences = excluded.notification_preferences;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'thought', 'Sush left a thought on your moment.', '/moment/' || v_post_spd, 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_muted_thoughts_dropped := (v_rows_updated = 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'joined', 'Sush joined your activity.', '/my-space', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_muted_other_kind_unaffected := (v_rows_updated > 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_nani, 'thought', 'Sush left a thought on your moment.', '/moment/' || v_post_nani, 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_muted_other_person_unaffected := (v_rows_updated > 0);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = jsonb_build_object('muted', '[]'::jsonb)
  where user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'thought', 'Sush left a thought on your moment.', '/moment/' || v_post_spd, 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_unmuted_restores := (v_rows_updated > 0);

  -- ═══════════════════════════════════════════════════════════════════
  -- 6. A SECURITY DEFINER trigger's own insert (notify_pursuit_membership,
  --    firing pursuit_invite on a real pursuit_members row) respects the
  --    same mute — proves this can't be routed around by inserting
  --    through a different path than a direct client insert.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = jsonb_build_object('muted', jsonb_build_array('pursuit_activity'))
  where user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.pursuits (id, user_id, title) values (v_pursuit_id, v_sush, 'Phase 5 verification pursuit');
  insert into public.pursuit_members (pursuit_id, user_id, role, status)
  values (v_pursuit_id, v_spd, 'member', 'invited');
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select not exists(
    select 1 from public.notifications
    where user_id = v_spd and kind = 'pursuit_invite' and actor_name = 'Sush' and created_at = now()
  ) into v_security_definer_dropped;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);

  delete from public.pursuit_members where pursuit_id = v_pursuit_id and user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = jsonb_build_object('muted', '[]'::jsonb)
  where user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.pursuit_members (pursuit_id, user_id, role, status)
  values (v_pursuit_id, v_spd, 'member', 'invited');
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select exists(
    select 1 from public.notifications
    where user_id = v_spd and kind = 'pursuit_invite' and actor_name = 'Sush' and created_at = now()
  ) into v_security_definer_restored;

  -- ═══════════════════════════════════════════════════════════════════
  -- 7. Every mutable category (and circle_invites) muted at once —
  --    space_* kinds still get through unconditionally.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = jsonb_build_object(
    'muted', jsonb_build_array('thoughts', 'pursuit_activity', 'make_together_explore_together', 'message_requests'),
    'circle_invites', false
  )
  where user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'space_join_approved', 'You''re in Phase 5 Test Space.', '/space/phase5v-test', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_space_kind_never_dropped := (v_rows_updated > 0);

  -- ═══════════════════════════════════════════════════════════════════
  -- 8. Circle invitations mute through the EXISTING circle_invites key,
  --    already set to false by the block above — and restore.
  -- ═══════════════════════════════════════════════════════════════════
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'circle_invite', 'Sush invited you to a Circle.', '/circles', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_circle_invite_muted := (v_rows_updated = 0);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = notification_preferences || jsonb_build_object('circle_invites', true)
  where user_id = v_spd;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'circle_invite', 'Sush invited you to a Circle.', '/circles', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_circle_invite_restored := (v_rows_updated > 0);

  -- ═══════════════════════════════════════════════════════════════════
  -- 8b. 'make_together_explore_together' and 'message_requests' are still muted at this
  --     point too (set in step 7 above, untouched by step 8's
  --     circle_invites-only change) — confirm every kind each category
  --     maps to is actually dropped, not just 'thoughts'/'pursuit_activity'.
  --     Includes make_together/explore_together themselves — real,
  --     live-inserted rows (requestTogether() in SocialContext.tsx), not
  --     just their acceptance/join counterparts.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'make_together', 'Sush asked to make together: a quilt.', '/you', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_make_explore_ask_dropped := (v_rows_updated = 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'explore_together', 'Sush asked to explore together: a trailhead.', '/you', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_explore_ask_dropped := (v_rows_updated = 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'accepted', 'Sush accepted your Make together request.', '/messages', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_make_explore_accepted_dropped := (v_rows_updated = 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'joined', 'Sush joined your activity.', '/my-space', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_make_explore_joined_dropped := (v_rows_updated = 0);

  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'message_request', 'Sush wants to message you.', '/messages?tab=requests', 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_message_requests_dropped := (v_rows_updated = 0);

  -- Clean slate before the remaining checks — nothing muted from here on,
  -- so any drop below is attributable only to what that check is testing.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings
  set notification_preferences = jsonb_build_object('muted', '[]'::jsonb, 'circle_invites', true)
  where user_id = v_spd;

  -- ═══════════════════════════════════════════════════════════════════
  -- 9. Phase 1's block-between rule is untouched (unrelated to muting —
  --    spd0008 has nothing muted at this point).
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.blocks (blocker_id, blocked_id) values (v_spd, v_sush);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_notif_id := null;
  insert into public.notifications (user_id, kind, body, href, actor_name)
  values (v_spd, 'thought', 'Sush left a thought on your moment.', '/moment/' || v_post_spd, 'Sush');
  get diagnostics v_rows_updated = row_count;
  v_block_rule_still_holds := (v_rows_updated = 0);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  delete from public.blocks where blocker_id = v_spd and blocked_id = v_sush;

  -- ═══════════════════════════════════════════════════════════════════
  -- 10. `message` is still an accepted kind (Phase 3's own behaviour —
  --     nothing here narrows the allowlist further).
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  begin
    v_notif_id := null;
    insert into public.notifications (user_id, kind, body, actor_name)
    values (v_spd, 'message', 'legacy message-kind row (Phase 3 already stopped creating these)', 'Sush')
    ;
    get diagnostics v_rows_updated = row_count;
    v_message_kind_still_accepted := (v_rows_updated > 0);
  exception when others then
    v_message_kind_still_accepted := false;
  end;

  -- ═══════════════════════════════════════════════════════════════════
  -- 11. Nobody but spd0008 can read or change their own settings — the
  --     existing profile_settings RLS, and the new private helper itself.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  select (count(*) = 0) into v_others_cant_read_settings
  from public.profile_settings where user_id = v_spd;

  update public.profile_settings
  set notification_preferences = jsonb_build_object('muted', jsonb_build_array('thoughts'))
  where user_id = v_spd;
  get diagnostics v_rows_updated = row_count;
  v_others_cant_update_settings := (v_rows_updated = 0);

  v_caught := false;
  begin
    perform private.notification_kind_muted(v_spd, 'thought');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  v_helper_unreachable_by_others := v_caught;

  raise exception 'RESULTS: missing_row_not_muted=% muted_thoughts_dropped=% muted_other_kind_unaffected=% muted_other_person_unaffected=% unmuted_restores=% security_definer_dropped=% security_definer_restored=% space_kind_never_dropped=% circle_invite_muted=% circle_invite_restored=% make_explore_ask_dropped=% explore_ask_dropped=% make_explore_accepted_dropped=% make_explore_joined_dropped=% message_requests_dropped=% block_rule_still_holds=% message_kind_still_accepted=% helper_unreachable_by_others=% others_cant_read_settings=% others_cant_update_settings=%',
    v_missing_row_not_muted, v_muted_thoughts_dropped, v_muted_other_kind_unaffected, v_muted_other_person_unaffected,
    v_unmuted_restores, v_security_definer_dropped, v_security_definer_restored, v_space_kind_never_dropped,
    v_circle_invite_muted, v_circle_invite_restored, v_make_explore_ask_dropped, v_explore_ask_dropped,
    v_make_explore_accepted_dropped, v_make_explore_joined_dropped,
    v_message_requests_dropped, v_block_rule_still_holds, v_message_kind_still_accepted,
    v_helper_unreachable_by_others, v_others_cant_read_settings, v_others_cant_update_settings;
end $$;

rollback;
