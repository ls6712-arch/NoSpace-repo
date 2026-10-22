-- Restores the allowed types the two media buckets had before 20261026000000.
update storage.buckets b
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime'
]
where b.id in ('post-media', 'moment-media');
