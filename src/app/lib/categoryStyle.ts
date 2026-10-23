import type { CSSProperties } from "react";
import {
  BookOpen, Camera, Cpu, Drama, Gem, Hammer, Landmark, Lightbulb, Moon, Mountain, Music, Palette, Puzzle,
  Scissors, Sprout, Trophy, UtensilsCrossed, Footprints, type LucideIcon,
} from "lucide-react";
import { categoryOfCorner } from "../data/cornerCategories";

/**
 * How a category looks (spec v1): one vivid colour and one line icon each. A
 * Corner takes its category's colour. The eight colours are theme.css's
 * --cat-* tokens, the same in both themes; text on them is always --ink.
 */
export type CatColor = "rose" | "orange" | "violet" | "blue" | "amber" | "lime" | "teal" | "pink";

/** The approved map. No two neighbours in a 4-column grid share a colour. */
const COLOR_BY_CATEGORY: Record<string, CatColor> = {
  "yarn-fabric": "rose",
  "crafts-diy": "orange",
  "art-design": "violet",
  "tech-tinkering": "blue",
  "food-drink": "amber",
  "running-fitness": "lime",
  "sports-martial-arts": "teal",
  "dance-stage": "pink",
  "outdoors-adventure": "teal",
  "home-garden": "rose",
  "games-puzzles": "blue",
  "music-sound": "violet",
  "photo-film": "orange",
  "reading-writing": "violet",
  "skills-side-projects": "lime",
  "collecting-style": "pink",
  "culture-community": "blue",
  "rest-ritual": "teal",
};

const ALL: CatColor[] = ["rose", "orange", "violet", "blue", "amber", "lime", "teal", "pink"];

export function categoryColor(slug: string): CatColor {
  return COLOR_BY_CATEGORY[slug] ?? ALL[0];
}

/** Sets --cat on an element: use `bg-[var(--cat)] text-[var(--ink)]`. */
export function catStyle(color: CatColor): CSSProperties {
  return { "--cat": `var(--cat-${color})` } as CSSProperties;
}

export function categoryStyle(slug: string): CSSProperties {
  return catStyle(categoryColor(slug));
}

/** A Corner's colour: its category's, or (a Corner not mapped yet) one dealt from its old Space slug. */
export function cornerColor(spaceSlug: string, cornerSlug: string): CatColor {
  const cat = categoryOfCorner(spaceSlug, cornerSlug);
  if (cat) return categoryColor(cat.slug);
  let n = 0;
  for (let i = 0; i < spaceSlug.length; i++) n = (n * 31 + spaceSlug.charCodeAt(i)) >>> 0;
  return ALL[n % ALL.length];
}

export function cornerStyle(spaceSlug: string, cornerSlug: string): CSSProperties {
  return catStyle(cornerColor(spaceSlug, cornerSlug));
}

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  "yarn-fabric": Scissors,
  "crafts-diy": Hammer,
  "art-design": Palette,
  "tech-tinkering": Cpu,
  "food-drink": UtensilsCrossed,
  "running-fitness": Footprints,
  "sports-martial-arts": Trophy,
  "dance-stage": Drama,
  "outdoors-adventure": Mountain,
  "home-garden": Sprout,
  "games-puzzles": Puzzle,
  "music-sound": Music,
  "photo-film": Camera,
  "reading-writing": BookOpen,
  "skills-side-projects": Lightbulb,
  "collecting-style": Gem,
  "culture-community": Landmark,
  "rest-ritual": Moon,
};

/** The page name used for a category's tile and header, so one grows into the other. */
export const categoryTransitionName = (slug: string) => `cat-${slug}`;
