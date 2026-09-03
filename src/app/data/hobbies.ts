export interface Hobby {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  gradient: string; // tailwind gradient classes
  coverImage: string;
  /** Demo/placeholder figure — like the rest of this prototype's numbers, not real data. */
  creatorCount: string;
}

export const hobbies: Hobby[] = [
  {
    slug: "crafting",
    name: "Tactile & Screen-Free Crafting",
    shortName: "Crafting",
    tagline: "Make something with your hands today.",
    description:
      "Pottery, embroidery, clay, crochet, candle-making — slow, tactile projects that keep your hands busy and your phone down.",
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    coverImage:
      "https://images.unsplash.com/photo-1599589915468-b4c71ed62543?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "9.4K",
  },
  {
    slug: "mysticism",
    name: "Mysticism & Self-Alignment Practices",
    shortName: "Mysticism",
    tagline: "Tune in, slow down, align.",
    description:
      "Tarot, astrology, crystals, moon rituals, journaling — practices for people building a little more intention into their days.",
    gradient: "from-indigo-500 via-purple-500 to-violet-500",
    coverImage:
      "https://images.unsplash.com/photo-1621923647893-901f834b3e6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "3.8K",
  },
  {
    slug: "sports",
    name: "Low-Barrier Social & Racket Sports",
    shortName: "Sports",
    tagline: "Show up, rally, meet people.",
    description:
      "Pickleball, padel, badminton — easy-entry sports that are really just an excuse to get outside with other humans.",
    gradient: "from-cyan-500 via-sky-500 to-blue-500",
    coverImage:
      "https://images.unsplash.com/photo-1659318006095-4d44845f3a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "11.2K",
  },
  {
    slug: "recreation",
    name: 'At-Home "Third Place" Recreation',
    shortName: "Recreation",
    tagline: "Build your own third place.",
    description:
      "Home cafés, latte art, cozy corners — turning a slice of your apartment into the coffee shop you keep wishing was closer.",
    gradient: "from-amber-500 via-orange-500 to-pink-500",
    coverImage:
      "https://images.unsplash.com/photo-1596018589855-e9a2a91f687f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "7.6K",
  },
  {
    slug: "collecting",
    name: "Nostalgic Collecting & Secondhand Culture",
    shortName: "Collecting",
    tagline: "Treasure the things with a story.",
    description:
      "Trading cards, thrifted finds, mended clothes, trinket shelves — for people who'd rather collect than scroll.",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    coverImage:
      "https://images.unsplash.com/photo-1767338718786-92f7934e925e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "5.9K",
  },
];

export function getHobby(slug: string) {
  return hobbies.find((h) => h.slug === slug);
}
