import { hobbies } from "../data/hobbies";
import { hobbyPhoto, photoCredit } from "../data/hobbyPhotos";

/**
 * A real photo for any built-in Corner: its own from hobbyPhotos.ts, else its
 * parent Space's cover photo (hobbyPhoto already does that), else the Space's
 * own cover image from hobbies.ts. A card never has a hole.
 */
export function cornerPhoto(spaceSlug: string, cornerSlug: string, width = 600): string | undefined {
  return hobbyPhoto(cornerSlug, spaceSlug, width) ?? hobbies.find((h) => h.slug === spaceSlug)?.coverImage;
}

/** Alt text for a Corner's photo: what it shows when one is on record, else empty (the name is beside it). */
export function cornerPhotoAlt(cornerSlug: string): string {
  return photoCredit(cornerSlug)?.alt ?? "";
}

/** Who took a Corner's own photo and where it lives, when on record. */
export function cornerPhotoCredit(cornerSlug: string): { credit: string; source: string } | undefined {
  const c = photoCredit(cornerSlug);
  return c && { credit: c.credit, source: c.source };
}
