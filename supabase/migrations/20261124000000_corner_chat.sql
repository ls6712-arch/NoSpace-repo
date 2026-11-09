-- Soosh: Corner chat, Corner walls PR 3 (data). Brief of Nov 8, 2026.
--
-- Run after 20261123000000_corner_walls.sql. Staging first.
-- Rollback: rollback_20261124000000_corner_chat.sql.
-- Verification: supabase/verification/corner_messages.sql.
--
-- One chat per Corner, for members only:
--   * public.corner_messages: a short text, up to 4 photos, or both. corner_key is the key
--     cornerFollowKey() builds in the app ("space-slug:corner-slug").
--   * Read: members only. People the reader blocked, or who blocked the reader, are left out (the same
--     private.is_blocked_between() rule Home uses). A removed message stays as a row with no text and no
--     photos, so Realtime can tell everyone it is gone; the app draws nothing for it.
--   * Write: members only, as themselves, 20 messages per 10 minutes per person (public.enforce_rate_limit,
--     the same helper every other insert uses). There is no UPDATE or DELETE grant: removing a message goes
--     through remove_corner_message(), which lets the author or an admin set removed_at and clears the content.
--   * private bucket corner-chat, path <corner_key with ":" as "_">/<user_id>/<uuid>.jpg. Storage keys do not
--     take a colon safely, so the folder spells the key with an underscore; the table keeps the real key.
--     Members read, a member writes only inside their own folder.
--   * reports gets a corner_message target (reports.target_id is the message id, bigint).
--   * Presence (who is here now, who is typing) rides a private Realtime channel "corner-chat:<corner_key>";
--     realtime.messages gets two policies so only members can join it.
--
-- No notifications for chat messages in this PR, so enforce_notification_insert is untouched.
-- Every column inside every subquery is table-qualified (CLAUDE.md).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Storage folder spelling
-- ═══════════════════════════════════════════════════════════════════════

create or replace function private.corner_chat_folder(p_corner_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(p_corner_key, ':', '_')
$$;

revoke all on function private.corner_chat_folder(text) from public, anon;
grant execute on function private.corner_chat_folder(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. corner_messages
-- ═══════════════════════════════════════════════════════════════════════

create table public.corner_messages (
  id bigint generated always as identity primary key,
  corner_key text not null
    check (char_length(corner_key) between 3 and 160 and corner_key ~ '^[^/[:space:]]+:[^/[:space:]]+$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 4),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  -- Words or at least one photo. A removed message has neither: its content is cleared.
  constraint corner_messages_body_or_photo
    check (removed_at is not null or char_length(body) > 0 or cardinality(media_paths) > 0),
  constraint corner_messages_removed_is_empty
    check (removed_at is null or (body = '' and cardinality(media_paths) = 0))
);

-- The page loads the last 50 of one Corner, then older ones.
create index corner_messages_corner_created_idx on public.corner_messages (corner_key, created_at desc, id desc);
create index corner_messages_user_idx on public.corner_messages (user_id);

-- On the way in: the text is trimmed, a photo path must sit in the sender's own folder for this Corner,
-- and a person sends at most 20 messages in 10 minutes.
create or replace function private.corner_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  new.body := btrim(coalesce(new.body, ''));
  new.removed_at := null;
  new.created_at := now();

  foreach v_path in array new.media_paths loop
    if v_path is null
       or not starts_with(v_path, private.corner_chat_folder(new.corner_key) || '/' || new.user_id::text || '/') then
      raise exception 'A photo must be uploaded to your own folder for this Corner.' using errcode = '23514';
    end if;
  end loop;

  perform public.enforce_rate_limit('corner_messages_insert', 20, interval '10 minutes');
  return new;
end;
$$;
revoke all on function private.corner_messages_before_insert() from public, anon, authenticated;
create trigger corner_messages_before_insert
  before insert on public.corner_messages
  for each row execute function private.corner_messages_before_insert();

alter table public.corner_messages enable row level security;

-- After the member gate (20261111000050) every table is members only: a guest, a Stubby account
-- or a signed-out visitor reaches nothing here (supabase/security/accessAllowlist.test.ts).
create policy "members only" on public.corner_messages as restrictive for all to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

revoke all on public.corner_messages from public, anon, authenticated;
grant select on public.corner_messages to authenticated;
grant insert (corner_key, body, media_paths) on public.corner_messages to authenticated;

create policy "members read the chat, minus people blocked either way"
  on public.corner_messages for select to authenticated
  using (
    not private.is_blocked_between((select auth.uid()), corner_messages.user_id)
  );

create policy "members write as themselves"
  on public.corner_messages for insert to authenticated
  with check (
    corner_messages.user_id = (select auth.uid())
    and corner_messages.removed_at is null
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Removing a message (the author, or an admin)
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

revoke all on function public.remove_corner_message(bigint) from public, anon;
grant execute on function public.remove_corner_message(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Live updates
-- ═══════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pg_publication_tables.pubname = 'supabase_realtime'
      and pg_publication_tables.schemaname = 'public'
      and pg_publication_tables.tablename = 'corner_messages'
  ) then
    alter publication supabase_realtime add table public.corner_messages;
  end if;
end $$;

-- Presence on a private channel: only members join "corner-chat:<corner_key>". The restrictive
-- "members only" policy on realtime.messages (member gate) already applies on top of these.
create policy "members join Corner chat presence: read" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and (select realtime.topic()) like 'corner-chat:%'
    and (select private.is_member())
  );

create policy "members join Corner chat presence: write" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('presence', 'broadcast')
    and (select realtime.topic()) like 'corner-chat:%'
    and (select private.is_member())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Photos: a private bucket
-- ═══════════════════════════════════════════════════════════════════════
--
-- Photos only (the app turns every pick into a JPEG with its metadata stripped before upload), 10 MiB cap.
-- Every read goes through a signed URL. Folder segment 1 is the Corner, segment 2 the sender.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('corner-chat', 'corner-chat', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

create policy "members read Corner chat photos"
  on storage.objects for select to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (select private.is_member())
  );

create policy "members upload Corner chat photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    storage.objects.bucket_id = 'corner-chat'
    and (select private.is_member())
    and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  );

create policy "members delete their own Corner chat photos"
  on storage.objects for delete to authenticated
  using (
    storage.objects.bucket_id = 'corner-chat'
    and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Reports
-- ═══════════════════════════════════════════════════════════════════════

alter table public.reports drop constraint if exists reports_target_kind_check;
alter table public.reports
  add constraint reports_target_kind_check
  check (target_kind in ('profile', 'message', 'moment', 'thought', 'corner_message'));
