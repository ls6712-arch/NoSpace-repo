-- Rollback for 20261125000000_corner_message_removals.sql: puts remove_corner_message() and the two Storage
-- policies back as 20261124000000_corner_chat.sql left them, and removes the audit table, its readers and
-- the daily job. The audit copies are lost with the table.
select cron.unschedule('purge-corner-message-removals');

drop function if exists public.corner_removals_purged(bigint[]);
drop function if exists public.corner_removals_due(integer);

drop policy if exists "members read photos still in a message, admins read any" on storage.objects;
drop policy if exists "members delete their own Corner chat photos unless held" on storage.objects;
create policy "members read Corner chat photos"
  on storage.objects for select to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (select private.is_member())
  );
create policy "members delete their own Corner chat photos"
  on storage.objects for delete to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  );
drop function if exists private.corner_chat_photo_held(text);

drop function if exists public.admin_corner_message(bigint);

create or replace function public.remove_corner_message(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_done bigint;
begin
  if v_me is null or not private.is_member() then
    raise exception 'Members only.' using errcode = '42501';
  end if;

  update public.corner_messages
     set removed_at = now(), body = '', media_paths = '{}'
   where public.corner_messages.id = p_id
     and public.corner_messages.removed_at is null
     and (public.corner_messages.user_id = v_me or private.is_admin(v_me));
  get diagnostics v_done = row_count;

  if v_done = 0 then
    raise exception 'That message is not yours to remove.' using errcode = '42501';
  end if;
end;
$$;

drop index if exists public.corner_messages_media_paths_idx;
drop table if exists private.corner_message_removals;
