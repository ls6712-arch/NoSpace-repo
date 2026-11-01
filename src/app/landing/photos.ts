import { hobbyPhoto, photoCredit } from "../data/hobbyPhotos";

/**
 * The landing page's pictures. Every one is already in the app: a Corner's
 * photo from data/hobbyPhotos.ts, or, where the app has no fitting photo, one of
 * its own flat illustrations (components/SubHobbyArt). Nothing new is added.
 */
export type PhotoKey =
  | "pottery"
  | "ceramics"
  | "reading"
  | "book-clubs"
  | "running"
  | "cooking"
  | "climbing"
  | "board-games"
  | "cycling"
  | "live-music"
  | "pier"
  | "museum";

export interface PhotoSpec {
  /** The Corner whose photo to use. Left out when the picture is an illustration. */
  photo?: string;
  /** The illustration: shown instead of a photo, or if the photo does not load. */
  art?: { hobby: string; sub: string };
}

export const PHOTOS: Record<PhotoKey, PhotoSpec> = {
  pottery: { photo: "pottery", art: { hobby: "workbench", sub: "pottery" } },
  ceramics: { photo: "ceramics", art: { hobby: "workbench", sub: "ceramics" } },
  reading: { photo: "reading", art: { hobby: "rabbithole", sub: "book-clubs" } },
  "book-clubs": { photo: "book-clubs", art: { hobby: "rabbithole", sub: "book-clubs" } },
  running: { photo: "running", art: { hobby: "inmotion", sub: "running" } },
  cooking: { photo: "cooking", art: { hobby: "kitchentable", sub: "cooking" } },
  climbing: { photo: "climbing", art: { hobby: "inmotion", sub: "climbing" } },
  "board-games": { photo: "board-games", art: { hobby: "rabbithole", sub: "board-games" } },
  cycling: { photo: "cycling", art: { hobby: "inmotion", sub: "cycling" } },
  "live-music": { photo: "live-music", art: { hobby: "thestudio", sub: "instrument" } },
  // No fitting photo in the app for these two, so they are illustrations.
  pier: { art: { hobby: "rooted", sub: "outdoor-photography" } },
  museum: { art: { hobby: "thestudio", sub: "drawing" } },
};

/** srcset for a photo at the given widths, from the app's own URL builder. */
export function photoSrcSet(corner: string, widths: number[]): string {
  return widths
    .map((w) => ({ w, url: hobbyPhoto(corner, undefined, w) }))
    .filter((x): x is { w: number; url: string } => !!x.url)
    .map((x) => `${x.url} ${x.w}w`)
    .join(", ");
}

export function photoSrc(corner: string, width: number): string | undefined {
  return hobbyPhoto(corner, undefined, width);
}

/** Photographers on record for the photos the page uses, once each. */
export function usedCredits(keys: PhotoKey[]): { credit: string; source: string }[] {
  const seen = new Map<string, { credit: string; source: string }>();
  for (const key of keys) {
    const corner = PHOTOS[key].photo;
    const c = corner ? photoCredit(corner) : undefined;
    if (c && !seen.has(c.source)) seen.set(c.source, { credit: c.credit, source: c.source });
  }
  return [...seen.values()];
}
