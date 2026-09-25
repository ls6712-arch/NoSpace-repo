-- Verification for supabase/migrations/20261002000000_communication_phase3_unread.sql.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Everything below runs inside one transaction that ends in ROLLBACK, so
-- nothing here is left behind on the real tables — same impersonation
-- pattern as Phase 1/2's own verification scripts. Every setting this
-- script depends on (profile_settings.read_receipts) is explicitly forced
-- inside the transaction rather than trusted from live state.
--
-- Four real accounts already used in Phase 1/2's own verification, each
-- pair picked to have no pre-existing direct_message row between them
-- (confirmed by a plain SELECT before writing this): Sush, Nani, spd0008,
-- Sushmitha.
--
-- Proves:
--   1. Nobody can read or write another person's conversation_reads row —
--      plain RLS ownership, checked directly, not just through the RPCs.
--   2. mark_conversation_read() rejects a bystander who isn't a party.
--   3. mark_conversation_read() rejects a still-pending request — reading
--      a pending request's preview never produces Seen for its sender.
--   4. Unread counts are right before and after marking a thread read.
--   5. thread_seen_at() returns null for: a non-party, a pending thread, a
--      blocked pair (even one with real prior read history), either side
--      having read_receipts off — and a real timestamp once the other
--      party has actually read an accepted thread with receipts on both
--      sides.
--   6. supabase_realtime publishes exactly {messages, participations,
--      notifications, conversation_reads} — nothing else, nothing missing.

begin;

do $$
declare
  v_sush uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_nani uuid := '2410e037-9cb5-4459-a0ca-e70a59b8f2c0';
  v_spd uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';
  v_sushmitha uuid := '87220a04-06fc-464a-860d-988713665fe0';

  v_thread_a bigint; -- Sush -> spd0008, accepted: unread + Seen happy path
  v_thread_c bigint; -- Sush -> Sushmitha, left pending: Seen must stay null
  v_thread_d bigint; -- Nani -> spd0008, accepted then blocked: Seen must go null

  v_unread_before bigint;
  v_unread_after bigint;

  v_seen_before_read timestamptz;
  v_seen_after_read timestamptz;
  v_seen_other_receipts_off timestamptz;
  v_seen_my_receipts_off timestamptz;

  v_cannot_select_others_row boolean;
  v_cannot_insert_others_row boolean;
  v_cannot_update_others_row boolean;

  v_bystander_mark_rejected boolean;
  v_pending_mark_rejected boolean;

  v_seen_pending timestamptz;

  v_seen_blocked_despite_prior_read timestamptz;

  v_pub_tables text[];
