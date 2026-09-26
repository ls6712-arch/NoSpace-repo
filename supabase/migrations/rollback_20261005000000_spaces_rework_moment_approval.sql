-- Rollback for 20261005000000_spaces_rework_moment_approval.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores set_space_moment_status() to its pre-fix body (posting_mode
-- only, verbatim from 20260925010000) and drops the two new RPCs.
--
-- Not a recommendation, and incomplete by nature: the backfill this
-- migration ran isn't undone here — there's no record of which specific
-- rows it touched, and even if there were, re-pending a host's own
-- already-approved Moment would just be a new, different bug. Rolling
-- this back also removes the only way a host had to approve or decline a
-- member's Moment at all (SpaceManageTab's approval queue calls
-- approve_space_moment/decline_space_moment directly) — that UI would
-- start failing outright, not silently degrade.

create or replace function public.set_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select case when posting_mode = 'approval' then 'pending' else 'approved' end
  into new.status
  from spaces where id = new.space_id;
  return new;
end;
$$;

drop function if exists public.approve_space_moment(uuid, bigint);
drop function if exists public.decline_space_moment(uuid, bigint);
