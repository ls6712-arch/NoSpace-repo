/**
 * Lists every browsable Corner whose photo is missing or broken.
 *
 * For each Corner in the 18 groups (homeCornersIn, so merged, hidden and
 * database-only Corners are left out) it requests the hobbyPhoto URL and
 * reports any response that is not 200, plus any Corner with no PHOTO entry.
 * Needs network access to images.unsplash.com. Exits 1 when it finds a problem.
 *
 * Usage: npx tsx scripts/check-corner-photos.ts
 */
import { CORNER_CATEGORIES } from "../src/app/data/cornerCategories";
import { homeCornersIn } from "../src/app/data/homeCorners";
import { hasHobbyPhoto, hobbyPhoto } from "../src/app/data/hobbyPhotos";

const BATCH = 8;

async function status(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    await res.body?.cancel();
    return String(res.status);
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

async function main() {
  const corners = CORNER_CATEGORIES.flatMap((cat) => homeCornersIn(cat.slug));
  const unique = [...new Map(corners.map((c) => [c.slug, c])).values()];
  const noPhoto = unique.filter((c) => !hasHobbyPhoto(c.slug));
  const withPhoto = unique.filter((c) => hasHobbyPhoto(c.slug));

  const broken: { slug: string; result: string; url: string }[] = [];
  for (let i = 0; i < withPhoto.length; i += BATCH) {
    await Promise.all(
      withPhoto.slice(i, i + BATCH).map(async (c) => {
        const url = hobbyPhoto(c.slug)!;
        const result = await status(url);
        if (result !== "200") broken.push({ slug: c.slug, result, url });
      }),
    );
  }

  console.log(`Checked ${withPhoto.length} photos for ${unique.length} browsable Corners.`);
  console.log(`\nNon-200 (${broken.length}):`);
  for (const b of broken.sort((a, z) => a.slug.localeCompare(z.slug))) console.log(`  ${b.slug}: ${b.result}  ${b.url}`);
  console.log(`\nNo PHOTO entry (${noPhoto.length}):`);
  for (const c of noPhoto) console.log(`  ${c.slug}`);

  if (broken.length || noPhoto.length) process.exitCode = 1;
}

main();
