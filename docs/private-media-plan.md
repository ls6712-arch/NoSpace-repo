# Private media bucket — plan (not implemented)

Written per request, alongside the pause/deletion RLS work. Nothing in this
document has been applied — no bucket created, no code changed.

## Object name predictability (asked directly)

Path shape, from `storage.objects`:
- Post photos: `<uploader-uuid>/<ms-timestamp>-<6-char-random>.<ext>`
- Avatars: `<uploader-uuid>/avatars/<ms-timestamp>.<ext>`

The UUID prefix and the timestamp+random suffix are not practically
guessable one at a time. **But** the `post-media` bucket's SELECT policy on
`storage.objects` (`"post-media files are publicly readable"`, `roles:
{public}`, `qual: bucket_id = 'post-media'`) is unconditional — it doesn't
scope to `(storage.foldername(name))[1] = auth.uid()`, the way the
write policies do. That means the storage **list** API (distinct from
fetching a known public URL) can enumerate every object in the entire
bucket, for anyone, signed in or not — not just their own folder. So the
practical unguessability of the naming scheme doesn't actually protect
anything: the full path listing is directly queryable. This is true
today, independent of anything pause-related, and worth fixing regardless
of whether the private-media bucket below happens.

## A prerequisite this plan surfaces: private media isn't uploaded at all today

Before designing the new bucket, I traced where "Only you" media actually
goes, since the ask names two things ("Only-you Moments and Reflection
images") that turn out to be **the same code path**, not two:

- `Log.tsx`'s `publish()` is the single submit handler for the composer.
  It checks `if (audience === "private") { await saveAsPrivateLog(); return; }`
  — this fires whether the person picked the "Only you" audience option on
  an ordinary Moment, or used the dedicated "Reflect privately" mode (which
  just forces `audience` to `"private"` first). Every other audience
  (`friends`, `circle`, `public`) instead calls `addPost()`, which goes
  through `ContentContext.tsx`'s real upload path into the `post-media`
  bucket and a real `posts` row.
- `saveAsPrivateLog()` never uploads anything. It reads `filePreviewUrls[0]`
  — which is built with `URL.createObjectURL(file)` (`Log.tsx:376`) — and
  writes that **blob: URL string directly into `private_logs.media_url`**.
  A blob URL is only valid inside the browser tab that created it; it's
  already dead the moment that tab closes, on every device, forever. There
  is currently no code path that uploads a private reflection's photo
  anywhere.

Practically: there are no real images to migrate for this path today —
whatever's in `private_logs.media_url` right now is already an unusable
dead reference for any row more than one page-load old. **Fixing this
upload gap is a prerequisite for the private bucket to matter for
Reflections/Only-you Moments at all** — right now there's nothing for a
new bucket to protect, because nothing real is being written. This is a
separate, pre-existing bug I'm flagging, not something to silently fold
into the bucket work without your say-so.

One consequence worth naming: because "Only you" never creates a `posts`
row, migration (c)'s new `'private'` value on `posts.visibility` has no
current writer either — nothing today can ever produce a `posts` row with
`visibility = 'private'` through normal use. That migration is still
correct to have (it's what a future rewrite of the composer would need),
just worth knowing it's currently inert.

## Proposed bucket

- `private-media`, `public = false`. No `getPublicUrl()` support — Supabase
  only serves that unsigned/permanent endpoint for public buckets.
- Storage RLS on `storage.objects`, scoped to this bucket:
  - INSERT: `bucket_id = 'private-media' and (storage.foldername(name))[1] = (select auth.uid())::text`
  - SELECT: same predicate — **owner only**, no public/anon branch at all
    (unlike `post-media`'s current unconditional SELECT policy)
  - UPDATE/DELETE: same predicate
- Reads happen via `supabase.storage.from('private-media').createSignedUrl(path, expirySeconds)`,
  called by the owner's own session only, since nobody else is ever meant
  to see this content — no signed-URL-sharing surface needed at all, which
  simplifies this considerably compared to a bucket meant to be shared.

## What changes in each file

- **`Log.tsx` / `saveAsPrivateLog()`**: needs an actual upload step before
  calling `addPrivateLog()` — upload the file to `private-media` under
  `${user.id}/...`, then pass the **storage path** (not a public URL, since
  none exists) to `createPrivateLog`. This is new code, not a bucket swap,
  since no upload exists here today.
- **`privateLogsRemote.ts` / `PrivateLogsContext.tsx`**: `PrivateLog.media`
  currently expects a ready-to-render URL. Once storage is private, the
  stored value needs to become a **path**, resolved to a signed URL at
  render time (wherever a private log's photo is displayed — `You.tsx`,
  `Pursuit.tsx`'s reflection view). That's a small but real shape change:
  the type changes from "a URL" to "a path plus an async resolution step."
- **`ContentContext.tsx`**: its upload loop (`refetchRealPosts`'s sibling,
  the real post-creation path) would need to branch at upload time —
  `visibility === 'private' ? 'private-media' : 'post-media'` — for the day
  the composer's "Only you" audience actually creates a `posts` row instead
  of routing to `saveAsPrivateLog()`. Today that branch is unreachable (see
  above), so this is forward-looking, not an active bug fix.
- **`SocialContext.tsx`**: its media upload (thought/comment attachments on
  `thoughts`) always goes through the post it's attached to, and a thought
  inherits `thoughts_private`/the post's own visibility rather than having
  independent audience of its own — no branching needed here unless a
  comment on a private post should also use the private bucket, which I'd
  treat as a follow-on decision, not implied by this plan.
- **`AvatarPicker.tsx`**: **no change.** An avatar is shown wherever a
  profile is visible at all — it's not tied to a specific Moment's
  audience, so it stays in `post-media` (public). Flagging this explicitly
  since the ask named this file, and the honest answer is "nothing here."

## Deletion, across both buckets

`private_logs` and `posts` already cascade-delete from `auth.users` (both
have `on delete cascade` on `user_id`), so a hard account deletion removes
the *rows* automatically. It does **not** remove the *storage objects* —
Postgres row deletion has no way to reach into Supabase Storage. Whatever
handles deletion (the brief's section 4.7 talks about a server-side Edge
Function doing this) needs to explicitly list and delete objects under
`<user_id>/` in **both** `post-media` and `private-media` before or after
the row deletes — two `storage.objects` cleanups, not one, once this bucket
exists.

## Migrating existing objects

Nothing to migrate for the private-log path (see above — nothing real was
ever written there). For actual `post-media` objects that are visible today
under a `visibility` that should have been private (there are none right
now — all 26 posts are `public`), the move would be: copy the object to
`private-media` at the same relative path, update the referencing row's
media column from a public URL to a bare path, delete the original from
`post-media`. Not needed today given the current data, but that's the
mechanical shape if it ever is.
