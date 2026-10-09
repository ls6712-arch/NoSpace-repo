-- Save notification — verification.
--
-- Not a migration. Run AFTER 20261022000000_save_notification.sql.
-- One transaction, one do $$ ... $$ block, ends unconditionally in
-- RAISE EXCEPTION 'RESULTS: ...' and rolls back whatever happened. No
-- SELECT/RETURNING INTO and no DELETE (see CLAUDE.md); every value is
-- assigned with :=. Every count is scoped to this script's own fixture ids.
--
-- Fixed ids (…5a01 to …5a06):
--   OWNER writes the Moments. SAVER1, SAVER2, SAVER3 save them. BLOCKED is
--   blocked by OWNER. MUTED_OWNER has the 'saves' category muted.
--
-- Read the single error message: a line per check, "PASS name" or "FAIL name".
-- Any FAIL, ERROR or SETUP FAIL means do not ship.

begin;

do $$
declare
  v_n int;
  v_text text;
  v_flag boolean;
  results text[] := '{}';
  v_owner uuid := '00000000-0000-4000-8000-000000005a01';
  v_saver1 uuid := '00000000-0000-4000-8000-000000005a02';
  v_saver2 uuid := '00000000-0000-4000-8000-000000005a03';
  v_blocked uuid := '00000000-0000-4000-8000-000000005a04';
  v_muted_owner uuid := '00000000-0000-4000-8000-000000005a05';
  v_saver3 uuid := '00000000-0000-4000-8000-000000005a06';
  v_post bigint;
  v_own_post bigint;
  v_muted_post bigint;
  v_blocked_post bigint;
  v_long_post bigint;
  v_blank_post bigint;
  v_sync_post bigint;
  v_mix_post bigint;
  v_notice_id bigint;
  v_before int;
