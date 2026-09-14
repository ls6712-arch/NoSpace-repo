/**
 * seed-moments.js
 *
 * One-time script to seed No Space with founder-curated Moments from a
 * local photo folder (exported from Google Takeout).
 *
 * RUN THIS LOCALLY ON YOUR MAC — via Claude Code, not in any cloud sandbox.
 * It needs network access to your Supabase project, which the cloud
 * sandbox this was written in explicitly cannot reach.
 *
 * ---------------------------------------------------------------------
 * SETUP (do this once)
 * ---------------------------------------------------------------------
 * 1. In your NoSpace-repo folder, run:
 *      npm install @supabase/supabase-js heic-convert dotenv
 *
 * 2. Create a file called `.env.seed` in the repo root (DO NOT COMMIT IT —
 *    it's already in .gitignore) containing:
 *
 *      SUPABASE_URL=https://xxxx.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY=eyJ...           <- service_role key, NOT anon key
 *      SUPABASE_STORAGE_BUCKET=post-media          <- confirmed bucket name, see ContentContext.tsx
 *      SEED_USER_ID=00000000-0000-0000-0000-000000000000   <- your founder user_id
 *
 * 3. Table/columns below target the live `posts` table (confirmed against
 *    src/app/context/ContentContext.tsx and sql/corners.sql as of this
 *    writing — this replaces an earlier draft written against a stale
 *    `moments` table). If the schema has moved on again since, fix the
 *    COLUMN MAP section below rather than forcing this version through.
 *
 * 4. Put your converted/renamed photos in ./seed-photos/ next to this script,
 *    OR point PHOTO_DIR below at your unzipped Takeout folder directly —
 *    the script handles HEIC conversion automatically.
 *
 * 5. Run:  node seed-moments.js
 *    It's idempotent-ish: it logs each insert, so if it fails partway you
 *    can comment out already-completed entries in METADATA and re-run.
 * ---------------------------------------------------------------------
 */

require('dotenv').config({ path: '.env.seed' });
const fs = require('fs');
const path = require('path');
const convert = require('heic-convert');
const { createClient } = require('@supabase/supabase-js');