begin
  -- Set once, for the whole transaction: every thread_seen_at() /
  -- mark_conversation_read() call below genuinely runs as role
  -- `authenticated`, not as this session's owner/postgres role — the only
  -- way this script would have caught private.other_party_seen_at missing
  -- its own execute grant (a SECURITY INVOKER caller runs as the caller,
  -- not the function's owner).
  perform set_config('role', 'authenticated', true);

  -- Force the settings this script depends on, inside the transaction —
  -- never trust live state for these.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.profile_settings (user_id, read_receipts) values (v_sush, true)
    on conflict (user_id) do update set read_receipts = true;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.profile_settings (user_id, read_receipts) values (v_spd, true)
    on conflict (user_id) do update set read_receipts = true;

  -- ── Thread A: Sush -> spd0008, accepted — unread + Seen happy path ────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_sush, v_spd)
  returning id into v_thread_a;
  insert into public.messages (participation_id, from_user, body) values (v_thread_a, v_sush, 'Hey!');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_a;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread_a, v_sush, 'You around?');

  -- spd0008 hasn't opened the thread yet — 2 unread from Sush.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select unread_count into v_unread_before
    from public.participation_message_summaries() where participation_id = v_thread_a;

  -- Sush checks Seen before spd0008 has read anything — must be null.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select public.thread_seen_at(v_thread_a) into v_seen_before_read;

  -- spd0008 opens the thread and marks it read.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  perform public.mark_conversation_read(v_thread_a);

  select unread_count into v_unread_after
    from public.participation_message_summaries() where participation_id = v_thread_a;

  -- Sush checks Seen again — spd0008 really did read it, receipts on both
  -- sides, accepted thread, not blocked: a real timestamp now.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select public.thread_seen_at(v_thread_a) into v_seen_after_read;

  -- spd0008 turns their own receipts off — Sush must stop seeing it.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings set read_receipts = false where user_id = v_spd;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select public.thread_seen_at(v_thread_a) into v_seen_other_receipts_off;
  -- Put it back on before the next check (isolate the two conditions).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.profile_settings set read_receipts = true where user_id = v_spd;

  -- Now Sush (the caller/asker) turns their OWN receipts off — same result.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  update public.profile_settings set read_receipts = false where user_id = v_sush;
  select public.thread_seen_at(v_thread_a) into v_seen_my_receipts_off;
  update public.profile_settings set read_receipts = true where user_id = v_sush;

  -- ── conversation_reads is owner-only, checked directly ────────────────
  -- Nani (a real bystander, no thread with spd0008 at all) tries to read,
  -- insert, and update spd0008's own conversation_reads row for thread A.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  select not exists(
    select 1 from public.conversation_reads where user_id = v_spd and participation_id = v_thread_a
  ) into v_cannot_select_others_row;

  begin
    insert into public.conversation_reads (user_id, participation_id, last_read_at)
    values (v_spd, v_thread_a, now());
    v_cannot_insert_others_row := false;
  exception when others then
    v_cannot_insert_others_row := true;
  end;

  begin
    update public.conversation_reads set last_read_at = now()
      where user_id = v_spd and participation_id = v_thread_a;
    -- RLS silently filters rows rather than erroring on UPDATE — a "success"
    -- with zero rows touched is the actual failure mode to check for.
    if found then
      v_cannot_update_others_row := false;
    else
      v_cannot_update_others_row := true;
    end if;
  exception when others then
    v_cannot_update_others_row := true;
  end;

  -- Nani also isn't a party to thread A at all — mark_conversation_read
  -- must reject her outright.
  begin
    perform public.mark_conversation_read(v_thread_a);
    v_bystander_mark_rejected := false;
  exception when others then
    v_bystander_mark_rejected := true;
  end;

  -- ── Thread C: Sush -> Sushmitha, left pending — Seen must stay null ───
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_sush, v_sushmitha)
  returning id into v_thread_c;
  insert into public.messages (participation_id, from_user, body) values (v_thread_c, v_sush, 'Loved your macrame piece!');

  -- Sushmitha (the actual recipient) tries to mark the still-pending
  -- request read — must be rejected; reading a preview isn't accepting.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sushmitha), true);
  begin
    perform public.mark_conversation_read(v_thread_c);
    v_pending_mark_rejected := false;
  exception when others then
    v_pending_mark_rejected := true;
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select public.thread_seen_at(v_thread_c) into v_seen_pending;

  -- ── Thread D: Nani -> spd0008, accepted then blocked — Seen goes null ─
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_nani, v_spd)
  returning id into v_thread_d;
  insert into public.messages (participation_id, from_user, body) values (v_thread_d, v_nani, 'Working Saturday?');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_d;
  -- spd0008 genuinely reads it before any block exists.
  perform public.mark_conversation_read(v_thread_d);

  -- Now Nani blocks spd0008 — real prior read history or not, Seen must
  -- go null for a blocked pair.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.blocks (blocker_id, blocked_id) values (v_nani, v_spd);
  select public.thread_seen_at(v_thread_d) into v_seen_blocked_despite_prior_read;

  -- ── Publication contains exactly the four tables ──────────────────────
  select coalesce(array_agg(tablename order by tablename), array[]::text[])
    into v_pub_tables
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public';

  raise exception 'RESULTS: unread_before=% unread_after=% seen_before_read_is_null=% seen_after_read_is_not_null=% seen_other_receipts_off_is_null=% seen_my_receipts_off_is_null=% cannot_select_others_row=% cannot_insert_others_row=% cannot_update_others_row=% bystander_mark_rejected=% pending_mark_rejected=% seen_pending_is_null=% seen_blocked_despite_prior_read_is_null=% publication_tables=%',
    v_unread_before, v_unread_after,
    (v_seen_before_read is null), (v_seen_after_read is not null),
    (v_seen_other_receipts_off is null), (v_seen_my_receipts_off is null),
    v_cannot_select_others_row, v_cannot_insert_others_row, v_cannot_update_others_row,
    v_bystander_mark_rejected, v_pending_mark_rejected,
    (v_seen_pending is null), (v_seen_blocked_despite_prior_read is null),
    v_pub_tables;
end $$;

rollback;