begin
  -- Fixture ─────────────────────────────────────────────────────────────
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-owner@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_saver1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-saver1@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_saver2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-saver2@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_blocked, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-blocked@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_muted_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-muted@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false),
    (v_saver3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sv-saver3@sv-test.invalid', '', now(), now(), now(), '{}', '{}', false);

  insert into public.posts (user_id, hobby_slug, type, media_url, caption, visibility) values
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv Sourdough with rye starter', 'public'),
    (v_saver1, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv saver1 own post', 'public'),
    (v_muted_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv muted owner post', 'public'),
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv blocked saver post', 'public'),
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', E'sv first line that is much longer than forty characters in total\nsecond line stays out', 'public'),
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', '', 'public'),
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv synced only post', 'public'),
    (v_owner, 'pottery', 'photo', 'https://example.test/sv.jpg', 'sv mixed post', 'public');

  v_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption = 'sv Sourdough with rye starter');
  v_own_post := (select public.posts.id from public.posts where public.posts.user_id = v_saver1 and public.posts.caption = 'sv saver1 own post');
  v_muted_post := (select public.posts.id from public.posts where public.posts.user_id = v_muted_owner and public.posts.caption = 'sv muted owner post');
  v_blocked_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption = 'sv blocked saver post');
  v_long_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption like 'sv first line that is much longer%');
  v_blank_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption = '');
  v_sync_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption = 'sv synced only post');
  v_mix_post := (select public.posts.id from public.posts where public.posts.user_id = v_owner and public.posts.caption = 'sv mixed post');

  insert into public.profile_settings (user_id, notification_preferences)
  values (v_muted_owner, '{"muted": ["saves"]}'::jsonb)
  on conflict (user_id) do update set notification_preferences = '{"muted": ["saves"]}'::jsonb;

  insert into public.blocks (blocker_id, blocked_id) values (v_owner, v_blocked);

  -- 1. Wording ──────────────────────────────────────────────────────────
  v_text := public.save_notification_body(1, 'Sourdough');
  results := array_append(results, case when v_text = 'Someone wants to try “Sourdough”.' then 'PASS wording one save' else 'FAIL wording one save: ' || v_text end);

  v_text := public.save_notification_body(2, 'Sourdough');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS wording two saves' else 'FAIL wording two saves: ' || v_text end);

  v_text := public.save_notification_body(14, 'Sourdough');
  results := array_append(results, case when v_text = '14 people want to try “Sourdough”.' then 'PASS wording many saves' else 'FAIL wording many saves: ' || v_text end);

  v_text := public.save_notification_body(1234, 'Sourdough');
  results := array_append(results, case when v_text = '1,234 people want to try “Sourdough”.' then 'PASS wording thousands separator' else 'FAIL wording thousands separator: ' || v_text end);

  v_text := public.save_notification_body(3, '');
  results := array_append(results, case when v_text = '3 people want to try your Moment.' then 'PASS empty caption fallback (grouped)' else 'FAIL empty caption fallback (grouped): ' || v_text end);

  v_text := public.save_notification_body(1, '');
  results := array_append(results, case when v_text = 'Someone wants to try your Moment.' then 'PASS empty caption fallback (single)' else 'FAIL empty caption fallback (single): ' || v_text end);

  v_text := public.save_notification_body(1, '   ');
  results := array_append(results, case when v_text = 'Someone wants to try your Moment.' then 'PASS blank caption fallback' else 'FAIL blank caption fallback: ' || v_text end);

  v_text := public.save_notification_body(2, null);
  results := array_append(results, case when v_text = '2 people want to try your Moment.' then 'PASS null caption fallback' else 'FAIL null caption fallback: ' || v_text end);

  v_text := public.save_notification_body(2, E'Sourdough\nwith rye');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS first line only' else 'FAIL first line only: ' || v_text end);

  v_text := public.save_notification_body(2, E'Sourdough\r\nwith rye');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS first line only (windows line ends)' else 'FAIL first line only (windows line ends): ' || v_text end);

  v_text := public.save_notification_body(2, E'\n\nSourdough');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS first non-blank line (blank lines first)' else 'FAIL first non-blank line (blank lines first): ' || v_text end);

  v_text := public.save_notification_body(2, E'  \n \t \n  Sourdough  \nwith rye');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS first non-blank line (spaces-only lines first, trimmed)' else 'FAIL first non-blank line (spaces-only lines first): ' || v_text end);

  v_text := public.save_notification_body(2, E'\r\n\r\nSourdough\r\nwith rye');
  results := array_append(results, case when v_text = '2 people want to try “Sourdough”.' then 'PASS first non-blank line (windows line ends)' else 'FAIL first non-blank line (windows line ends): ' || v_text end);

  v_text := public.save_notification_body(3, E' \n \t \n ');
  results := array_append(results, case when v_text = '3 people want to try your Moment.' then 'PASS whitespace-only multi-line caption falls back' else 'FAIL whitespace-only multi-line caption: ' || v_text end);

  v_text := public.save_notification_body(1, E'\n' || repeat('a', 41));
  results := array_append(results, case when v_text = 'Someone wants to try “' || repeat('a', 40) || '…”.' then 'PASS long first non-blank line is cut at 40' else 'FAIL long first non-blank line: ' || v_text end);

  v_text := public.save_notification_body(1, repeat('a', 40));
  results := array_append(results, case when v_text = 'Someone wants to try “' || repeat('a', 40) || '”.' then 'PASS exactly 40 characters is not cut' else 'FAIL exactly 40 characters: ' || v_text end);

  v_text := public.save_notification_body(1, repeat('a', 41));
  results := array_append(results, case when v_text = 'Someone wants to try “' || repeat('a', 40) || '…”.' then 'PASS 41 characters is cut at 40 with an ellipsis' else 'FAIL 41 characters: ' || v_text end);

  v_text := public.save_notification_body(1, repeat('a', 39) || ' ' || repeat('b', 20));
  results := array_append(results, case when v_text = 'Someone wants to try “' || repeat('a', 39) || '…”.' then 'PASS trailing space before the cut is dropped' else 'FAIL trailing space: ' || v_text end);

  -- 2. First save: one row, no name, opens the Moment ─────────────────────
  insert into public.bookmarks (user_id, post_id) values (v_saver1, v_post);

  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post);
  results := array_append(results, case when v_n = 1 then 'PASS first save makes one notification' else 'FAIL first save makes one notification: ' || v_n end);

  v_text := (select public.notifications.body from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post);
  results := array_append(results, case when v_text = 'Someone wants to try “sv Sourdough with rye starter”.' then 'PASS first save wording' else 'FAIL first save wording: ' || v_text end);

  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post and public.notifications.actor_id is null and public.notifications.actor_name is null);
  results := array_append(results, case when v_n = 1 then 'PASS no actor_id and no actor_name stored' else 'FAIL actor stored: ' || v_n end);

  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.target_post_id = v_post and public.notifications.read = false);
  results := array_append(results, case when v_n = 1 then 'PASS opens the post and starts unread' else 'FAIL target or unread: ' || v_n end);

  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.body like '%' || v_saver1::text || '%');
  results := array_append(results, case when v_n = 0 then 'PASS saver id is not in any body' else 'FAIL saver id in a body' end);

  -- 3. More saves in the window update the same row and mark it unread ───
  v_notice_id := (select public.notifications.id from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post);
  update public.notifications set read = true where public.notifications.id = v_notice_id;

  insert into public.bookmarks (user_id, post_id) values (v_saver2, v_post);

  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post);
  results := array_append(results, case when v_n = 1 then 'PASS second save does not add a row' else 'FAIL second save added a row: ' || v_n end);

  v_text := (select public.notifications.body from public.notifications where public.notifications.id = v_notice_id);
  results := array_append(results, case when v_text = '2 people want to try “sv Sourdough with rye starter”.' then 'PASS second save updates the count' else 'FAIL second save wording: ' || v_text end);

  v_flag := (select public.notifications.read from public.notifications where public.notifications.id = v_notice_id);
  results := array_append(results, case when v_flag = false then 'PASS second save marks it unread again' else 'FAIL still read' end);

  -- 4. Blocked saver is not counted ─────────────────────────────────────
  insert into public.bookmarks (user_id, post_id) values (v_blocked, v_post);
  v_text := (select public.notifications.body from public.notifications where public.notifications.id = v_notice_id);
  results := array_append(results, case when v_text = '2 people want to try “sv Sourdough with rye starter”.' then 'PASS blocked saver is not counted' else 'FAIL blocked saver counted: ' || v_text end);

  insert into public.bookmarks (user_id, post_id) values (v_blocked, v_blocked_post);
  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_blocked_post);
  results := array_append(results, case when v_n = 0 then 'PASS blocked saver makes no notification' else 'FAIL blocked saver notified: ' || v_n end);

  -- 5. Saving your own Moment notifies nobody ───────────────────────────
  insert into public.bookmarks (user_id, post_id) values (v_saver1, v_own_post);
  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_own_post);
  results := array_append(results, case when v_n = 0 then 'PASS saving your own Moment notifies nobody' else 'FAIL own save notified: ' || v_n end);

  -- 6. Muted category: no row ───────────────────────────────────────────
  insert into public.bookmarks (user_id, post_id) values (v_saver1, v_muted_post);
  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_muted_owner and public.notifications.kind = 'save');
  results := array_append(results, case when v_n = 0 then 'PASS muted saves category makes no notification' else 'FAIL muted category notified: ' || v_n end);

  v_flag := private.notification_kind_muted(v_muted_owner, 'save');
  results := array_append(results, case when v_flag = true then 'PASS mute list maps save to saves' else 'FAIL mute list' end);

  v_flag := private.notification_kind_muted(v_owner, 'save');
  results := array_append(results, case when v_flag = false then 'PASS not muted by default' else 'FAIL muted by default' end);

  -- 7. Long and empty captions end to end ───────────────────────────────
  insert into public.bookmarks (user_id, post_id) values (v_saver1, v_long_post);
  v_text := (select public.notifications.body from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_long_post);
  results := array_append(results, case when v_text = 'Someone wants to try “sv first line that is much longer than f…”.' then 'PASS long caption cut at 40 with an ellipsis' else 'FAIL long caption: ' || v_text end);

  insert into public.bookmarks (user_id, post_id) values (v_saver1, v_blank_post);
  insert into public.bookmarks (user_id, post_id) values (v_saver2, v_blank_post);
  v_text := (select public.notifications.body from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_blank_post);
  results := array_append(results, case when v_text = '2 people want to try your Moment.' then 'PASS empty caption end to end' else 'FAIL empty caption end to end: ' || v_text end);

  -- 8. A save after 24 hours starts a new row ───────────────────────────
  update public.notifications set created_at = now() - interval '25 hours' where public.notifications.id = v_notice_id;
  update public.bookmarks set created_at = now() - interval '25 hours' where public.bookmarks.post_id = v_post;
  insert into public.bookmarks (user_id, post_id) values (v_saver3, v_post);

  v_n := (select count(*) from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post);
  results := array_append(results, case when v_n = 2 then 'PASS a save after 24 hours starts a new row' else 'FAIL new window rows: ' || v_n end);

  v_text := (select public.notifications.body from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_post order by public.notifications.created_at desc limit 1);
  results := array_append(results, case when v_text = 'Someone wants to try “sv Sourdough with rye starter”.' then 'PASS new window counts only new saves' else 'FAIL new window wording: ' || v_text end);

  -- 9. Only new saves notify: changing an old row does not ──────────────
  v_before := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.user_id = v_owner);
  update public.bookmarks set created_at = now() where public.bookmarks.user_id = v_saver1 and public.bookmarks.post_id = v_blank_post;
  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.user_id = v_owner);
  results := array_append(results, case when v_n = v_before then 'PASS an update to an old save does not notify' else 'FAIL update notified' end);

  -- 10. Nobody can write a save notification by hand ────────────────────
  begin
    insert into public.notifications (user_id, kind, body, href)
    values (v_owner, 'save', 'Someone wants to try your Moment.', '/moment/' || v_post);
    results := array_append(results, 'FAIL a hand-written save notification was accepted');
  exception
    when raise_exception then
      if sqlerrm like 'Not a recognized notification kind%' then
        results := array_append(results, 'PASS a hand-written save notification is refused');
      else
        results := array_append(results, 'ERROR hand-written save refused for another reason: ' || sqlerrm);
      end if;
    when others then
      results := array_append(results, 'ERROR hand-written save: ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 11. The flag does not leak out of the trigger ───────────────────────
  v_flag := coalesce(current_setting('soosh.save_notice', true), '') <> 'on';
  results := array_append(results, case when v_flag then 'PASS the save flag is cleared after the trigger' else 'FAIL the save flag is still on' end);

  -- 12. Saves stay private: bookmarks is still owner-only ───────────────
  -- Only permissive policies can open access up. Restrictive ones (the live
  -- table has an "active accounts only" insert policy) can only narrow it.
  v_n := (select count(*) from pg_policies where pg_policies.schemaname = 'public' and pg_policies.tablename = 'bookmarks' and pg_policies.permissive = 'PERMISSIVE');
  results := array_append(results, case when v_n = 1 then 'PASS bookmarks has exactly one permissive policy' else 'FAIL bookmarks permissive policies: ' || v_n end);

  v_n := (select count(*) from pg_policies where pg_policies.schemaname = 'public' and pg_policies.tablename = 'bookmarks' and pg_policies.permissive = 'PERMISSIVE' and pg_policies.qual like '%auth.uid()%' and pg_policies.qual like '%user_id%');
  results := array_append(results, case when v_n = 1 then 'PASS the permissive bookmarks policy is owner-only' else 'FAIL the permissive bookmarks policy is not owner-only' end);

  -- Any other policy must be restrictive, so it can only take access away.
  v_n := (select count(*) from pg_policies where pg_policies.schemaname = 'public' and pg_policies.tablename = 'bookmarks' and pg_policies.permissive <> 'PERMISSIVE' and pg_policies.permissive <> 'RESTRICTIVE');
  results := array_append(results, case when v_n = 0 then 'PASS every other bookmarks policy is restrictive' else 'FAIL a bookmarks policy is neither permissive nor restrictive: ' || v_n end);

  -- A restrictive policy never grants anything, but it must not be the only
  -- thing guarding reads: the owner policy has to cover SELECT as well.
  v_n := (select count(*) from pg_policies where pg_policies.schemaname = 'public' and pg_policies.tablename = 'bookmarks' and pg_policies.permissive = 'PERMISSIVE' and pg_policies.cmd in ('ALL', 'SELECT'));
  results := array_append(results, case when v_n = 1 then 'PASS the owner policy covers reads' else 'FAIL no owner policy covers reads: ' || v_n end);

  -- 13. Saves copied up from a phone never notify ──────────────────────
  insert into public.bookmarks (user_id, post_id, source) values (v_saver1, v_sync_post, 'local_sync');
  insert into public.bookmarks (user_id, post_id, source) values (v_saver2, v_sync_post, 'local_sync');
  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_sync_post);
  results := array_append(results, case when v_n = 0 then 'PASS synced saves make no notification' else 'FAIL synced saves notified: ' || v_n end);

  -- A synced save before a live one is not counted, and does not announce.
  insert into public.bookmarks (user_id, post_id, source) values (v_saver1, v_mix_post, 'local_sync');
  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_mix_post);
  results := array_append(results, case when v_n = 0 then 'PASS a synced save before a live one makes no notification' else 'FAIL synced save announced: ' || v_n end);

  insert into public.bookmarks (user_id, post_id) values (v_saver2, v_mix_post);
  v_text := (select public.notifications.body from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_mix_post);
  results := array_append(results, case when v_text = 'Someone wants to try “sv mixed post”.' then 'PASS the first live save still notifies, counted as one' else 'FAIL live save after sync: ' || coalesce(v_text, 'no row') end);

  -- A synced save after a live one does not change the count or wake the row.
  v_notice_id := (select public.notifications.id from public.notifications where public.notifications.user_id = v_owner and public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_mix_post);
  update public.notifications set read = true where public.notifications.id = v_notice_id;
  insert into public.bookmarks (user_id, post_id, source) values (v_saver3, v_mix_post, 'local_sync');
  v_text := (select public.notifications.body from public.notifications where public.notifications.id = v_notice_id);
  v_flag := (select public.notifications.read from public.notifications where public.notifications.id = v_notice_id);
  results := array_append(results, case when v_text = 'Someone wants to try “sv mixed post”.' and v_flag = true then 'PASS a synced save leaves the count and the read state alone' else 'FAIL synced save changed the row: ' || v_text end);

  v_n := (select count(*) from public.notifications where public.notifications.kind = 'save' and public.notifications.href = '/moment/' || v_mix_post);
  results := array_append(results, case when v_n = 1 then 'PASS still one row for the Moment' else 'FAIL rows for the Moment: ' || v_n end);

  -- Where a row came from is recorded, and a plain save is live.
  v_text := (select public.bookmarks.source from public.bookmarks where public.bookmarks.user_id = v_saver2 and public.bookmarks.post_id = v_mix_post);
  results := array_append(results, case when v_text = 'live' then 'PASS a plain save is live by default' else 'FAIL default source: ' || coalesce(v_text, 'no row') end);

  v_text := (select public.bookmarks.source from public.bookmarks where public.bookmarks.user_id = v_saver1 and public.bookmarks.post_id = v_mix_post);
  results := array_append(results, case when v_text = 'local_sync' then 'PASS a synced save is recorded as local_sync' else 'FAIL synced source: ' || coalesce(v_text, 'no row') end);

  begin
    insert into public.bookmarks (user_id, post_id, source) values (v_blocked, v_mix_post, 'something_else');
    results := array_append(results, 'FAIL an unknown source was accepted');
  exception
    when check_violation then
      results := array_append(results, 'PASS an unknown source is refused');
    when others then
      results := array_append(results, 'ERROR unknown source: ' || sqlstate || ' ' || sqlerrm);
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;

rollback;
