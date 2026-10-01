-- Rollback for 20261014000000_step5a_pursuit_plans_and_let_go.sql.
--
-- Drops pursuit_plans (every saved next session and times-a-week goes with
-- it) and pursuits.let_go_at (Pursuits marked Let go read as active again).

drop table if exists public.pursuit_plans;
alter table public.pursuits drop column if exists let_go_at;
