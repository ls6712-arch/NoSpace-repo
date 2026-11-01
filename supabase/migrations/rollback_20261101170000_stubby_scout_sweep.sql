-- Rollback for 20261101170000_stubby_scout_sweep.sql.
-- Stops the sweep, drops the watch list and the member columns, and puts back the earlier
-- read policies. Picks a sweep or a member already found stay as ordinary City picks.
-- pg_net is left installed (other things may use it).

select cron.unschedule('stubby-scout-sweep')
where exists (select 1 from cron.job j where j.jobname = 'stubby-scout-sweep');

drop function if exists private.scout_sweep_call();
drop function if exists public.scout_sweep_token_ok(text);

delete from vault.secrets s where s.name in ('stubby_scout_sweep_token', 'stubby_scout_url');

drop policy if exists "admins read scout runs, members read their own" on public.scout_runs;
create policy "admins read scout runs"
  on public.scout_runs for select to authenticated
  using (private.is_admin((select auth.uid())));

drop index if exists public.scout_runs_member_idx;
alter table public.scout_runs
  drop column if exists watch_id,
  drop column if exists kind;

drop policy if exists "signed-in people read published picks, their own finds, admins read all" on public.city_picks;
create policy "signed-in people read published picks, admins read all"
  on public.city_picks for select to authenticated
  using (
    city_picks.published
    or private.is_admin((select auth.uid()))
  );

drop index if exists public.city_picks_requested_by_idx;
alter table public.city_picks drop column if exists requested_by;

drop table if exists public.scout_watches;
