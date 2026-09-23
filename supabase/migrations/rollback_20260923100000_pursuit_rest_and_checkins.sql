-- Rollback for 20260923100000_pursuit_rest_and_checkins.sql.
-- Drops the three columns. The app keeps working (it reads them as absent);
-- any resting state / cadence / ending note held only in the database is lost.
alter table public.pursuits drop column if exists ending_note;
alter table public.pursuits drop column if exists check_in_days;
alter table public.pursuits drop column if exists paused_at;
