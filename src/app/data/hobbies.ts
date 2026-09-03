export interface Hobby {
  slug: string;
  /** Full category name, e.g. "The Workbench". */
  name: string;
  /** Short label for nav/cards, e.g. "Workbench". */
  shortName: string;
  tagline: string;
  /** Plain-language description of the category, shown under the name. */
  plainLabel: string;
  description: string;
  /** The specific hobbies/activities that live inside this space. */
  subItems: string[];
  gradient: string; // tailwind gradient classes
  coverImage: string;
  /** Demo/placeholder figure — like the rest of this prototype's numbers, not real data. */
  creatorCount: string;
}

export const hobbies: Hobby[] = [
  {
    slug: "workbench",
    name: "The Workbench",
    shortName: "Workbench",
    tagline: "Make it by hand.",
    plainLabel: "Crafts, DIY & Handmade",
    description:
      "Pottery, embroidery, crochet, woodworking, candle-making — slow, tactile projects that keep your hands busy and your phone down.",
    subItems: [
      "Pottery", "Ceramics", "Knitting", "Crochet", "Embroidery", "Sewing",
      "Woodworking", "Jewelry-making", "Candle-making", "Soap-making",
      "Furniture flipping", "Restoration", "Upcycling", "Paper crafts",
      "Zines", "Scrapbooking",
    ],
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    coverImage:
      "https://images.unsplash.com/photo-1599589915468-b4c71ed62543?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "9.4K",
  },
  {
    slug: "makerlab",
    name: "The Maker Lab",
    shortName: "Maker Lab",
    tagline: "Print it, wire it, build it.",
    plainLabel: "3D Printing, Robotics & Fabrication",
    description:
      "3D printing, CAD, laser cutting, robotics, Arduino, drones — for people who'd rather prototype something real than scroll past one.",
    subItems: [
      "3D printing", "CAD", "Laser cutting", "CNC", "Electronics", "Arduino",
      "Raspberry Pi", "Robotics", "Drones", "Model-making", "Miniatures",
      "Makerspaces", "Product prototyping",
    ],
    gradient: "from-sky-500 via-cyan-500 to-teal-500",
    coverImage:
      "https://images.unsplash.com/photo-1631545806609-946d4f37b2a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "4.1K",
  },
  {
    slug: "buildstack",
    name: "The Build Stack",
    shortName: "Build Stack",
    tagline: "Learn the tools. Make the thing.",
    plainLabel: "Code, AI & Digital Projects",
    description:
      "Coding, no-code building, creative coding, AI workflows, game dev, data viz — learn the tools, then actually make the thing.",
    subItems: [
      "Coding", "No-code building", "Creative coding", "Web design",
      "Game development", "Learning AI creative workflows & prompt craft",
      "Generative design as a skill", "Data visualization", "AR/VR projects",
      "Smart-home projects", "Cybersecurity learning",
    ],
    gradient: "from-indigo-500 via-blue-500 to-cyan-500",
    coverImage:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "6.7K",
  },
  {
    slug: "inmotion",
    name: "In Motion",
    shortName: "In Motion",
    tagline: "Move, stretch, compete.",
    plainLabel: "Sport, Movement & Wellness",
    description:
      "Running, yoga, climbing, pickleball, padel, dance, strength training — easy-entry ways to move and meet people outside.",
    subItems: [
      "Running", "Run clubs", "Yoga", "Climbing", "Cycling", "Dance",
      "Pickleball", "Padel", "Tennis", "Hiking", "Swimming", "Martial arts",
      "Strength training", "Weightlifting/gym", "Basketball", "Soccer",
      "Volleyball", "Pilates",
    ],
    gradient: "from-cyan-500 via-sky-500 to-blue-500",
    coverImage:
      "https://images.unsplash.com/photo-1659318006095-4d44845f3a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "11.2K",
  },
  {
    slug: "kitchentable",
    name: "The Kitchen Table",
    shortName: "Kitchen Table",
    tagline: "Cook it, ferment it, pour it.",
    plainLabel: "Cooking, Baking & Coffee",
    description:
      "Sourdough, fermentation, home coffee, cocktails, supper clubs — turning a slice of your kitchen into the place you keep wishing was closer.",
    subItems: [
      "Cooking", "Baking", "Sourdough", "Fermentation", "Home coffee", "Tea",
      "Espresso", "Food photography", "Home brewing", "Kombucha",
      "Cocktail-making", "Supper clubs",
    ],
    gradient: "from-amber-500 via-orange-500 to-pink-500",
    coverImage:
      "https://images.unsplash.com/photo-1596018589855-e9a2a91f687f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "7.6K",
  },
  {
    slug: "rooted",
    name: "Rooted & Wild",
    shortName: "Rooted & Wild",
    tagline: "Grow it, find it, get outside.",
    plainLabel: "Gardening, Plants & Outdoors",
    description:
      "Gardening, houseplants, composting, birdwatching, foraging, camping — for people who'd rather get their hands in the dirt than doomscroll.",
    subItems: [
      "Gardening", "Houseplants", "Vegetable gardens", "Native plants",
      "Composting", "Indoor growing", "Birdwatching", "Foraging", "Camping",
      "Fishing", "Outdoor photography", "Nature journaling",
    ],
    gradient: "from-lime-500 via-green-500 to-emerald-500",
    coverImage:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "5.2K",
  },
  {
    slug: "thestudio",
    name: "The Studio",
    shortName: "The Studio",
    tagline: "Paint it, shoot it, write it, play it.",
    plainLabel: "Art, Music, Writing & Film",
    description:
      "Painting, photography, filmmaking, music production, writing, calligraphy — make something and put it out into the world.",
    subItems: [
      "Painting", "Drawing", "Watercolor", "Photography", "Filmmaking",
      "Music production", "Learning an instrument", "Singing", "Writing",
      "Poetry", "Journaling", "Calligraphy", "Theater",
    ],
    gradient: "from-purple-500 via-fuchsia-500 to-rose-500",
    coverImage:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "8.9K",
  },
  {
    slug: "rabbithole",
    name: "The Rabbit Hole",
    shortName: "Rabbit Hole",
    tagline: "Collect it, play it, go deep.",
    plainLabel: "Games, Collecting & Culture",
    description:
      "Board games, chess, trading cards, vinyl, thrifted finds, puzzles — for people who'd rather collect than scroll.",
    subItems: [
      "Board games", "Chess", "Tabletop RPGs", "Trading cards", "Pokémon",
      "LEGO", "Vinyl", "Books", "Book clubs", "Vintage/thrifting", "Sneakers",
      "Puzzles", "Language learning",
    ],
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    coverImage:
      "https://images.unsplash.com/photo-1767338718786-92f7934e925e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    creatorCount: "5.9K",
  },
];

export function getHobby(slug: string) {
  return hobbies.find((h) => h.slug === slug);
}
