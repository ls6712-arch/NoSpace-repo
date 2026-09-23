-- Rollback for 20260923110000_pursuits_measured_and_shared.sql.
-- Loses all invites and logged progress amounts.
drop table if exists public.pursuit_progress;
drop table if exists public.pursuit_members;
drop policy if exists "owners, members and the public (if shared) see a pursuit" on public.pursuits;
create policy "you see your own pursuits, others see only shared ones"
  on public.pursuits for select using (auth.uid() = user_id or shared = true);
drop function if exists public.is_pursuit_participant(text, uuid);
alter table public.pursuits drop column if exists measure;
alter table public.pursuits drop column if exists mode;
