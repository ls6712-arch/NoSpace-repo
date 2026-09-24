/**
 * The landing page's "Whatever pulls you in, it belongs here" section — nine
 * illustrated little worlds, each a distinct thing someone might be curious
 * about. Deliberately a curated, human-picked handful rather than the full
 * fifteen-Space taxonomy (src/app/data/hobbies.ts): this section is meant to
 * feel like a glimpse, not an index. `to` still points at a real Space route,
 * so the glimpse is never a dead end.
 *
 * Add a new one with a name, a one-line description, an `illustration` key
 * (handled in WorldIllustration.tsx), and an `accent` token from the theme
 * palette, and it gets the same card, hover, and motion treatment as every
 * other world automatically — nothing else to wire up.
 */
export interface WorldSpace {
  slug: string;
  name: string;
  description: string;
  illustration: "music" | "painting" | "sculpture" | "gardening" | "reading" | "baking" | "coding" | "photography" | "pottery";
  /** A CSS color token (no var(), no #) used for this card's hover glow and accent dot. */
  accent: string;
  /** A real Space this world lives closest to. */
  to: string;
}

export const WORLD_SPACES: WorldSpace[] = [
  {
    slug: "music",
    name: "Music",
    description: "A new chord progression, a practice room, a song finally clicking.",
    illustration: "music",
    accent: "var(--coral-deep)",
    to: "/space/music",
  },
  {
    slug: "painting",
    name: "Painting",
    description: "Mixing a color that isn't quite right yet, and trying again.",
    illustration: "painting",
    accent: "var(--sky-deep)",
    to: "/space/art-creative",
  },
  {
    slug: "sculpture",
    name: "Sculpture",
    description: "Shaping something out of what used to be just material.",
    illustration: "sculpture",
    accent: "var(--plum)",
    to: "/space/art-creative",
  },
  {
    slug: "gardening",
    name: "Gardening",
    description: "Watching something you planted actually come up.",
    illustration: "gardening",
    accent: "var(--forest)",
    to: "/space/home-garden",
  },
  {
    slug: "reading",
    name: "Reading",
    description: "A book that changes how you see the next week.",
    illustration: "reading",
    accent: "var(--plum-deep)",
    to: "/space/books-writing",
  },
  {
    slug: "baking",
    name: "Baking",
    description: "The first loaf that finally rises the way it's supposed to.",
    illustration: "baking",
    accent: "var(--coral)",
    to: "/space/food-cooking",
  },
  {
    slug: "coding",
    name: "Coding",
    description: "A small thing you built that didn't exist yesterday.",
    illustration: "coding",
    accent: "var(--sky-deep)",
    to: "/space/tech-building",
  },
  {
    slug: "photography",
    name: "Photography",
    description: "Noticing the light before you even reach for the camera.",
    illustration: "photography",
    accent: "var(--yellow)",
    to: "/space/photography-film",
  },
  {
    slug: "pottery",
    name: "Pottery",
    description: "A shape emerging out of clay that was formless a minute ago.",
    illustration: "pottery",
    accent: "var(--coral-deep)",
    to: "/space/crafts-making",
  },
];
