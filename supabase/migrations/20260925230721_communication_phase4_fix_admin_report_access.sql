-- Fix for 20261005000000_communication_phase4_rich.sql, found by its own
-- verification script (not by review this time): the admin-review branch
-- of "read your chat's photos, or a reported one as admin" joined
-- public.messages straight to public.reports inside the storage policy's
-- own EXISTS. That join is itself subject to messages' own SELECT RLS
-- ("messages need an accepted participation") — an admin who isn't a party
-- to the reported thread can't see that messages row at all under the
-- ordinary policy, so the EXISTS came back empty regardless of whether a
-- report existed. Live verification caught this directly: an admin with a
-- genuine open report against a message still couldn't read its photo.
--
-- Same fix shape as private.is_blocked_between: a narrow SECURITY DEFINER
-- helper that bypasses messages/reports RLS for exactly one question
-- ("does this media_path belong to a message with an open/reviewed
-- report?"), reachable only through the storage policy that calls it —
-- the `private` schema isn't exposed through the API. Needs its own
-- explicit GRANT EXECUTE to `authenticated`, same lesson as Phase 3's own
-- SECURITY DEFINER review fix: a policy (or a SECURITY INVOKER wrapper)
-- calling a SECURITY DEFINER function runs that call as the caller, so the
-- callee's own grants govern it independently of the caller's.

create or replace function private.message_media_path_reported(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    join public.reports r
      on r.target_kind = 'message'
      and r.target_id = m.id
      and r.status in ('open', 'reviewed')
    where m.media_path = p_path
  );
$$;

revoke all on function private.message_media_path_reported(text) from public, anon;
grant execute on function private.message_media_path_reported(text) to authenticated;

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
        and private.message_media_path_reported(storage.objects.name)
      )
    )
  );
