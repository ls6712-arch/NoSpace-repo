/**
 * The landing page's Corners strip: a few illustrated examples that show the
 * range of what people post. Deliberately a short, curated list, not every
 * Corner. Each has a name, a one-line description of the kind of Moment it
 * holds, an `illustration` key (handled in WorldIllustration.tsx), and an
 * `accent` token from the theme palette.
 */
export interface WorldSpace {
  slug: string;
  name: string;
  description: string;
  illustration: "music" | "painting" | "sculpture" | "gardening" | "reading" | "baking" | "coding" | "photography" | "pottery";
  /** A CSS color token (no var(), no #) used for this card's hover glow and accent dot. */
  accent: string;
}

export const WORLD_SPACES: WorldSpace[] = [
  {
    slug: "pottery",
    name: "Pottery",
    description: "Wheel-thrown bowls, glaze tests, and what came out of the kiln.",
    illustration: "pottery",
    accent: "var(--coral-deep)",
  },
  {
    slug: "coding",
    name: "Coding",
    description: "Side projects, repos, and the small tools you built for yourself.",
    illustration: "coding",
    accent: "var(--sky-deep)",
  },
  {
    slug: "cooking",
    name: "Cooking",
    description: "A first sourdough loaf, a new recipe, a dinner for friends.",
    illustration: "baking",
    accent: "var(--coral)",
  },
  {
    slug: "photography",
    name: "Photography",
    description: "Film rolls, edits, and the shots worth keeping.",
    illustration: "photography",
    accent: "var(--yellow)",
  },
  {
    slug: "guitar",
    name: "Guitar",
    description: "A song you learned, a practice session, a set you played.",
    illustration: "music",
    accent: "var(--coral-deep)",
  },
  {
    slug: "painting",
    name: "Painting",
    description: "Studies, sketchbook pages, and finished pieces.",
    illustration: "painting",
    accent: "var(--sky-deep)",
  },
];
