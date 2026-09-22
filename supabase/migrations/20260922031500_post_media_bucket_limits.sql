-- The post-media bucket (post photos via ContentContext.tsx, and Add-a-
-- thought photo replies via SocialContext.addThought) has never had a
-- size or MIME restriction: storage.buckets.file_size_limit and
-- allowed_mime_types were both null, so the upload policy in
-- security-hardening.sql section 8 (folder ownership) was the only check
-- at all. Anything uploadable by a browser <input type="file"> could be
-- pushed to storage under an authenticated user's own folder, at any
-- size, with no server-side limit.
--
-- 25 MB covers a full-resolution phone photo and a short casual video
-- clip (the two things this app's composer and MediaAttachPicker.tsx
-- both use, via accept="image/*,video/*") with headroom; there is no
-- client-side compression anywhere in this codebase, so the raw file is
-- exactly what gets uploaded.
update storage.buckets
set
  file_size_limit = 26214400, -- 25 MiB, in bytes
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
where id = 'post-media';
