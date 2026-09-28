# Step 1 verification: mocked-network browser pass

Same approach as every prior phase's own pass (Phase 2/3/4, the Sep 27 fix
round): a real Chromium browser driven by Playwright against the real app
code, with every request to `*.supabase.co` intercepted and answered from a
small in-memory store — no app code was stubbed, only the network.

A well-formed session was seeded into `localStorage` (the
`sb-<project-ref>-auth-token` key supabase-js itself uses), so `AuthContext`
resolves to signed in with zero real auth network calls. Every REST/RPC
table the app's various context providers query on mount was given a
generic, empty-but-well-formed answer so nothing crashes; `posts` and
`private_logs` were backed by a real in-memory store that the app's own
inserts/reads/updates actually mutate. The `moment-media` bucket's
upload/sign endpoints were mocked, and — unlike a typical mock — the actual
signed-URL GET request was answered with a real 1×1 PNG's bytes, so an
`<img>` on screen is genuinely decoding bytes fetched from a URL shaped
exactly like the real signed-URL flow, not a stubbed `src`.

(The app uses `createHashRouter`, not `BrowserRouter` — every navigation
below is to a `/#/...` path, matching `routes.ts`'s own comment on why.)

## What was proved

**1. Existing photo Moments render via a resolved signed URL — single and
multi-photo alike.** Two posts were seeded with `media_paths` already set (no
`media_url`/`media_urls` — the exact shape either a fresh Step-1 upload or an
already-backfilled legacy post ends up in) and nothing else. Loading the
Shelf (`/#/you`) fetches `posts` with the 3-tier column list, maps each row
through `rowToPost` (`mediaPaths: row.media_paths`), batch-signs every path
in the page with one `signMomentPaths()` call, and renders the resolved
`media`/`mediaUrls` — `00-shelf-existing-moments.png` shows both: a
single-photo Moment and a multi-photo one (its own "1/2" indicator, proving
`mediaUrls` carried all paths through in order, not just the first).

**2. Creating a private ("Only you") reflection with a photo — the exact
path the dead `blob:` URL bug lived in.** Through the real `/#/create` flow
(tap "Photo or video" → pick a file → caption → choose "Only you" → "Keep it
private"), `saveAsPrivateLog()` called `uploadMomentFile()` against
`moment-media` (confirmed: the upload request hit
`.../object/moment-media/<user_id>/<uuid>.png`, never `post-media`), then
inserted into `private_logs` with `media_url` set to
`"<user_id>/<uuid>.png"` — a real storage path, not a `blob:` URL —
`01`–`03` walk through the picked photo, the "Only you" audience choice, and
the resulting "Saved." screen.

**3. The photo survives a full page reload — the actual bug, actually
fixed.** After saving, the page was fully reloaded (not a client-side
navigation) and Settings → Data (`/#/data`) was opened fresh.
`PrivateLogsContext` re-fetched the row (now just carrying that same raw
path), batch-resolved it via `signMomentPaths()`, and `DataSection.tsx`
rendered the actual photo — `04-data-section-after-reload.png`. Before this
fix, `media_url` held a `URL.createObjectURL(file)` blob reference that dies
with the tab that created it; a real reload is exactly the case that used to
break, and exactly the case this screenshot rules out.

## What this does *not* cover (needs a live check)

Everything here demonstrates the app's own read/write logic — upload → path
stored → signed URL rendered. It does **not** exercise the storage RLS
policy the migration this PR pairs with
(`supabase/migrations/20261007000000_step1_moment_media_private.sql`) is
supposed to define — the actual "if you can see the Moment, you can see its
photo, nothing else" enforcement. That migration doesn't exist in this
repo/branch (see the PR description) and must be supplied and applied
separately before any of this matters; a mocked network has no RLS to get
wrong or right.

**Live check needed, after the migration is applied and this PR is
deployed** (two real accounts, matching the brief's own test plan):

1. Post a photo Moment as **Only me**. Confirm the owner sees it; confirm a
   second account cannot load it (`fetchSharedMoment`-style "not available"
   behavior); confirm a copied signed URL stops working for a signed-out
   visitor once its TTL (`MOMENT_MEDIA_URL_TTL_SECONDS`, 1 hour) elapses.
2. Switch that Moment to **Followers**: an accepted follower sees it on next
   refresh; a non-follower doesn't. Switch to **Everyone**: a signed-out
   visitor can load it. Confirm each transition takes effect on the photo
   itself, not just the post row (the whole point of gating photos through
   the posts RLS rather than a separate check).
3. Multi-photo (up to 8), a HEIC photo from an iPhone, and a video — all
   through the real upload path, not the mocked one here.
4. Edit a Moment's photo (`MomentDetail.tsx`) — confirm the old object is
   still there or cleaned up per the app's own best-effort delete, and the
   new one resolves.
5. Delete a Moment with photos — confirm the objects are actually gone from
   `moment-media` (`deleteMomentFiles`), not just the row.
6. A private reflection with a photo, made and reopened on a **different
   device signed into the same account** (not just after a reload in the
   same browser) — confirms this isn't only fixed within one browser's
   storage.
7. After running `scripts/backfill-moment-media.ts` against a copy of the
   real data: every legacy moment still shows its photo, and its
   `media_url`/`media_urls` are actually cleared (`media_paths` populated).
   Run with `--dry-run` first, per the script's own usage comment.

## How to reproduce this pass

The script lived in the session's scratch directory (not committed — a
throwaway verification harness, not part of the app or its test suite) and
used `playwright` installed ad hoc with `npm install --no-save playwright`
against the pre-installed Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driving `npm run dev`
on `127.0.0.1:5173` (not `localhost` — this sandbox's `curl`/Playwright
couldn't resolve it) with every `*.supabase.co` request intercepted via
`page.route`.

One pitfall worth recording for next time: the very first attempt navigated
straight to plain paths (`/you`, `/create`, `/data`) and silently landed on
the signed-out-looking Home page every time, even with a perfectly valid
seeded session — the app uses `createHashRouter`, so the real path is
`/#/you` etc.; a bare `/you` just loads the SPA at its default hash route.
