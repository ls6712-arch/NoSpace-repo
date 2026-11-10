import { canonicalCorner } from "../data/hobbies";
import { cornerPhoto, cornerPhotoAlt } from "./cornerPhoto";

/**
 * The picture of a Corner on a card. A Corner whose 3D world is switched on has a still of it, made by
 * `node scripts/e2e/room-preview.ts --cards` (public/worlds/{slug}/card.webp: square, 800 by 800, golden hour).
 * Every other Corner keeps the photo it has always had (cornerPhoto).
 *
 * This is the one place that knows which Corners have a still. The list is written out here, not read from the
 * world configs, so that a page showing a card downloads no part of a 3D world. cornerPicture.test.ts keeps it
 * equal to the Corners that have a world (src/app/world/corners) and checks that each file is there.
 */
const STILLS: Readonly<Record<string, string>> = {
  "crafts-making/pottery": "pottery",
  "home-garden/gardening": "gardening",
  "books-writing/reading": "reading",
  "gaming-tabletop/board-games": "board-games",
};

/** Corner keys ("space-slug/corner-slug") that have a still, in the order they were given a 3D world. */
export const CORNER_STILL_KEYS: readonly string[] = Object.keys(STILLS);

function stillSlug(spaceSlug: string, slug: string): string | undefined {
  const c = canonicalCorner(spaceSlug, slug);
  return STILLS[`${c.spaceSlug}/${c.slug}`];
}

/** Whether this Corner has a 3D world switched on, with a still of it. A Corner merged into another uses the kept Corner's. */
export function cornerHasStill(spaceSlug: string, slug: string): boolean {
  return stillSlug(spaceSlug, slug) !== undefined;
}

/** The still of a Corner's 3D world when it has one, else exactly the photo the Corner has today. `width` only matters for a photo. */
export function cornerPicture(spaceSlug: string, slug: string, width = 600): string | undefined {
  const still = stillSlug(spaceSlug, slug);
  return still ? `${import.meta.env.BASE_URL}worlds/${still}/card.webp` : cornerPhoto(spaceSlug, slug, width);
}

/** Alt text for cornerPicture: the Corner's name for a still, else what the photo's alt text is today. */
export function cornerPictureAlt(spaceSlug: string, slug: string, name: string): string {
  return cornerHasStill(spaceSlug, slug) ? name : cornerPhotoAlt(slug);
}
