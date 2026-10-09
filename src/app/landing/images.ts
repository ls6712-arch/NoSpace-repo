import { landingImages } from "virtual:landing-images";

/**
 * The real screens in public/landing/ (see its README). A section whose file
 * is missing is hidden: the page never shows a stand-in.
 */
export const LANDING_FILES = {
  hero: "hero-shelf.webp",
  save: "step-save.webp",
  try: "step-try.webp",
  share: "step-share.webp",
  comeAlong: "come-along.webp",
  privacy: "privacy-picker.webp",
} as const;

export type LandingImageKey = keyof typeof LANDING_FILES;

const present = new Set(landingImages);

export function hasLandingImage(key: LandingImageKey): boolean {
  return present.has(LANDING_FILES[key]);
}

export function landingImageUrl(key: LandingImageKey): string {
  return `${import.meta.env.BASE_URL}landing/${LANDING_FILES[key]}`;
}

/** Screen size of the exports: an iPhone screen at 2x. */
export const SCREEN_W = 1170;
export const SCREEN_H = 2532;
