import { Coffee, Compass, Feather, Hand, Mountain, Package, Sparkles, Sprout, type LucideIcon } from "lucide-react";

/**
 * The icons a badge can name (`Badge.icon` in data/badges.ts), imported one by
 * one. Looking a name up on `import * as Icons from "lucide-react"` pulled every
 * one of lucide's ~1,500 icons into the single app bundle; this keeps only these.
 * Add a badge with a new icon here too (badgeIcon.test.ts fails until you do).
 */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Coffee,
  Compass,
  Feather,
  Hand,
  Mountain,
  Package,
  Sprout,
};

export function badgeIcon(name: string): LucideIcon {
  return BADGE_ICONS[name] ?? Sparkles;
}
