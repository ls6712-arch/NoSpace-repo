-- Read only. Expected zero fixture rows.
select count(*) as fixture_rows from public.pursuits p where p.id like 'calendar-check-%';
