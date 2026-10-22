import type { CSSProperties } from "react";

/**
 * Colour as identity (after-hours direction): every Space owns one colour and
 * its Corners inherit it. It is used sparingly, editorial style: a dot, a short
 * rule, an eyebrow in the colour. The eight hues are defined in theme.css:
 * --field-<name> (a mark, never text) and the --corner-<name> text variants
 * (>=5.6:1 on the page in both themes). Spaces share fields, never within a row of the same
 * kind, and a Space that isn't listed (admin-made) hashes onto one so it is
 * stable across renders.
 *
 * When Browse moves to the 18 categories (Step 4) only this table's keys change.
 */
export type Field = "terracotta" | "plum" | "forest" | "denim" | "ochre" | "olive" | "rose" | "sky";

const FIELD_BY_SPACE: Record<string, Field> = {
  "food-cooking": "terracotta",
  "sports-fitness": "denim",
  "art-creative": "plum",
  "crafts-making": "rose",
  "books-writing": "ochre",
  "nature-outdoors": "forest",
  "home-garden": "olive",
  "gaming-tabletop": "sky",
  music: "plum",
  "photography-film": "denim",
  "health-wellness": "olive",
  "fashion-beauty": "rose",
  "tech-building": "sky",
  "collecting-fandom": "ochre",
  "travel-adventure": "forest",
};

const ALL: Field[] = ["terracotta", "plum", "forest", "denim", "ochre", "olive", "rose", "sky"];

export function fieldFor(spaceSlug: string): Field {
  const listed = FIELD_BY_SPACE[spaceSlug];
  if (listed) return listed;
  let n = 0;
  for (let i = 0; i < spaceSlug.length; i++) n = (n * 31 + spaceSlug.charCodeAt(i)) >>> 0;
  return ALL[n % ALL.length];
}

const TEXT_VAR: Record<Field, string> = {
  terracotta: "--corner-terracotta",
  plum: "--corner-plum",
  forest: "--corner-forest",
  denim: "--corner-denim",
  ochre: "--corner-mustard",
  olive: "--corner-olive",
  rose: "--corner-rose",
  sky: "--corner-sky",
};

/** Sets --field (for marks: dots, rules) and --field-text (for words) on an element. */
export function fieldStyle(spaceSlug: string): CSSProperties {
  const f = fieldFor(spaceSlug);
  return { "--field": `var(--field-${f})`, "--field-text": `var(${TEXT_VAR[f]})` } as CSSProperties;
}
