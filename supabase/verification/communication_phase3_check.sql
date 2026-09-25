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
-- Three real accounts already used in Phase 1/2's own verification, picked
-- for a specific reason each: Sush and spd0008 have no pre-existing
-- direct_message row AND don't already mutually follow each other (so a
-- fresh direct_message between them genuinely starts 'pending' — verified
-- live before writing this; Sush and Sushmitha, by contrast, already
-- mutually follow, which would auto-accept a new thread on insert and
-- silently skip the "still pending" checks below). Nani and spd0008 have
-- no pre-existing row either.
--
-- Run once already (2026-09-25) with a bug in this script, not the
-- migration: it used Sush/Sushmitha for the "still pending" checks,
-- assuming that pair would stay pending like Sush/spd0008 did in Phase 2's
-- own script. It didn't — Sush and Sushmitha mutually follow each other
-- (unrelated later activity), which auto-accepts a new direct_message on
-- insert, so mark_conversation_read() correctly succeeded on an already-
-- accepted thread instead of being rejected, and thread_seen_at() correctly
-- returned a real timestamp instead of null. Both were the RIGHT answer for
-- an accepted thread — the script was asserting the wrong thing. Fixed by
-- testing the "still pending" behavior on Sush/spd0008's own thread during
-- the real window before it's accepted, then continuing the SAME thread's
-- lifecycle into the accepted/unread/Seen checks — one real thread's actual
-- history, not a second fixture assumed (wrongly) to hold.
--
-- Proves:
--   1. mark_conversation_read() rejects a still-pending thread, even for
--      its actual recipient — reading a pending request's preview never
--      produces Seen for its sender.
--   2. thread_seen_at() returns null for a still-pending thread.
--   3. Unread counts are right before and after marking a thread read.
--   4. Nobody can read or write another person's conversation_reads row —
--      plain RLS ownership, checked directly, not just through the RPCs.
--   5. mark_conversation_read() rejects a bystander who isn't a party.
--   6. thread_seen_at() returns null for: a non-party, a blocked pair (even
--      one with real prior read history), either side having read_receipts
--      off — and a real timestamp once the other party has actually read
--      an accepted thread with receipts on both sides.
--   7. supabase_realtime publishes exactly {messages, participations,
--      notifications, conversation_reads} — nothing else, nothing missing.

begin;

do $$
declare
  v_sush uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_nani uuid := '2410e037-9cb5-4459-a0ca-e70a59b8f2c0';
  v_spd uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';

  v_thread_a bigint; -- Sush -> spd0008: pending, then accepted — one real lifecycle
  v_thread_blocked bigint; -- Nani -> spd0008, accepted then blocked

  v_pending_mark_rejected boolean;
  v_seen_pending timestamptz;

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

  v_seen_blocked_despite_prior_read timestamptz;

  v_pub_tables text[];
begin
  -- Set once, for the whole transaction: every thread_seen_at() /
  -- mark_conversation_read() call below genuinely runs as role
  -- `authenticated`, not as this session's owner/postgres role — the only
  -- way this script would catch private.other_party_seen_at missing its
  -- own execute grant (a SECURITY INVOKER caller runs as the caller, not
  -- the function's owner) — exactly the bug the first review round found.
  perform set_config('role', 'authenticated', true);

  -- Force the settings this script depends on, inside the transaction —
  -- never trust live state for these.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.profile_settings (user_id, read_receipts) values (v_sush, true)
    on conflict (user_id) do update set read_receipts = true;
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.profile_settings (user_id, read_receipts) values (v_spd, true)
    on conflict (user_id) do update set read_receipts = true;

  -- ── Thread A: Sush -> spd0008 — still pending ─────────────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_sush, v_spd)
  returning id into v_thread_a;
  insert into public.messages (participation_id, from_user, body) values (v_thread_a, v_sush, 'Hey!');

  -- spd0008 (the actual recipient) tries to mark this still-pending request
  -- read — must be rejected; reading a preview isn't accepting.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  begin
    perform public.mark_conversation_read(v_thread_a);
    v_pending_mark_rejected := false;
  exception when others then
    v_pending_mark_rejected := true;
  end;

  -- Sush checks Seen while it's still pending — must be null.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select public.thread_seen_at(v_thread_a) into v_seen_pending;

  -- ── Same thread, now accepted — unread + Seen happy path ──────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_a;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread_a, v_sush, 'You around?');

  -- spd0008 still hasn't opened the thread — 2 unread from Sush (the
  -- pending-phase message counts too; it was never read either).
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  select unread_count into v_unread_before
    from public.participation_message_summaries() where participation_id = v_thread_a;

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

  -- ── Thread blocked: Nani -> spd0008, accepted then blocked ────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_nani, v_spd)
  returning id into v_thread_blocked;
  insert into public.messages (participation_id, from_user, body) values (v_thread_blocked, v_nani, 'Working Saturday?');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'accepted', responded_at = now() where id = v_thread_blocked;
  -- spd0008 genuinely reads it before any block exists.
  perform public.mark_conversation_read(v_thread_blocked);

  -- Now Nani blocks spd0008 — real prior read history or not, Seen must
  -- go null for a blocked pair.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.blocks (blocker_id, blocked_id) values (v_nani, v_spd);
  select public.thread_seen_at(v_thread_blocked) into v_seen_blocked_despite_prior_read;

  -- ── Publication contains exactly the four tables ──────────────────────
  select coalesce(array_agg(tablename order by tablename), array[]::text[])
    into v_pub_tables
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public';

  raise exception 'RESULTS: pending_mark_rejected=% seen_pending_is_null=% unread_before=% unread_after=% seen_before_read_is_null=% seen_after_read_is_not_null=% seen_other_receipts_off_is_null=% seen_my_receipts_off_is_null=% cannot_select_others_row=% cannot_insert_others_row=% cannot_update_others_row=% bystander_mark_rejected=% seen_blocked_despite_prior_read_is_null=% publication_tables=%',
    v_pending_mark_rejected, (v_seen_pending is null),
    v_unread_before, v_unread_after,
    (v_seen_before_read is null), (v_seen_after_read is not null),
    (v_seen_other_receipts_off is null), (v_seen_my_receipts_off is null),
    v_cannot_select_others_row, v_cannot_insert_others_row, v_cannot_update_others_row,
    v_bystander_mark_rejected,
    (v_seen_blocked_despite_prior_read is null),
    v_pub_tables;
end $$;

rollback;
