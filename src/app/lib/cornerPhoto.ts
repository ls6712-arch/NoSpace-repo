import { hobbies } from "../data/hobbies";
import { hobbyPhoto } from "../data/hobbyPhotos";

/**
 * A real photo for any built-in Corner: its own from hobbyPhotos.ts, else its
 * parent Space's cover photo (hobbyPhoto already does that), else the Space's
 * own cover image from hobbies.ts. A card never has a hole.
 */
export function cornerPhoto(spaceSlug: string, cornerSlug: string, width = 600): string | undefined {
  return hobbyPhoto(cornerSlug, spaceSlug, width) ?? hobbies.find((h) => h.slug === spaceSlug)?.coverImage;
}
