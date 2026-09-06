import {
  UtensilsCrossed,
  Dumbbell,
  Palette,
  Hammer,
  BookOpen,
  Trees,
  Sprout,
  Dices,
  Music,
  Camera,
  HeartPulse,
  Shirt,
  Cpu,
  Star,
  Plane,
  type LucideIcon,
} from "lucide-react";

/**
 * One clear glyph per Space, for the Explore Spaces row on Discover. The
 * fifteen categories in data/categories.ts are signage, not a mood board —
 * these icons follow the same rule: instantly readable, not clever.
 */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  "food-cooking": UtensilsCrossed,
  "sports-fitness": Dumbbell,
  "art-creative": Palette,
  "crafts-making": Hammer,
  "books-writing": BookOpen,
  "nature-outdoors": Trees,
  "home-garden": Sprout,
  "gaming-tabletop": Dices,
  music: Music,
  "photography-film": Camera,
  "health-wellness": HeartPulse,
  "fashion-beauty": Shirt,
  "tech-building": Cpu,
  "collecting-fandom": Star,
  "travel-adventure": Plane,
};

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICON[slug] ?? Star;
}