// ---- CONFIG ----------------------------------------------------------
const PHOTO_DIR = './seed-photos'; // folder containing your HEIC/JPG files
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;
const SEED_USER_ID = process.env.SEED_USER_ID;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BUCKET || !SEED_USER_ID) {
  console.error('Missing required env vars. Check .env.seed');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---- COLUMN MAP — matches the live `posts` table ----------------------
// Change the VALUES (right side) if your actual column names differ.
const COLS = {
  userId: 'user_id',
  space: 'hobby_slug',
  corner: 'sub_hobby',
  type: 'type',
  caption: 'caption',
  mediaUrl: 'media_url',
  mediaUrls: 'media_urls',
  visibility: 'visibility',
  createdAt: 'created_at',
};
const TABLE_NAME = 'posts'; // change if your table is named differently
const POST_TYPE = 'photo'; // matches the "photo" | "video" values used app-wide
const VISIBILITY = 'public'; // matches Visibility = "public" | "circle" | "friends"

// ---- METADATA — classification + captions from review batch -----------
// filename -> { space, corner, caption }
// `corner` values are current sub_hobby slugs (src/app/data/hobbies.ts):
// "exploration" under travel-adventure, "food-photography" and "cooking"
// under food-cooking, "outdoor-photography" under nature-outdoors.
const METADATA = {
  'IMG_2832': { space: 'travel-adventure', corner: 'exploration',        caption: "Skyline on fire, 7pm. This city doesn't do quiet sunsets." },
  'IMG_2868': { space: 'food-cooking',     corner: 'food-photography',   caption: "Panini that earned its char marks. Simple done right." },
  'IMG_2886': { space: 'travel-adventure', corner: 'exploration',        caption: "Manhattan from the water — the only way to actually see it whole." },
  'IMG_2935': { space: 'travel-adventure', corner: 'exploration',        caption: "Brooklyn Bridge at dusk. Still stops me every time." },
  'IMG_2944': { space: 'travel-adventure', corner: 'exploration',        caption: "One sailboat, one bridge, one very lucky angle." },
  'IMG_2946': { space: 'travel-adventure', corner: 'exploration',        caption: "Lady Liberty at golden hour, from the cheap seats on a ferry." },
  'IMG_3029': { space: 'food-cooking',     corner: 'food-photography',   caption: "NY bagel, correctly weaponized with capers and dill." },
  'IMG_3054': { space: 'travel-adventure', corner: 'exploration',        caption: "Walked past this a hundred times. Finally stopped to look." },
  // IMG_2969 (Times Square) omitted by default — crop for identifiable faces
  // before re-adding. See flag in chat.
  'IMG_3063': { space: 'food-cooking',     corner: 'food-photography',   caption: "Sesame chicken bowl that disappeared faster than I photographed it." },
  'IMG_3070': { space: 'food-cooking',     corner: 'cooking',            caption: "Sunday spread: curry, roti, pulao, no leftovers survived." },
  'IMG_3104': { space: 'nature-outdoors',  corner: 'outdoor-photography', caption: "Reservoir loop, golden light, zero people yet." },
  'IMG_3109': { space: 'nature-outdoors',  corner: 'outdoor-photography', caption: "The fountain earns its spot on the postcard." },
  'IMG_3127': { space: 'nature-outdoors',  corner: 'outdoor-photography', caption: "Central Park doing its one job perfectly." },
  'IMG_3135': { space: 'travel-adventure', corner: 'exploration',        caption: "Empire State, blue hour, rainbow spire." },
  'IMG_3140': { space: 'travel-adventure', corner: 'exploration',        caption: "Full moon crashing the skyline's photo op." },
  'IMG_3147': { space: 'travel-adventure', corner: 'exploration',        caption: "Fireworks over the Hudson. Worth the crowd." },
  'IMG_3154': { space: 'travel-adventure', corner: 'exploration',        caption: "Second round of fireworks, because once wasn't enough." },
};

// ---- HELPERS -----------------------------------------------------------

async function toJpegBuffer(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const inputBuffer = fs.readFileSync(filePath);
  if (ext === '.heic') {
    const outputBuffer = await convert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.9,
    });
    return Buffer.from(outputBuffer);
  }
  return inputBuffer; // already jpg/png
}

async function uploadAndInsert(baseName, meta) {
  // find the actual file (handles .HEIC / .heic / .jpg variants)
  const candidates = fs.readdirSync(PHOTO_DIR)
    .filter(f => path.parse(f).name === baseName);
  if (candidates.length === 0) {
    console.warn(`SKIP: no file found for ${baseName}`);
    return;
  }
  const filePath = path.join(PHOTO_DIR, candidates[0]);

  console.log(`Processing ${baseName} -> ${meta.space}/${meta.corner}`);

  const jpegBuffer = await toJpegBuffer(filePath);
  const storagePath = `seed/${meta.space}/${baseName}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error(`  UPLOAD FAILED for ${baseName}:`, uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);
  const imageUrl = publicUrlData.publicUrl;

  const row = {
    [COLS.userId]: SEED_USER_ID,
    [COLS.space]: meta.space,
    [COLS.corner]: meta.corner,
    [COLS.type]: POST_TYPE,
    [COLS.caption]: meta.caption,
    [COLS.mediaUrl]: imageUrl,
    [COLS.mediaUrls]: [imageUrl],
    [COLS.visibility]: VISIBILITY,
    [COLS.createdAt]: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from(TABLE_NAME).insert(row);

  if (insertError) {
    console.error(`  INSERT FAILED for ${baseName}:`, insertError.message);
    return;
  }

  console.log(`  OK: ${baseName} uploaded and inserted.`);
}

async function main() {
  const entries = Object.entries(METADATA);
  console.log(`Seeding ${entries.length} Moments...\n`);
  for (const [baseName, meta] of entries) {
    await uploadAndInsert(baseName, meta);
  }
  console.log('\nDone. Spot-check the live feed before sharing with anyone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
