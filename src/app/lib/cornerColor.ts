/**
 * Deterministic text color per Corner, for the Corners tab's styled-text
 * cards. Corners are created ad hoc by tagging (CornersContext.tsx) — there
 * can be dozens, with no hand-curated theme per name — so this hashes a
 * stable key (spaceSlug-slug) into a fixed eight-color palette rather than
 * mapping names one by one. Same string hash hobbies.ts's gradientFor
 * already uses for custom Space gradients, so a given Corner always lands
 * on the same color across renders and sessions.
 *
 * The eight CSS vars are defined in theme.css (light/dark pairs, each
 * contrast-checked against --card), not picked here — this just indexes
 * into them.
 */
const CORNER_TEXT_COLORS = [
  "var(--corner-terracotta)",
  "var(--corner-plum)",
  "var(--corner-forest)",
  "var(--corner-denim)",
  "var(--corner-mustard)",
  "var(--corner-olive)",
  "var(--corner-rose)",
  "var(--corner-sky)",
];

export function cornerColorFor(key: string): string {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return CORNER_TEXT_COLORS[n % CORNER_TEXT_COLORS.length];
}
