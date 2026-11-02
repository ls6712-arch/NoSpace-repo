-- Rollback for 20261107000000_stubby_smarter_picks.sql.
-- Ideas that link to a Soosh page can't meet the old url check, so they are removed first.
-- Every other personal pick stays, without its kind, why, rank, ask and soonest-after.

delete from public.personal_picks pp where pp.url !~* '^https://[^[:space:]]+$';

drop index if exists public.personal_picks_user_ask_idx;
alter table public.personal_picks drop constraint if exists personal_picks_url_check;
alter table public.personal_picks add constraint personal_picks_url_check
  check (char_length(url) <= 500 and url ~* '^https://[^[:space:]]+$');

alter table public.personal_picks
  drop column if exists soonest_after,
  drop column if exists ask_id,
  drop column if exists rank,
  drop column if exists why,
  drop column if exists kind;
