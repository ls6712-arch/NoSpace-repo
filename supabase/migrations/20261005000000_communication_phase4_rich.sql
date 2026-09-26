-- Communication Phase 4: richer conversations (staged, NOT applied until
-- Sush's explicit OK — see docs/communication-strategy.md's Phase 4 section
-- and decisions 5-6). Adds: a private storage bucket for message photos
-- (decision 5), sharing a Moment or Pursuit into a chat, and unsending your
-- own message (decision 6, an update — never a hard delete).
--
-- Nothing here touches Spaces, .env, or .gitignore. Nothing here loosens
-- any existing rule: the "you can write in an accepted thread" policy gets
-- new AND-ed conditions, never a removed one, and Seen/unread/block/report
-- from Phases 1-3 are untouched.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. messages: kind + attachment columns.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Done FIRST, before the storage bucket/policies below — the admin-review
-- read policy on storage.objects references messages.media_path, which
-- has to already exist by the time that policy is created.

alter table public.messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_path text,
  add column if not exists shared_post_id bigint references public.posts(id) on delete set null,
  add column if not exists shared_pursuit_id text references public.pursuits(id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- Every existing row is a plain-text message with no attachment, so the
-- new default ('text') plus all-null attachment columns already leaves
-- every existing row valid against the shape constraints below — no
-- backfill needed.

alter table public.messages
  drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'photo', 'moment', 'pursuit'));

-- Exactly the one field that matches `kind` is set, all others null — a
-- photo message can't also carry a shared_post_id, etc. Bypassed once
-- deleted_at is set: unsend clears every attachment field regardless of
-- what `kind` was, by design (decision 6 — the deleted message carries no
-- content at all any more), so a deleted 'photo' message legitimately has
-- media_path = null.
alter table public.messages
  drop constraint if exists messages_kind_shape;
alter table public.messages
  add constraint messages_kind_shape
  check (
    deleted_at is not null
    or (kind = 'text' and media_path is null and shared_post_id is null and shared_pursuit_id is null)
    or (kind = 'photo' and media_path is not null and shared_post_id is null and shared_pursuit_id is null)
    or (kind = 'moment' and media_path is null and shared_post_id is not null and shared_pursuit_id is null)
    or (kind = 'pursuit' and media_path is null and shared_post_id is null and shared_pursuit_id is not null)
  );

-- body can only be empty when there's an attachment to carry the message
-- instead (a photo/moment/pursuit share can be sent with no caption).
-- Also bypassed once deleted_at is set — unsend clears body to '' even for
-- a 'text' message.
alter table public.messages
  drop constraint if exists messages_body_or_attachment;
alter table public.messages
  add constraint messages_body_or_attachment
  check (
    deleted_at is not null
    or length(body) > 0
    or kind <> 'text'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. message-media: a new PRIVATE bucket for chat photos.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Unlike post-media (public = true; a public URL works for anyone who has
-- it, per docs/private-media-plan.md's own finding), this bucket is
-- public = false — every read goes through RLS on storage.objects, no
-- unsigned public endpoint exists for it at all. Object path convention:
-- `<participation_id>/<uuid>.<ext>` (participation_id as folder segment 1,
-- so a single EXISTS-against-participations check on that segment governs
-- both upload and read — the same idea as post-media's own
-- uploader-folder scoping, just keyed by thread instead of by uploader,
-- since a chat photo needs to be readable by TWO people, not one).
--
-- Every policy below compares that folder segment as TEXT
-- (`p.id::text = (storage.foldername(name))[1]`), never by casting the
-- segment itself to bigint. A storage.objects policy is evaluated against
-- every row in the table regardless of bucket — Postgres doesn't guarantee
-- `bucket_id = 'message-media'` short-circuits before the rest of the
-- clause runs — so a `(storage.foldername(name))[1])::bigint` cast would
-- blow up with "invalid input syntax for type bigint" on post-media/avatar
-- paths, whose first folder segment is a uuid, not a number. That would
-- have broken ordinary Moment and avatar uploads/reads, not just this
-- bucket. Caught in review before applying.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 2a. Upload: only a party to an ACCEPTED, not-blocked-between
-- participation, into that participation's own folder. A pending
-- direct_message can't receive a photo at all (see the messages INSERT
-- policy below for the matching rule on the row itself) — accepted-only
-- here is what actually enforces that at the storage layer, since nothing
-- stops a client from trying to upload straight to storage without ever
-- inserting a messages row.
drop policy if exists "upload a photo into your own accepted chat" on storage.objects;
create policy "upload a photo into your own accepted chat"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-media'
    and exists (
      select 1 from public.participations p
      where p.id::text = (storage.foldername(name))[1]
        and p.status = 'accepted'
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
        and not private.is_blocked_between(p.from_user, p.to_user)
    )
  );

-- 2b. Read: the two parties to the thread (not blocked-between — a block
-- cuts off a chat photo the same way it cuts off Seen in Phase 3, even for
-- a photo sent before the block), OR an admin reviewing a message that has
-- an open or reviewed report against it. This is also what scopes the
-- storage LIST API (Supabase's list uses this same SELECT policy — see
-- close_post_media_listing's precedent for exactly this concern on
-- post-media), so nobody can enumerate another thread's photos either.
drop policy if exists "read your chat's photos, or a reported one as admin" on storage.objects;
create policy "read your chat's photos, or a reported one as admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-media'
    and (
      exists (
        select 1 from public.participations p
        where p.id::text = (storage.foldername(name))[1]
          and (auth.uid() = p.from_user or auth.uid() = p.to_user)
          and not private.is_blocked_between(p.from_user, p.to_user)
      )
      or (
        private.is_admin(auth.uid())
        and exists (
          select 1
          from public.messages m
          join public.reports r
            on r.target_kind = 'message'
            and r.target_id = m.id
            and r.status in ('open', 'reviewed')
          where m.media_path = storage.objects.name
        )
      )
    )
  );

