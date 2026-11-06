-- Rollback for 20261118000000_founding_stub.sql.
-- Removes the triggers, the index, the city column and the flag, and puts the Stub kind
-- constraints back as 20261101134307_stubs_four_kinds.sql left them (four kinds).
-- Any founding Stubs are removed first (the old constraint would reject them). Nothing else
-- is touched.

drop trigger if exists posts_zz_award_founding_stub on public.posts;
drop trigger if exists posts_zz_award_founding_stub_on_update on public.posts;
drop function if exists private.award_founding_stub();

drop index if exists public.stubs_founding_key;
delete from public.stubs where public.stubs.kind = 'founding';

alter table public.stubs drop constraint stubs_kind_check;
alter table public.stubs drop constraint stubs_kind_fields;
alter table public.stubs
  add constraint stubs_kind_check check (kind in ('event', 'finish', 'drop', 'regular')),
  add constraint stubs_kind_fields check (
    (kind = 'event' and event_id is not null and space_id is not null)
    or (kind = 'finish' and event_id is null and pursuit_id is not null and drop_id is null)
    or (kind = 'drop' and event_id is null and pursuit_id is not null and drop_id is not null and edition is not null)
    or (kind = 'regular' and event_id is null and corner_key is not null and period is not null)
  );
alter table public.stubs drop column city;

delete from public.app_config where public.app_config.key = 'founding_stub_enabled';
