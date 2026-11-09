-- Soosh: Corner chat, audit copy of removed messages (follow-up to 20261124000000_corner_chat.sql).
--
-- Run after 20261124000000_corner_chat.sql. Staging first.
-- Rollback: rollback_20261125000000_corner_message_removals.sql.
-- Verification: supabase/verification/corner_messages.sql.
--
-- Removing a message cleared its text and photo paths, so once its author deleted it nobody could review
-- what was reported. Now remove_corner_message() copies the content to private.corner_message_removals
-- before it clears it:
--   * message id, author, corner_key, body, media_paths, who removed it, when;
--   * admins only: the table is in the private schema with no grant to any client role, and the one way
--     to read it is public.admin_corner_message(), which checks private.is_admin(). AdminReports calls it
--     next to a reported message;
--   * kept 30 days, then removed together with the photo files. A SQL DELETE cannot remove a Storage
--     file (Storage blocks direct deletes from storage.objects, and a deleted row would leave the bytes
--     behind), so the daily pg_cron job calls the purge-corner-chat Edge Function. The function asks
--     public.corner_removals_due() which rows are past 30 days, removes their photos through the Storage
--     API, and only then calls public.corner_removals_purged() to drop the rows. If the function is not
--     deployed or Storage fails, nothing is dropped and the copy simply stays longer.
--
-- Photos of a removed message stay in the bucket for those 30 days, so the Storage rules change with them:
--   * members can read a photo only while a live message points at it (an admin can read any, to review);
--   * nobody can delete a photo an audit row holds (the author could otherwise erase the evidence by
--     calling the Storage API directly). Deleting your own photo that no audit row holds still works,
--     which is what cleaning up after a failed send needs.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. The audit table
-- ═══════════════════════════════════════════════════════════════════════

create table private.corner_message_removals (
  message_id bigint primary key,
  author_id uuid not null,
  corner_key text not null,
  body text not null,
  media_paths text[] not null default '{}',
  removed_by uuid,
  removed_at timestamptz not null default now()
);

-- The daily purge asks for what is past 30 days.
create index corner_message_removals_removed_at_idx on private.corner_message_removals (removed_at);
-- Storage policies ask whether a photo path is held.
create index corner_message_removals_media_idx on private.corner_message_removals using gin (media_paths);

alter table private.corner_message_removals enable row level security;
revoke all on private.corner_message_removals from public, anon, authenticated;

-- Photos are looked up by path in the Storage read rule below.
create index corner_messages_media_paths_idx on public.corner_messages using gin (media_paths);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Removing a message copies it first
-- ═══════════════════════════════════════════════════════════════════════

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

  -- One statement: the row is locked, its old content is copied, then it is cleared.
  with target as (
    select cm.id, cm.user_id, cm.corner_key, cm.body, cm.media_paths
    from public.corner_messages cm
    where cm.id = p_id
      and cm.removed_at is null
      and (cm.user_id = v_me or private.is_admin(v_me))
    for update
  ),
  cleared as (
    update public.corner_messages
       set removed_at = now(), body = '', media_paths = '{}'
      from target
     where public.corner_messages.id = target.id
    returning target.id, target.user_id, target.corner_key, target.body, target.media_paths
  )
  insert into private.corner_message_removals (message_id, author_id, corner_key, body, media_paths, removed_by)
  select cleared.id, cleared.user_id, cleared.corner_key, cleared.body, cleared.media_paths, v_me
  from cleared;
  get diagnostics v_done = row_count;

  if v_done = 0 then
    raise exception 'That message is not yours to remove.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.remove_corner_message(bigint) from public, anon;
grant execute on function public.remove_corner_message(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Admins read it, next to a reported message
-- ═══════════════════════════════════════════════════════════════════════
--
-- A removed message comes from its audit copy (removed = true); a live one from the message itself
-- (removed = false). After the 30 days a removed message has neither, and the function returns no row.

create or replace function public.admin_corner_message(p_id bigint)
returns table (
  message_id bigint,
  author_id uuid,
  corner_key text,
  body text,
  media_paths text[],
  removed boolean,
  removed_by uuid,
  removed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  return query
    select r.message_id, r.author_id, r.corner_key, r.body, r.media_paths, true, r.removed_by, r.removed_at
    from private.corner_message_removals r
    where r.message_id = p_id
    union all
    select cm.id, cm.user_id, cm.corner_key, cm.body, cm.media_paths, false, null::uuid, null::timestamptz
    from public.corner_messages cm
    where cm.id = p_id and cm.removed_at is null;
end;
$$;

revoke all on function public.admin_corner_message(bigint) from public, anon;
grant execute on function public.admin_corner_message(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Storage: photos of removed messages are not for members, and cannot be deleted while held
-- ═══════════════════════════════════════════════════════════════════════

create or replace function private.corner_chat_photo_held(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.corner_message_removals r
    where r.media_paths @> array[p_path]
  )
$$;

revoke all on function private.corner_chat_photo_held(text) from public, anon;
grant execute on function private.corner_chat_photo_held(text) to authenticated;

drop policy if exists "members read Corner chat photos" on storage.objects;
create policy "members read photos still in a message, admins read any"
  on storage.objects for select to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (select private.is_member())
    and (
      (select private.is_admin((select auth.uid())))
      or exists (
        select 1 from public.corner_messages cm
        where cm.removed_at is null
          and cm.media_paths @> array[storage.objects.name]
      )
    )
  );

drop policy if exists "members delete their own Corner chat photos" on storage.objects;
create policy "members delete their own Corner chat photos unless held"
  on storage.objects for delete to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
    and not private.corner_chat_photo_held(storage.objects.name)
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 5. The 30-day purge
-- ═══════════════════════════════════════════════════════════════════════

-- Which copies are past 30 days, with their photo paths. Only the Edge Function (service role) calls it.
create or replace function public.corner_removals_due(p_limit integer default 200)
returns table (message_id bigint, media_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select r.message_id, r.media_paths
  from private.corner_message_removals r
  where r.removed_at < now() - interval '30 days'
  order by r.removed_at
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
$$;

-- Drops copies that are past 30 days, once their photos are gone. A copy that is not due is never dropped,
-- whatever ids are passed. Returns how many were dropped.
create or replace function public.corner_removals_purged(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from private.corner_message_removals r
  where r.message_id = any (p_ids)
    and r.removed_at < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.corner_removals_due(integer) from public, anon, authenticated;
revoke all on function public.corner_removals_purged(bigint[]) from public, anon, authenticated;
grant execute on function public.corner_removals_due(integer) to service_role;
grant execute on function public.corner_removals_purged(bigint[]) to service_role;

-- Every day at 04:25 UTC, after the other nightly jobs. The Edge Function needs no key: it can only remove
-- what is already past 30 days, so calling it early does nothing (same reasoning as stubby-restock).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'purge-corner-message-removals',
  '25 4 * * *',
  $cron$select net.http_post(
    url := 'https://eyzokuhhbyidvmuqfmwm.supabase.co/functions/v1/purge-corner-chat',
    body := '{}'::jsonb,
    headers := '{"content-type":"application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );$cron$
);
