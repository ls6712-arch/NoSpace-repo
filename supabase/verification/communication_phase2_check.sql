-- Verification for supabase/migrations/20261001010000_communication_phase2_live.sql.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Everything below runs inside one transaction that ends in ROLLBACK, so
-- nothing here is left behind on the real tables — same pattern as Phase
-- 1's communication_phase1_check.sql: impersonate a role via
-- set_config('request.jwt.claims', ...), do things as that person, and
-- collect the results into one final RAISE EXCEPTION so they're visible
-- even though the transaction never commits.
--
-- Uses four real accounts already used in Phase 1's own verification, each
-- picked so the pair being tested had no pre-existing direct_message row
-- (confirmed by a plain SELECT before writing this): Sush, Nani, spd0008,
-- Sushmitha.
--
-- Proves:
--   1. participation_message_summaries() returns a correct count/last
--      message for an accepted thread, and ONLY threads the caller is a
--      party to — a real bystander account sees nothing for it.
--   2. A blocked pair's thread is entirely absent from the summary for
--      BOTH sides, not just zeroed out.
--   3. A declined direct_message's recipient gets no preview (zero count,
--      null last-message fields) — the sender still sees their own
--      message in the same thread.
--   4. supabase_realtime publishes exactly {messages, participations},
--      nothing else and nothing missing.

begin;

do $$
declare
  v_sush uuid := '0a653a11-cb43-40f5-be8e-b21efc57891f';
  v_nani uuid := '2410e037-9cb5-4459-a0ca-e70a59b8f2c0';
  v_spd uuid := '38b4d8b3-9502-49d8-9b2f-79d387872127';
  v_sushmitha uuid := '87220a04-06fc-464a-860d-988713665fe0';

  v_thread1 bigint; -- Sush <-> spd0008, accepted, 2 messages
  v_thread2 bigint; -- Sush <-> Sushmitha, accepted, then blocked
  v_thread3 bigint; -- Nani -> spd0008, pending then declined by spd0008

  v_t1_count bigint;
  v_t1_last_body text;
  v_t1_seen_by_nani boolean;

  v_t2_visible_to_sush_before boolean;
  v_t2_visible_to_sush_after boolean;
  v_t2_visible_to_sushmitha_after boolean;

  v_t3_recipient_count bigint;
  v_t3_recipient_last_id bigint;
  v_t3_sender_count bigint;
  v_t3_sender_last_body text;

  v_pub_tables text[];
begin
  -- ── Thread 1: basic correctness + "only my threads" ──────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user, status)
  values ('direct_message', v_sush, v_spd, 'accepted')
  returning id into v_thread1;
  insert into public.messages (participation_id, from_user, body) values (v_thread1, v_sush, 'Hey!');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  insert into public.messages (participation_id, from_user, body) values (v_thread1, v_spd, 'Hi there!');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  select message_count, last_message_body
    into v_t1_count, v_t1_last_body
    from public.participation_message_summaries()
    where participation_id = v_thread1;

  -- A real bystander, not a party to thread 1, must see nothing for it.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  select exists(
    select 1 from public.participation_message_summaries() where participation_id = v_thread1
  ) into v_t1_seen_by_nani;

  -- ── Thread 2: a blocked pair's thread returns nothing ─────────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sush), true);
  insert into public.participations (kind, from_user, to_user, status)
  values ('direct_message', v_sush, v_sushmitha, 'accepted')
  returning id into v_thread2;
  insert into public.messages (participation_id, from_user, body) values (v_thread2, v_sush, 'Working Saturday?');

  select exists(
    select 1 from public.participation_message_summaries() where participation_id = v_thread2
  ) into v_t2_visible_to_sush_before;

  insert into public.blocks (blocker_id, blocked_id) values (v_sush, v_sushmitha);

  select exists(
    select 1 from public.participation_message_summaries() where participation_id = v_thread2
  ) into v_t2_visible_to_sush_after;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_sushmitha), true);
  select exists(
    select 1 from public.participation_message_summaries() where participation_id = v_thread2
  ) into v_t2_visible_to_sushmitha_after;

  -- ── Thread 3: a declined request's recipient gets no preview ─────────
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  insert into public.participations (kind, from_user, to_user)
  values ('direct_message', v_nani, v_spd)
  returning id into v_thread3;
  insert into public.messages (participation_id, from_user, body) values (v_thread3, v_nani, 'Loved your macrame piece!');

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_spd), true);
  update public.participations set status = 'declined', responded_at = now() where id = v_thread3;

  select message_count, last_message_id
    into v_t3_recipient_count, v_t3_recipient_last_id
    from public.participation_message_summaries()
    where participation_id = v_thread3;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_nani), true);
  select message_count, last_message_body
    into v_t3_sender_count, v_t3_sender_last_body
    from public.participation_message_summaries()
    where participation_id = v_thread3;

  -- ── Publication contains exactly the two tables ──────────────────────
  select coalesce(array_agg(tablename order by tablename), array[]::text[])
    into v_pub_tables
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public';

  raise exception 'RESULTS: t1_count=% t1_last_body=% t1_hidden_from_bystander=% t2_visible_before_block=% t2_hidden_from_sush_after_block=% t2_hidden_from_sushmitha_after_block=% t3_recipient_count=% t3_recipient_last_id_is_null=% t3_sender_count=% t3_sender_last_body=% publication_tables=%',
    v_t1_count, v_t1_last_body, v_t1_seen_by_nani,
    v_t2_visible_to_sush_before, (not v_t2_visible_to_sush_after), (not v_t2_visible_to_sushmitha_after),
    v_t3_recipient_count, (v_t3_recipient_last_id is null),
    v_t3_sender_count, v_t3_sender_last_body,
    v_pub_tables;
end $$;

rollback;
