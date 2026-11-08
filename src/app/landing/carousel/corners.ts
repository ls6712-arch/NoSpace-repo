import { CREDITS, hobbyPhoto } from "../../data/hobbyPhotos";
import { cornerName } from "../../lib/discoverCorners";
import { cornerPath } from "../../lib/cornerPath";

/**
 * The Corners in the landing carousel. Picked for people doing things together,
 * each with its own credited photo, and ordered so two Corners from the same
 * group never sit side by side (the row loops, so the last one meets the first).
 */
export const CAROUSEL_CORNERS: readonly (readonly [spaceSlug: string, slug: string])[] = [
  ["music", "karaoke"],
  ["nature-outdoors", "surfing"],
  ["food-cooking", "pasta"],
  ["music", "live-music"],
  ["health-wellness", "sauna-cold-plunge"],
  ["gaming-tabletop", "mahjong"],
  ["art-creative", "life-drawing"],
  ["sports-fitness", "skating"],
  ["photography-film", "film-clubs"],
  ["nature-outdoors", "stargazing"],
  ["food-cooking", "bbq"],
  ["music", "music-production"],
];

export interface CarouselCorner {
  slug: string;
  name: string;
  to: string;
  src: string;
  alt: string;
  credit: string;
  source: string;
}

export function carouselCorners(): CarouselCorner[] {
  return CAROUSEL_CORNERS.flatMap(([spaceSlug, slug]) => {
    const src = hobbyPhoto(slug, undefined, 1200);
    const credit = CREDITS[slug];
    if (!src || !credit) return [];
    return [{ slug, name: cornerName(slug), to: cornerPath(spaceSlug, slug), src, alt: credit.alt, credit: credit.credit, source: credit.source }];
  });
}
