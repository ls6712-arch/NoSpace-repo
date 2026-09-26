-- Verification for supabase/migrations/20261005000000_communication_phase4_rich.sql.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Everything below runs inside one transaction that ends in ROLLBACK — same
-- impersonation pattern as Phases 1-3's own scripts (`set_config('role',
-- 'authenticated', true)` genuinely changes the effective role for
-- permission checks, which is what makes this script capable of catching a
-- real grant/RLS bug rather than silently running everything as the
-- postgres superuser).
--
-- Five real accounts, picked for specific reasons:
--   Sush, spd0008 — no pre-existing direct_message row, don't mutually
--     follow (a fresh thread between them genuinely starts pending, same
--     fact already verified for Phase 3's own script).
--   Nani, Nishanth — no pre-existing direct_message row either; used for
--     the admin/report thread, kept separate from Sush/spd0008's thread so
--     the block applied to Sush/spd0008 at the end can't affect it.
--   Sushmitha — the one live is_admin=true account (unchanged from Phase
--     1's admin-reports work); deliberately NOT a party to either thread,
--     so her read access below can only come from the admin/report branch,
--     never from being a party.
--
-- Proves:
--   1. A pending direct_message request rejects a photo, a Moment share,
--      and a Pursuit share — text only, same as Phase 1 left it.
--   2. A Moment/Pursuit the sender can't currently see can't be shared —
--      checked against a post the sender has no access to at all (someone
--      else's just_me Moment) and a Pursuit the sender isn't a participant
--      of and isn't marked shared.
--   3. A shared just_me or followers-only Moment isn't readable by a
--      recipient who couldn't see it anyway — the message row never widens
--      posts' own RLS. A Pursuit shared with `shared = true` (visible to
--      everyone already) IS readable by the recipient, the happy path.
--   4. A chat photo is readable by both parties, not by a third account,
--      not signed out.
--   5. A blocked pair loses read access to a chat photo they could read
--      before the block — even one already sitting in storage.
--   6. Only the sender can unsend (not the other party, not a bystander);
--      unsend clears body/media_path/shared_post_id/shared_pursuit_id and
--      sets deleted_at, leaves every other column (kind included) alone,
--      is idempotent on a second call, and is reflected in the thread
--      preview as "Message deleted". A raw UPDATE bypassing the function
--      touches zero rows (no UPDATE policy exists at all).
--   7. An admin can read a message photo that has an open report against
--      it, and cannot read one that has no report at all — even though
--      the admin is a party to neither thread.

begin;

do $$
declare
  v_sush uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_spd uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';
  v_nani uuid := '2410e037-9cb5-4459-a0ca-e70a59b8f2c0';
  v_nishanth uuid := 'abcd8887-caba-4fe0-a3ad-e56a0bc0fd2e';
  v_admin uuid := '87220a04-06fc-464a-860d-988713665fe0'; -- Sushmitha, is_admin=true

  v_post_private bigint;   -- Sush's own, visibility='just_me'
  v_post_followers bigint; -- Sush's own, visibility='followers'
  v_post_others_private bigint; -- Nishanth's own, visibility='just_me' — Sush can't see it

  v_pursuit_visible text := 'phase4v-visible';  -- Nani's, shared=true
  v_pursuit_hidden text := 'phase4v-hidden';    -- Nani's, shared=false, Sush not a participant

  v_thread_p bigint; -- Sush -> Nishanth: stays pending throughout
  v_thread_a bigint; -- Sush -> spd0008: accepted, then blocked at the very end
  v_thread_r bigint; -- Nani -> Nishanth: accepted, used only for the report/admin test

  v_msg_moment_private bigint;
  v_msg_moment_followers bigint;
  v_msg_pursuit_ok bigint;
  v_msg_photo1 bigint; -- unsend + preview vehicle
  v_msg_photo2 bigint; -- block-loses-access vehicle
  v_obj1 text;
  v_obj2 text;

  v_msg_reported bigint;
  v_msg_unreported bigint;
  v_obj_reported text;
  v_obj_unreported text;

  v_pending_photo_rejected boolean;
  v_pending_moment_rejected boolean;
  v_pending_pursuit_rejected boolean;

  v_moment_sender_cant_see_rejected boolean;
  v_pursuit_sender_cant_see_rejected boolean;

  v_recipient_cant_see_private_moment boolean;
  v_recipient_cant_see_followers_moment boolean;
  v_recipient_can_see_shared_pursuit boolean;

  v_third_account_cant_read_photo boolean;
  v_signed_out_cant_read_photo boolean;
  v_party_can_read_photo boolean;

  v_bystander_unsend_rejected boolean;
  v_recipient_unsend_rejected boolean;
  v_sender_unsend_succeeded boolean;
  v_unsend_cleared_content boolean;
  v_unsend_kept_kind_and_identity boolean;
  v_raw_update_touched_rows integer;
  v_preview_after_unsend text;
  v_second_unsend_is_noop boolean;

  v_before_block_both_can_read boolean;
  v_after_block_sender_cant_read boolean;
  v_after_block_recipient_cant_read boolean;

  v_admin_reads_reported boolean;
  v_admin_cant_read_unreported boolean;

  v_from_user_before uuid;
  v_created_at_before timestamptz;
  v_participation_id_before bigint;
  v_kind_after text;
  v_body_after text;
  v_media_path_after text;
  v_shared_post_after bigint;
  v_shared_pursuit_after text;
  v_deleted_at_after timestamptz;
  v_from_user_after uuid;
  v_created_at_after timestamptz;
  v_participation_id_after bigint;
begin
  perform set_config('role', 'authenticated', true);

  -- ═══════════════════════════════════════════════════════════════════
  -- Fixtures: posts, a pursuit pair, three threads.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_sush, 'pottery', 'photo', 'https://example.test/a.jpg', 'private one', 'just_me')
  returning id into v_post_private;
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_sush, 'pottery', 'photo', 'https://example.test/b.jpg', 'followers one', 'followers')
  returning id into v_post_followers;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nishanth), true);
  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility)
  values (v_nishanth, 'running', 'photo', 'https://example.test/c.jpg', 'not yours', 'just_me')
  returning id into v_post_others_private;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.pursuits (id, user_id, title, shared) values (v_pursuit_visible, v_nani, 'Visible pursuit', true);
  insert into public.pursuits (id, user_id, title, shared) values (v_pursuit_hidden, v_nani, 'Hidden pursuit', false);

  -- Thread P: Sush -> Nishanth, direct_message. Nishanth doesn't follow
  -- Sush, so this genuinely starts (and, since nothing here ever accepts
  -- it, stays) pending.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_sush, v_nishanth)
  returning id into v_thread_p;

  -- Thread A: Sush -> spd0008, direct_message, accepted by spd0008.
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_sush, v_spd)
  returning id into v_thread_a;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_a;

  -- Thread R: Nani -> Nishanth, direct_message, accepted by Nishanth —
  -- used only for the admin/report test, kept apart from thread A so
  -- blocking Sush/spd0008 at the end can't touch it.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_nani, v_nishanth)
  returning id into v_thread_r;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nishanth), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_r;

  -- ═══════════════════════════════════════════════════════════════════
  -- 1. Pending thread: photo / Moment / Pursuit all rejected (text-only).
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);

  begin
    insert into public.messages (participation_id, from_user, kind, body, media_path)
    values (v_thread_p, v_sush, 'photo', '', v_thread_p::text || '/pending.jpg');
    v_pending_photo_rejected := false;
  exception when others then
    v_pending_photo_rejected := true;
  end;

  begin
    insert into public.messages (participation_id, from_user, kind, body, shared_post_id)
    values (v_thread_p, v_sush, 'moment', '', v_post_private);
    v_pending_moment_rejected := false;
  exception when others then
    v_pending_moment_rejected := true;
  end;

  begin
    insert into public.messages (participation_id, from_user, kind, body, shared_pursuit_id)
    values (v_thread_p, v_sush, 'pursuit', '', v_pursuit_visible);
    v_pending_pursuit_rejected := false;
  exception when others then
    v_pending_pursuit_rejected := true;
  end;

  -- ═══════════════════════════════════════════════════════════════════
  -- 2. Accepted thread A: share what you can see, can't share what you
  --    can't; the recipient's own visibility still governs their read.
  -- ═══════════════════════════════════════════════════════════════════

  -- Sush shares their OWN just_me Moment — allowed (owner can always see
  -- their own post, regardless of its visibility tier).
  insert into public.messages (participation_id, from_user, kind, body, shared_post_id)
  values (v_thread_a, v_sush, 'moment', '', v_post_private)
  returning id into v_msg_moment_private;

  -- Sush shares their OWN followers-only Moment — same reasoning.
  insert into public.messages (participation_id, from_user, kind, body, shared_post_id)
  values (v_thread_a, v_sush, 'moment', '', v_post_followers)
  returning id into v_msg_moment_followers;

  -- Sush tries to share Nishanth's just_me Moment — Sush isn't the owner,
  -- doesn't follow Nishanth (irrelevant for just_me anyway), and it isn't
  -- public: Sush can't see it, so this must be rejected.
  begin
    insert into public.messages (participation_id, from_user, kind, body, shared_post_id)
    values (v_thread_a, v_sush, 'moment', '', v_post_others_private);
    v_moment_sender_cant_see_rejected := false;
  exception when others then
    v_moment_sender_cant_see_rejected := true;
  end;

  -- Sush shares Nani's `shared = true` Pursuit — visible to everyone,
  -- Sush included, so this is allowed.
  insert into public.messages (participation_id, from_user, kind, body, shared_pursuit_id)
  values (v_thread_a, v_sush, 'pursuit', '', v_pursuit_visible)
  returning id into v_msg_pursuit_ok;

  -- Sush tries to share Nani's NOT-shared Pursuit — Sush isn't the owner
  -- and isn't a pursuit_members participant, so this must be rejected.
  begin
    insert into public.messages (participation_id, from_user, kind, body, shared_pursuit_id)
    values (v_thread_a, v_sush, 'pursuit', '', v_pursuit_hidden);
    v_pursuit_sender_cant_see_rejected := false;
  exception when others then
    v_pursuit_sender_cant_see_rejected := true;
  end;

  -- spd0008 (the recipient) reads the two Moment shares and the Pursuit
  -- share under THEIR OWN permissions, not Sush's — the message row must
  -- never widen what posts/pursuits RLS already says.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select not exists(select 1 from public.posts where id = v_post_private)
    into v_recipient_cant_see_private_moment;
  select not exists(select 1 from public.posts where id = v_post_followers)
    into v_recipient_cant_see_followers_moment;
  select exists(select 1 from public.pursuits where id = v_pursuit_visible)
    into v_recipient_can_see_shared_pursuit;

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. Photo: readable by both parties, not a third account, not signed
  --    out — plus the unsend + "Message deleted" preview flow.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  v_obj1 := v_thread_a::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into public.messages (participation_id, from_user, kind, body, media_path)
  values (v_thread_a, v_sush, 'photo', '', v_obj1)
  returning id into v_msg_photo1;
  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('message-media', v_obj1, v_sush, v_sush::text);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select exists(
    select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj1
  ) into v_party_can_read_photo;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nishanth), true);
  select not exists(
    select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj1
  ) into v_third_account_cant_read_photo;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  select not exists(
    select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj1
  ) into v_signed_out_cant_read_photo;
  perform set_config('role', 'authenticated', true);

  -- Unsend: a bystander, then the other party (recipient, not sender),
  -- both rejected — only the sender can unsend their own message.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nishanth), true);
  begin
    perform public.unsend_message(v_msg_photo1);
    v_bystander_unsend_rejected := false;
  exception when others then
    v_bystander_unsend_rejected := true;
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  begin
    perform public.unsend_message(v_msg_photo1);
    v_recipient_unsend_rejected := false;
  exception when others then
    v_recipient_unsend_rejected := true;
  end;

  -- Capture the row's other columns before the sender unsends it, to
  -- prove nothing but the content columns and deleted_at ever change.
  select from_user, created_at, participation_id
    into v_from_user_before, v_created_at_before, v_participation_id_before
    from public.messages where id = v_msg_photo1;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  begin
    perform public.unsend_message(v_msg_photo1);
    v_sender_unsend_succeeded := true;
  exception when others then
    v_sender_unsend_succeeded := false;
  end;

  select kind, body, media_path, shared_post_id, shared_pursuit_id, deleted_at,
         from_user, created_at, participation_id
    into v_kind_after, v_body_after, v_media_path_after, v_shared_post_after, v_shared_pursuit_after,
         v_deleted_at_after, v_from_user_after, v_created_at_after, v_participation_id_after
    from public.messages where id = v_msg_photo1;

  v_unsend_cleared_content := (
    v_body_after = ''
    and v_media_path_after is null
    and v_shared_post_after is null
    and v_shared_pursuit_after is null
    and v_deleted_at_after is not null
  );
  v_unsend_kept_kind_and_identity := (
    v_kind_after = 'photo'
    and v_from_user_after = v_from_user_before
    and v_created_at_after = v_created_at_before
    and v_participation_id_after = v_participation_id_before
  );

  -- A raw UPDATE bypassing the function — no UPDATE policy exists at all
  -- on messages, so this must silently touch zero rows, not error.
  update public.messages set body = 'hacked, if this worked' where id = v_msg_photo1;
  get diagnostics v_raw_update_touched_rows = row_count;

  -- Calling unsend_message() again on an already-deleted message is a
  -- no-op, not an error.
  begin
    perform public.unsend_message(v_msg_photo1);
    v_second_unsend_is_noop := true;
  exception when others then
    v_second_unsend_is_noop := false;
  end;

  select last_message_body into v_preview_after_unsend
    from public.participation_message_summaries() where participation_id = v_thread_a;

  -- ═══════════════════════════════════════════════════════════════════
  -- 4. Block: a second photo, readable by both before the block, by
  --    neither after it.
  -- ═══════════════════════════════════════════════════════════════════
  v_obj2 := v_thread_a::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into public.messages (participation_id, from_user, kind, body, media_path)
  values (v_thread_a, v_sush, 'photo', '', v_obj2)
  returning id into v_msg_photo2;
  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('message-media', v_obj2, v_sush, v_sush::text);

  select exists(select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj2)
    into v_before_block_both_can_read;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select v_before_block_both_can_read and exists(
    select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj2
  ) into v_before_block_both_can_read;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.blocks (blocker_id, blocked_id) values (v_sush, v_spd);

  select not exists(select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj2)
    into v_after_block_sender_cant_read;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select not exists(select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj2)
    into v_after_block_recipient_cant_read;

  -- ═══════════════════════════════════════════════════════════════════
  -- 5. Admin can read a reported photo, not an unreported one — thread R,
  --    untouched by the block above.
  -- ═══════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  v_obj_reported := v_thread_r::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into public.messages (participation_id, from_user, kind, body, media_path)
  values (v_thread_r, v_nani, 'photo', '', v_obj_reported)
  returning id into v_msg_reported;
  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('message-media', v_obj_reported, v_nani, v_nani::text);

  v_obj_unreported := v_thread_r::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into public.messages (participation_id, from_user, kind, body, media_path)
  values (v_thread_r, v_nani, 'photo', '', v_obj_unreported)
  returning id into v_msg_unreported;
  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('message-media', v_obj_unreported, v_nani, v_nani::text);

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nishanth), true);
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, reason, status)
  values (v_nishanth, v_nani, 'message', v_msg_reported, 'inappropriate', 'open');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_admin), true);
  select exists(select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj_reported)
    into v_admin_reads_reported;
  select not exists(select 1 from storage.objects where bucket_id = 'message-media' and name = v_obj_unreported)
    into v_admin_cant_read_unreported;

  raise exception 'RESULTS: pending_photo_rejected=% pending_moment_rejected=% pending_pursuit_rejected=% moment_sender_cant_see_rejected=% pursuit_sender_cant_see_rejected=% recipient_cant_see_private_moment=% recipient_cant_see_followers_moment=% recipient_can_see_shared_pursuit=% party_can_read_photo=% third_account_cant_read_photo=% signed_out_cant_read_photo=% bystander_unsend_rejected=% recipient_unsend_rejected=% sender_unsend_succeeded=% unsend_cleared_content=% unsend_kept_kind_and_identity=% raw_update_touched_rows=% second_unsend_is_noop=% preview_after_unsend=% before_block_both_can_read=% after_block_sender_cant_read=% after_block_recipient_cant_read=% admin_reads_reported=% admin_cant_read_unreported=%',
    v_pending_photo_rejected, v_pending_moment_rejected, v_pending_pursuit_rejected,
    v_moment_sender_cant_see_rejected, v_pursuit_sender_cant_see_rejected,
    v_recipient_cant_see_private_moment, v_recipient_cant_see_followers_moment, v_recipient_can_see_shared_pursuit,
    v_party_can_read_photo, v_third_account_cant_read_photo, v_signed_out_cant_read_photo,
    v_bystander_unsend_rejected, v_recipient_unsend_rejected, v_sender_unsend_succeeded,
    v_unsend_cleared_content, v_unsend_kept_kind_and_identity, v_raw_update_touched_rows, v_second_unsend_is_noop,
    v_preview_after_unsend,
    v_before_block_both_can_read, v_after_block_sender_cant_read, v_after_block_recipient_cant_read,
    v_admin_reads_reported, v_admin_cant_read_unreported;
end $$;

rollback;
