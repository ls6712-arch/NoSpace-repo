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
  | "jazz-set"
  | "jazz-bar"
  | "pier"
  | "museum-stub"
  | "museum";

export interface PhotoSpec {
  /** The Corner whose photo to use. Left out when the picture is an illustration or a file of our own. */
  photo?: string;
  /** A photo file in public/landing/photos/, as `<name>-<width>.webp` at each width the page asks for. */
  local?: string;
  /** Photographer and Unsplash page, for the footer credits (Corner photos carry theirs in hobbyPhotos.ts). */
  credit?: { credit: string; source: string };
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
  // Photos supplied for the activities the app has no Corner photo for. The illustration is the fallback.
  "jazz-set": {
    local: "ticket-jazz-set",
    credit: { credit: "Alex Zamora", source: "https://unsplash.com/photos/FU1KddSIIR4" },
    art: { hobby: "thestudio", sub: "instrument" },
  },
  "jazz-bar": {
    local: "ticket-jazz-bar",
    credit: { credit: "Peter Okwara", source: "https://unsplash.com/photos/jN1C1V2W2fw" },
    art: { hobby: "thestudio", sub: "instrument" },
  },
  pier: {
    local: "shelf-pier",
    credit: { credit: "Richard Fox", source: "https://unsplash.com/photos/Uujb21HwpBw" },
    art: { hobby: "rooted", sub: "outdoor-photography" },
  },
  "museum-stub": {
    local: "shelf-museum",
    credit: { credit: "Jessica Pamp", source: "https://unsplash.com/photos/JNTSoyb_bbw" },
    art: { hobby: "thestudio", sub: "drawing" },
  },
  museum: {
    local: "ticket-museum",
    credit: { credit: "Zalfa Imani", source: "https://unsplash.com/photos/1xp5VxvyKL0" },
    art: { hobby: "thestudio", sub: "drawing" },
  },
};

const localUrl = (name: string, width: number) => `${import.meta.env.BASE_URL}landing/photos/${name}-${width}.webp`;

/** srcset for one of our own photo files at the given widths. */
export function localSrcSet(name: string, widths: number[]): string {
  return widths.map((w) => `${localUrl(name, w)} ${w}w`).join(", ");
}

export function localSrc(name: string, width: number): string {
  return localUrl(name, width);
}

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
    const spec = PHOTOS[key];
    const c = spec.credit ?? (spec.photo ? photoCredit(spec.photo) : undefined);
    if (c && !seen.has(c.source)) seen.set(c.source, { credit: c.credit, source: c.source });
  }
  return [...seen.values()];
}
