-- DA7 (consistency pass): "QA Brick Builders" was a test Space. It is already
-- soft-deleted (spaces.status = 'deleted'), so it is absent from Discover, but
-- two notifications about it still show in the bell. Remove just those rows.
-- Matched by id AND body so a reused id can never delete something else.
-- NOT YET RUN on the live project: goes live when this PR is merged.
delete from public.notifications n
where n.id in (144, 145)
  and n.body in (
    'Your request to join QA Brick Builders wasn''t approved.',
    'Nani asked to join QA Brick Builders.'
  );
