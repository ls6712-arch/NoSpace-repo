/**
 * One-time backfill for Step 1 (private Moment photos).
 *
 * Every existing photo Moment currently points at a public URL in the
 * `post-media` bucket. This copies each one's real objects into the new
 * private `moment-media` bucket at the same path, then repoints the post
 * at `media_paths` and clears the legacy `media_url`/`media_urls` columns
 * — the same shape the app itself now writes for a freshly-created Moment
 * (see src/app/context/ContentContext.tsx's addPost). A source file that's
 * .heic/.heif (uploaded before the app ran every pick through
 * convertHeicIfNeeded — Chrome, Firefox and Android can't display those at
 * all) is decoded and re-encoded as a .jpg instead of copied byte-for-byte;
 * media_paths gets the .jpg path.
 *
 * Run locally with the project's service role key — this key can bypass
 * every RLS policy in the project, so it must never reach the browser or
 * be committed anywhere. Never imported by any app code; this is a
 * throwaway CLI script, not part of the build.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-moment-media.ts --dry-run
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-moment-media.ts
 *
 * (Or put those two vars in a local .env file — dotenv loads it below.)
 *
 * Idempotent: fetches every post and lets planLegacyMedia() decide what's
 * left to do from media_url/media_urls (empty once a post's already been
 * migrated), so re-running after a partial failure just retries what
 * didn't finish — including re-deriving a JPEG that was only half-uploaded
 * (upsert: true on that path; see below). The old post-media objects are
 * left in place — this only copies/converts, it never deletes — so
 * there's nothing to undo if something looks wrong after a real run;
 * deleting the originals is a deliberate follow-up once the app side has
 * been verified live (see the Step 1 PR's own deploy notes).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import convert from "heic-convert";
import { planLegacyMedia } from "./backfillMomentMediaLogic";

/** heic-convert's quality is 0..1, not 0..100 — 0.85 is the ~85 asked for.
 * libheif (what both heic-convert and the app's own browser-side heic2any
 * decode through) applies HEIF's own rotation property while decoding, so
 * the pixels handed to the JPEG encoder are already right-side up —
 * nothing extra to do here for orientation. */
const HEIC_JPEG_QUALITY = 0.85;

const SOURCE_BUCKET = "post-media";
const DEST_BUCKET = "moment-media";
const PAGE_SIZE = 1000;

const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

interface LegacyPostRow {
  id: number | string;
  media_url: string | null;
  media_urls: string[] | null;
}

async function fetchLegacyPosts(): Promise<LegacyPostRow[]> {
  const rows: LegacyPostRow[] = [];
  let from = 0;
  for (;;) {
    // No media_paths filter here: the live column is `text[] not null
    // default '{}'`, so an unmigrated row reads as an empty array, never
    // null — filtering on `.is("media_paths", null)` would match nothing,
    // ever. Idempotency is handled below instead: legacyMediaPaths()
    // already returns null for a row with no media_url/media_urls left to
    // migrate, which is exactly the state a row this script already
    // processed ends up in.
    const { data, error } = await supabase
      .from("posts")
      .select("id, media_url, media_urls")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load posts: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as LegacyPostRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  const rows = await fetchLegacyPosts();
  console.log(`Found ${rows.length} post(s) total.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const plan = planLegacyMedia(row, SOURCE_BUCKET);
    if (!plan) {
      skipped++;
      continue;
    }

    const heicCount = plan.filter((p) => p.needsConversion).length;
    console.log(
      `post ${row.id}: ${plan.length} photo(s) -> ${DEST_BUCKET}` +
        (heicCount > 0 ? ` (${heicCount} HEIC conversion${heicCount > 1 ? "s" : ""})` : ""),
    );
    if (dryRun) {
      for (const entry of plan) {
        console.log(
          entry.needsConversion
            ? `  would convert ${entry.sourcePath} -> ${entry.destPath}`
            : `  would copy ${entry.sourcePath}`,
        );
      }
      continue;
    }

    let entryFailed = false;
    for (const entry of plan) {
      if (entry.needsConversion) {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(SOURCE_BUCKET)
          .download(entry.sourcePath);
        if (downloadError || !blob) {
          console.error(`  failed to download ${entry.sourcePath}: ${downloadError?.message ?? "no data"}`);
          entryFailed = true;
          break;
        }
        let jpegBuffer: Buffer;
        try {
          const inputBuffer = Buffer.from(await blob.arrayBuffer());
          jpegBuffer = Buffer.from(
            await convert({ buffer: inputBuffer, format: "JPEG", quality: HEIC_JPEG_QUALITY }),
          );
        } catch (convertError) {
          console.error(`  failed to convert ${entry.sourcePath}: ${(convertError as Error).message}`);
          entryFailed = true;
          break;
        }
        // upsert: a previous run may have already uploaded this JPEG before
        // failing on a later file in the same post — overwriting it with
        // the same re-derived bytes is harmless, unlike the raw copy()
        // below where an "already exists" error is the tolerable case.
        const { error: uploadError } = await supabase.storage
          .from(DEST_BUCKET)
          .upload(entry.destPath, jpegBuffer, { contentType: "image/jpeg", upsert: true });
        if (uploadError) {
          console.error(`  failed to upload converted ${entry.destPath}: ${uploadError.message}`);
          entryFailed = true;
          break;
        }
      } else {
        const { error: copyError } = await supabase.storage
          .from(SOURCE_BUCKET)
          .copy(entry.sourcePath, entry.destPath, { destinationBucket: DEST_BUCKET });
        // A previous run may have already copied this one before failing on
        // a later file in the same post — that's fine, keep going.
        if (copyError && !/exists/i.test(copyError.message)) {
          console.error(`  failed to copy ${entry.sourcePath}: ${copyError.message}`);
          entryFailed = true;
          break;
        }
      }
    }
    if (entryFailed) {
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({ media_paths: plan.map((p) => p.destPath), media_url: "", media_urls: null })
      .eq("id", row.id);
    if (updateError) {
      console.error(`  failed to update post ${row.id}: ${updateError.message}`);
      failed++;
      continue;
    }
    migrated++;
  }

  console.log("");
  if (dryRun) {
    console.log(`Dry run complete. ${rows.length} post(s) inspected, ${skipped} would be left untouched.`);
  } else {
    console.log(`Done. ${migrated} migrated, ${skipped} left untouched, ${failed} failed.`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
