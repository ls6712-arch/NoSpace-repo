-- Rollback for 20261005000001_communication_phase4_fix_admin_report_access.sql.
-- Restores the original (buggy) admin-review policy and drops the helper.
-- Only meaningful paired with rolling back 20261005000000 too, since this
-- policy shape is otherwise broken (see that migration's own fix note).

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

drop function if exists private.message_media_path_reported(text);