-- 2c. Delete: only the uploader, only their own objects (unsend deletes
-- the storage object too — see the app-side unsend flow). Storage's own
-- `owner` column is set to the uploading user automatically; unlike
-- post-media's path (which embeds the uploader's uid as folder segment 1),
-- this bucket's folder segment 1 is the *thread*, not the uploader, so
-- ownership has to be checked this way instead.
drop policy if exists "you delete your own message-media uploads" on storage.objects;
create policy "you delete your own message-media uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-media'
    and owner = (select auth.uid())
  );

-- No UPDATE policy at all — a message photo, once uploaded, never changes
-- in place (unsend removes the object outright instead).

-- ═══════════════════════════════════════════════════════════════════════
-- 3. messages: extend the INSERT policy (never loosen it).
-- ═══════════════════════════════════════════════════════════════════════
--
-- Same accepted/pending structure as Phase 1 left it, AND-ed with three
-- new rules: (a) a pending direct_message's one allowed message must be
-- plain text — no photo or share in a message request; (b) a photo's
-- media_path must live under this participation's own folder; (c) sharing
-- a Moment or Pursuit is only allowed if the EXISTS check against
-- posts/pursuits succeeds for the *inserting user's own RLS* — since this
-- is an ordinary correlated subquery evaluated under the caller's role,
-- not a bypass, a sender who can't currently see a Moment/Pursuit (private,
-- followers-only they don't follow, already deleted) simply can't
-- reference it here at all, the same rule that already governs their own
-- reads. This is also why the recipient's own later read of a shared post
-- never widens: nothing here grants posts/pursuits access — it only
-- narrows who's allowed to CREATE the share row in the first place.
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
            and messages.kind = 'text'
          )
        )
    )
    and (
      messages.kind <> 'photo'
      or messages.media_path like (messages.participation_id::text || '/%')
    )
    and (
      messages.kind <> 'moment'
      or exists (select 1 from public.posts where id = messages.shared_post_id)
    )
    and (
      messages.kind <> 'pursuit'
      or exists (select 1 from public.pursuits where id = messages.shared_pursuit_id)
    )
  );

-- The SELECT policy ("messages need an accepted participation") is
-- unchanged — it already governs every column of a message row, new ones
-- included, since it's a row-level (not column-level) policy.

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Unsend: SECURITY DEFINER function, not a raw UPDATE policy.
-- ═══════════════════════════════════════════════════════════════════════
--
-- A function (rather than an UPDATE policy) is what makes "nothing else
-- about a message can ever change" actually airtight: it sets exactly
-- deleted_at/body/media_path/shared_post_id/shared_pursuit_id and nothing
-- a caller supplies can widen that, whereas an UPDATE policy's WITH CHECK
-- has no clean way to pin every OTHER column to its previous value. Same
-- generic error for "no such message" and "not your message" — so a
-- caller can't use this to learn a message id exists that isn't theirs.
create or replace function public.unsend_message(message_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_user uuid;
  v_deleted_at timestamptz;
begin
  select from_user, deleted_at into v_from_user, v_deleted_at
  from public.messages
  where id = message_id;

  if v_from_user is null or auth.uid() is distinct from v_from_user then
    raise exception 'not allowed to unsend this message';
  end if;

  if v_deleted_at is not null then
    return; -- already unsent; idempotent no-op, not an error
  end if;

  update public.messages
  set deleted_at = now(),
      body = '',
      media_path = null,
      shared_post_id = null,
      shared_pursuit_id = null
  where id = message_id;
end;
$$;

revoke all on function public.unsend_message(bigint) from public, anon;
grant execute on function public.unsend_message(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. participation_message_summaries(): preview text for the new kinds.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Same shape and unread_count logic as Phase 3 left it (drop-then-create
-- because changing a set-returning function's body doesn't need a column
-- change here, but keeping the drop/create pairing consistent with the
-- rest of this file's style rather than mixing CREATE OR REPLACE and
-- DROP+CREATE across sections). Preview text: "Message deleted" once
-- deleted_at is set (checked first — a deleted photo/moment/pursuit
-- message must never fall through to "Photo"/etc.), else the kind's own
-- label, else the plain body for an ordinary text message.
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
    case
      when lm.deleted_at is not null then 'Message deleted'
      when lm.kind = 'photo' then 'Photo'
      when lm.kind = 'moment' then 'Shared a Moment'
      when lm.kind = 'pursuit' then 'Shared a Pursuit'
      else lm.body
    end as last_message_body,
    lm.created_at as last_message_created_at,
    coalesce(u.unread_count, 0) as unread_count
  from public.participations p
  left join lateral (
    select count(*) as message_count
    from public.messages m
    where m.participation_id = p.id
  ) c on true
  left join lateral (
    select m.id, m.from_user, m.body, m.created_at, m.kind, m.deleted_at
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
