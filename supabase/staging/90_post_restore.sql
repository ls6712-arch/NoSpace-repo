-- Staging rebuild, step 4 of 4: what a public/private schema dump does not carry.
-- See docs/staging-rebuild-runbook.md. Run on nospace-staging only, after the schema and
-- reference data are restored. Every definition below was read from production on Nov 6, 2026.
--
--   1. pg_net (production has it, staging did not)
--   2. the two triggers on auth.users
--   3. the realtime publication (4 tables)
--   4. the 16 storage policies on storage.objects (dropping the public schema also dropped the
--      ones that depend on it, so all 16 are recreated)
--   5. the 4 cron jobs staging lacked. stubby-restock points at the STAGING host and is left OFF
--      until stubby-scout is deployed to staging.

\set ON_ERROR_STOP on

begin;

-- The storage policy texts below name public tables without a schema, as production stores them.
set local search_path = public, extensions;

-- 1. pg_net
create extension if not exists pg_net with schema extensions;

-- 2. auth.users triggers
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
drop trigger if exists on_auth_guest_signed_up on auth.users;
create trigger on_auth_guest_signed_up after update of is_anonymous on auth.users
  for each row execute function private.handle_guest_signed_up();

-- 3. realtime
alter publication supabase_realtime add table
  public.conversation_reads, public.messages, public.notifications, public.participations;

-- 4. storage policies
drop policy if exists "You can delete your own uploads" on storage.objects;
create policy "You can delete your own uploads" on storage.objects as permissive for delete to public using (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "You can upload into your own folder" on storage.objects;
create policy "You can upload into your own folder" on storage.objects as permissive for insert to public with check (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "members only" on storage.objects;
create policy "members only" on storage.objects as restrictive for all to authenticated using (( SELECT private.is_member() AS is_member)) with check (( SELECT private.is_member() AS is_member));
drop policy if exists "moment-media: active accounts only" on storage.objects;
create policy "moment-media: active accounts only" on storage.objects as restrictive for insert to authenticated with check (((bucket_id <> 'moment-media'::text) OR private.is_active(( SELECT auth.uid() AS uid))));
drop policy if exists "moment-media: delete your own files" on storage.objects;
create policy "moment-media: delete your own files" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'moment-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
drop policy if exists "moment-media: replace your own files" on storage.objects;
create policy "moment-media: replace your own files" on storage.objects as permissive for update to authenticated using (((bucket_id = 'moment-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = 'moment-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
drop policy if exists "moment-media: see photos of moments you can see" on storage.objects;
create policy "moment-media: see photos of moments you can see" on storage.objects as permissive for select to anon, authenticated using (((bucket_id = 'moment-media'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM posts p
  WHERE (p.media_paths @> ARRAY[objects.name]))) OR (EXISTS ( SELECT 1
   FROM pursuits pu
  WHERE ((pu.cover_image_path = objects.name) AND ((pu.user_id = ( SELECT auth.uid() AS uid)) OR (pu.shared = true) OR is_pursuit_participant(pu.id, ( SELECT auth.uid() AS uid)))))))));
drop policy if exists "moment-media: upload into your own folder" on storage.objects;
create policy "moment-media: upload into your own folder" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'moment-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
drop policy if exists "read your chat's photos, or a reported one as admin" on storage.objects;
create policy "read your chat's photos, or a reported one as admin" on storage.objects as permissive for select to authenticated using (((bucket_id = 'message-media'::text) AND ((EXISTS ( SELECT 1
   FROM participations p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[1]) AND ((auth.uid() = p.from_user) OR (auth.uid() = p.to_user)) AND (NOT private.is_blocked_between(p.from_user, p.to_user))))) OR (private.is_admin(auth.uid()) AND private.message_media_path_reported(name)))));
drop policy if exists "signed-in users can upload their own media" on storage.objects;
create policy "signed-in users can upload their own media" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "upload a photo into your own accepted chat" on storage.objects;
create policy "upload a photo into your own accepted chat" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'message-media'::text) AND (EXISTS ( SELECT 1
   FROM participations p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[1]) AND (p.status = 'accepted'::text) AND ((auth.uid() = p.from_user) OR (auth.uid() = p.to_user)) AND (NOT private.is_blocked_between(p.from_user, p.to_user)))))));
drop policy if exists "you delete your own message-media uploads" on storage.objects;
create policy "you delete your own message-media uploads" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'message-media'::text) AND (owner = ( SELECT auth.uid() AS uid))));
drop policy if exists "you delete your own post-media files" on storage.objects;
create policy "you delete your own post-media files" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "you replace your own post-media files" on storage.objects;
create policy "you replace your own post-media files" on storage.objects as permissive for update to authenticated using (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "you see your own post-media files" on storage.objects;
create policy "you see your own post-media files" on storage.objects as permissive for select to public using (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
drop policy if exists "you upload into your own post-media folder" on storage.objects;
create policy "you upload into your own post-media folder" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- 5. cron jobs staging lacked (the other four already exist and call functions the dump restores)
select cron.schedule('purge-inactive-guests', '20 4 * * *', 'select private.purge_inactive_guests();');
select cron.schedule('purge-stubby-rows', '15 4 * * *', 'select private.purge_stubby_rows();');
select cron.schedule('pursuit-session-reminders', '* * * * *', 'select private.dispatch_pursuit_reminders();');
select cron.schedule('stubby-restock', '*/10 9-10 * * *', $cmd$select net.http_post(
    url := 'https://iajtjxdlxzvigesecrqc.supabase.co/functions/v1/stubby-scout',
    body := '{"mode":"restock"}'::jsonb,
    headers := '{"content-type":"application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );$cmd$);
-- Off until stubby-scout is deployed to staging; turn it on then with:
--   select cron.alter_job((select jobid from cron.job where jobname = 'stubby-restock'), active := true);
select cron.alter_job((select jobid from cron.job where jobname = 'stubby-restock'), active := false);

commit;
