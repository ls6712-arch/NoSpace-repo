import type { CSSProperties } from "react";
import {
  BookOpen, Camera, Cpu, Drama, Gem, Hammer, Landmark, Lightbulb, Moon, Mountain, Music, Palette, Puzzle,
  Scissors, Sprout, Trophy, UtensilsCrossed, Footprints, type LucideIcon,
} from "lucide-react";
import { categoryOfCorner, type CornerCategory } from "../data/cornerCategories";
import { fieldStyle, fieldStyleFor, type Field } from "./fieldColor";

/**
 * How a category looks: one hue and one simple line icon each. A Corner takes
 * its category's hue ("Corners inherit their category's colour"). Eight hues
 * across 18 categories, dealt in order so neighbours in the grid differ.
 */
const HUE_ORDER: Field[] = ["rose", "ochre", "plum", "sky", "terracotta", "denim", "forest", "olive"];

const CATEGORY_ORDER = [
  "yarn-fabric", "crafts-diy", "art-design", "tech-tinkering", "food-drink", "running-fitness",
  "sports-martial-arts", "dance-stage", "outdoors-adventure", "home-garden", "games-puzzles",
  "music-sound", "photo-film", "reading-writing", "skills-side-projects", "collecting-style",
  "culture-community", "rest-ritual",
];

export function categoryField(slug: string): Field {
  const i = CATEGORY_ORDER.indexOf(slug);
  return HUE_ORDER[(i < 0 ? 0 : i) % HUE_ORDER.length];
}

export function categoryStyle(slug: string): CSSProperties {
  return fieldStyleFor(categoryField(slug));
}

/** A Corner's colours: its category's, or its old Space's for a Corner not mapped yet. */
export function cornerStyle(spaceSlug: string, cornerSlug: string): CSSProperties {
  const cat = categoryOfCorner(spaceSlug, cornerSlug);
  return cat ? categoryStyle(cat.slug) : fieldStyle(spaceSlug);
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

/** Three examples for a tile: the first three things on the "what's in it" line. */
export function categoryExamples(c: CornerCategory): string {
  return c.about.split(", ").slice(0, 3).join(", ");
}

/** The page name used for a category's tile and header, so one grows into the other. */
export const categoryTransitionName = (slug: string) => `cat-${slug}`;
