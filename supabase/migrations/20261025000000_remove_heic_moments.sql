-- Remove the 11 Moments whose photos are HEIC files (Oct 22, 2026).
--
-- These were uploaded in Sept 2026, before uploads converted iPhone photos.
-- HEIC only displays in Safari, so in Chrome, Firefox and on Android these
-- Moments show as blank cards on Discover. The owner asked for them to be
-- removed rather than converted.
--
-- Matched by id AND by still having a .heic file, so an id that no longer
-- points at one of these Moments can never delete anything else.
--
-- What goes with them: thoughts, reactions, likes, bookmarks, Space shares
-- and participations (ON DELETE CASCADE). Notifications, shared messages,
-- Pursuit progress and profile covers that pointed at them keep their row
-- and lose the link (ON DELETE SET NULL). The Corner counts update through
-- the corners_sync trigger. The files stay in the post-media bucket, unused.
--
-- This cannot be rolled back: the rows are gone once it runs.
-- NOT YET RUN on the live project: goes live when this PR is merged.
delete from public.posts p
where p.id in (
    100033, 100043, 100051, 100052, 100053, 100054,
    100055, 100056, 100058, 100102, 100104
  )
  and exists (
    select 1
    from unnest(coalesce(p.media_urls, '{}'::text[]) || p.media_url) as u(url)
    where u.url ilike '%.heic'
  );
