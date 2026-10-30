-- Account deletion: the permanent step after the grace period.
--
-- Settings > Pause or leave > Delete sets profiles.deletion_requested_at and
-- signs the person out everywhere. From that moment is_visible_profile()
-- hides them and write_blocked() stops their writes (both already live).
-- Logging back in within 14 days and choosing "Keep my account" clears the
-- column. This migration adds what happens when nobody does: a nightly job
-- that removes the auth user for good.
--
-- Deleting the auth.users row is the whole delete. Checked live
-- (2026-10-29, pg_constraint): every foreign key to auth.users or profiles
-- is ON DELETE CASCADE or SET NULL, none restrict. The person's own rows
-- (profile, Moments, Pursuits, reactions, memberships) cascade away; shared
-- things they started (spaces.created_by, space_events, events) are SET
-- NULL, so other people's Spaces and Moments are untouched.
--
-- Not covered here: files in Storage. Supabase blocks direct deletes from
-- storage.objects (they must go through the Storage API), so uploaded images
-- stay in the bucket, unreachable since nothing references them. Cleaning
-- those needs an Edge Function with the service role key; a follow-up.
--
-- The 14 days must match DELETION_GRACE_DAYS in src/app/lib/accountStatus.ts.
--
-- Same shape as sweep_expired_host_handoffs (20260926000000): security
-- definer, EXECUTE revoked from every client role, so only the cron job
-- (running as the function owner) can call it.

create or replace function public.purge_deleted_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from auth.users u
    where u.id in (
      select p.id
      from public.profiles p
      where p.deletion_requested_at is not null
        and p.deletion_requested_at <= now() - interval '14 days'
    )
    returning u.id
  )
  select count(*) into v_count from gone;
  -- Logged with no personal content: just how many.
  raise log 'purge_deleted_accounts removed % account(s)', v_count;
  return v_count;
end;
$$;

revoke all on function public.purge_deleted_accounts() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'purge-deleted-accounts',
  '30 3 * * *',
  $$select public.purge_deleted_accounts();$$
);

-- Check it
-- select jobname, schedule, command, active from cron.job
-- where jobname = 'purge-deleted-accounts';
-- -- expect 1 row, active = true, schedule = '30 3 * * *'
-- Then run supabase/verification/account_deletion_purge_check.sql.
