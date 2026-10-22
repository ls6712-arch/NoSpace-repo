-- Media buckets accept only formats every browser can show (Oct 22, 2026).
--
-- Every upload now goes through src/app/lib/uploadMedia.ts first: photos
-- become JPEG (GIFs stay GIF), and a playable .mov is stored as video/mp4.
-- So HEIC, HEIF and QuickTime never need to be stored. Refusing them here
-- means an upload that somehow skipped that step fails with a clear error
-- instead of becoming a blank card outside Safari.
--
-- Rollback: rollback_20261026000000_media_buckets_web_safe_types.sql.
-- NOT YET RUN on the live project: goes live when this PR is merged.
update storage.buckets b
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm'
]
where b.id in ('post-media', 'moment-media');
