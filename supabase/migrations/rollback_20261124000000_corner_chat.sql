-- Rollback for 20261124000000_corner_chat.sql: removes the table, the removal RPC, the helpers and the
-- storage and Realtime policies. Left in place on purpose:
--   * the corner_message value in reports_target_kind_check (reports already filed about a message keep
--     their row; narrowing the check would fail while any exist);
--   * the corner-chat bucket and its photos (Storage objects are removed through the Storage API, then
--     the bucket from the dashboard).
drop policy if exists "members join Corner chat presence: read" on realtime.messages;
drop policy if exists "members join Corner chat presence: write" on realtime.messages;
drop policy if exists "members read Corner chat photos" on storage.objects;
drop policy if exists "members upload Corner chat photos to their own folder" on storage.objects;
drop policy if exists "members delete their own Corner chat photos" on storage.objects;
drop function if exists public.remove_corner_message(bigint);
alter publication supabase_realtime drop table public.corner_messages;
drop table if exists public.corner_messages;
drop function if exists private.corner_messages_before_insert();
drop function if exists private.corner_chat_folder(text);
