-- Rollback for 20261005000000_communication_phase4_rich.sql.
--
-- WARNING: this is destructive of any real message photos uploaded while
-- the forward migration was live — it deletes every object in the
-- message-media bucket, then the bucket itself. Only run this if reverting
-- shortly after applying, before real usage, the same assumption every
-- other rollback in this repo makes.

-- ═══════════════════════════════════════════════════════════════════════
-- 5. participation_message_summaries(): back to the Phase 3 shape (no
--    kind-aware preview text — plain body always).
-- ═══════════════════════════════════════════════════════════════════════
drop function if exists public.participation_message_summaries();

create function public.participation_message_summaries()
returns table (
  participation_id bigint,
  message_count bigint,
  last_message_id bigint,
  last_message_from_user uuid,
  last_message_body text,
  last_message_created_at timestamptz,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as participation_id,
    coalesce(c.message_count, 0) as message_count,
    lm.id as last_message_id,
    lm.from_user as last_message_from_user,
    lm.body as last_message_body,
    lm.created_at as last_message_created_at,
    coalesce(u.unread_count, 0) as unread_count
  from public.participations p
  left join lateral (
    select count(*) as message_count
    from public.messages m
    where m.participation_id = p.id
  ) c on true
  left join lateral (
    select m.id, m.from_user, m.body, m.created_at
    from public.messages m
    where m.participation_id = p.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as unread_count
    from public.messages m
    where m.participation_id = p.id
      and m.from_user <> auth.uid()
      and m.created_at > coalesce(
        (
          select cr.last_read_at from public.conversation_reads cr
          where cr.user_id = auth.uid() and cr.participation_id = p.id
        ),
        '-infinity'::timestamptz
      )
  ) u on true
  where (p.from_user = auth.uid() or p.to_user = auth.uid())
    and not private.is_blocked_between(p.from_user, p.to_user);
$$;

revoke execute on function public.participation_message_summaries() from public, anon, authenticated;
grant execute on function public.participation_message_summaries() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Drop the unsend function.
-- ═══════════════════════════════════════════════════════════════════════
drop function if exists public.unsend_message(bigint);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. messages INSERT policy: back to the Phase 1 shape (no kind-aware
--    rules).
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "you can write in an accepted thread" on public.messages;
create policy "you can write in an accepted thread"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.kind in ('make_together', 'explore_together', 'direct_message')
        and not private.is_blocked_between(p.from_user, p.to_user)
        and (
          (p.status = 'accepted' and (auth.uid() = p.from_user or auth.uid() = p.to_user))
          or (
            p.status = 'pending'
            and p.kind = 'direct_message'
            and auth.uid() = p.from_user
            and not private.participation_has_message(p.id)
          )
        )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. messages: drop the kind/attachment columns and their constraints.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.messages
  drop constraint if exists messages_body_or_attachment;
alter table public.messages
  drop constraint if exists messages_kind_shape;
alter table public.messages
  drop constraint if exists messages_kind_check;

alter table public.messages
  drop column if exists deleted_at,
  drop column if exists shared_pursuit_id,
  drop column if exists shared_post_id,
  drop column if exists media_path,
  drop column if exists kind;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. message-media: drop storage policies, objects, and the bucket.
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "you delete your own message-media uploads" on storage.objects;
drop policy if exists "read your chat's photos, or a reported one as admin" on storage.objects;
drop policy if exists "upload a photo into your own accepted chat" on storage.objects;

-- storage.objects has a statement-level trigger that rejects any direct SQL
-- DELETE unless this is set — a guard against exactly the kind of raw
-- cleanup this rollback needs to do.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'message-media';
delete from storage.buckets where id = 'message-media';
