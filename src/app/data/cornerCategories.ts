/**
 * The 18 categories and where every built-in Corner goes (Step 4 of the
 * Discover v2 brief; the source is docs/categories-18.md, approved Oct 22,
 * 2026). The 18 are also rows in public.corner_categories, whose
 * sort_order is the order here, and a database Corner carries its category in
 * corners.category_slug. The built-in Corners live in code (hobbies.ts), so
 * their category lives here.
 *
 * A Corner belongs to exactly one category. A Moment's category is its
 * Corner's, never its old Space's: one old Space splits across several
 * categories (Tech and building goes to two). A Moment with no Corner has no
 * category. The old Space slugs keep resolving (posts.hobby_slug points at
 * them); nothing here renames or moves a Moment.
 *
 * Three Corners exist in two old Spaces (Trading cards, Nature journaling,
 * Outdoor photography). Each pair is one Corner here: both keys map to the
 * same category and cornersInCategory() lists it once.
 */
export interface CornerCategory {
  slug: string;
  name: string;
  /** What's in it, shown under the name. */
  about: string;
}

export const CORNER_CATEGORIES: readonly CornerCategory[] = [
  { slug: "yarn-fabric", name: "Yarn and fabric", about: "Knitting, crochet, sewing, embroidery, weaving, mending, cosplay" },
  { slug: "crafts-diy", name: "Crafts and DIY", about: "Clay, candles, jewelry, paper, wood, leather, glass" },
  { slug: "art-design", name: "Art and design", about: "Drawing, painting, printmaking, lettering, mehndi" },
  { slug: "tech-tinkering", name: "Tech and tinkering", about: "Electronics, 3D printing, keyboards, models, LEGO, drones" },
  { slug: "food-drink", name: "Food and drink", about: "Cooking, baking, brewing, coffee, tea, tasting" },
  { slug: "running-fitness", name: "Running and fitness", about: "Running, walking clubs, gym, yoga, Pilates, cycling, swimming" },
  { slug: "sports-martial-arts", name: "Sports and martial arts", about: "Racket and team sports, climbing, skating, combat sports" },
  { slug: "dance-stage", name: "Dance and stage", about: "Dance styles, improv, stand-up, theatre, karaoke" },
  { slug: "outdoors-adventure", name: "Outdoors and adventure", about: "Hiking, camping, water, snow, stargazing, travel" },
  { slug: "home-garden", name: "Home and garden", about: "Gardens, houseplants, flowers, aquariums, home projects" },
  { slug: "games-puzzles", name: "Games and puzzles", about: "Board games, cards, chess, puzzles, video games, trivia" },
  { slug: "music-sound", name: "Music and sound", about: "Instruments, singing, producing, DJing, podcasts" },
  { slug: "photo-film", name: "Photo and film", about: "Photography, video, short films, channels" },
  { slug: "reading-writing", name: "Reading and writing", about: "Books, book clubs, stories, poems, handwritten pages" },
  { slug: "skills-side-projects", name: "Skills and side projects", about: "Languages, money, speaking, coding, AI tools, freelancing" },
  { slug: "collecting-style", name: "Collecting and style", about: "Records, cards, sneakers, fragrance, thrifting, beauty" },
  { slug: "culture-community", name: "Culture and community", about: "Museums, live music, city walks, food tours, hosting, volunteering" },
  { slug: "rest-ritual", name: "Rest and ritual", about: "Meditation, breathwork, sauna, cold water, screen-free time, tarot, astrology" },
];

/** `${old Space slug}/${Corner slug}` to a category slug, for every built-in Corner. */
const CATEGORY_BY_CORNER: Record<string, string> = {
  "art-creative/calligraphy": "art-design",
  "art-creative/ceramics": "crafts-diy",
  "art-creative/drawing": "art-design",
  "art-creative/illustration": "art-design",
  "art-creative/improv": "dance-stage",
  "art-creative/painting": "art-design",
  "art-creative/sculpture": "art-design",
  "art-creative/theater": "dance-stage",
  "art-creative/watercolor": "art-design",
  "books-writing/book-clubs": "reading-writing",
  "books-writing/books": "reading-writing",
  "books-writing/creative-writing": "reading-writing",
  "books-writing/language-learning": "skills-side-projects",
  "books-writing/nature-journaling": "art-design",
  "books-writing/poetry": "reading-writing",
  "books-writing/reading": "reading-writing",
  "books-writing/writing": "reading-writing",
  "collecting-fandom/anime": "collecting-style",
  "collecting-fandom/antiques": "collecting-style",
  "collecting-fandom/lego": "tech-tinkering",
  "collecting-fandom/toys": "collecting-style",
  "collecting-fandom/trading-cards": "collecting-style",
  "collecting-fandom/vinyl": "collecting-style",
  "crafts-making/candle-making": "crafts-diy",
  "crafts-making/crochet": "yarn-fabric",
  "crafts-making/embroidery": "yarn-fabric",
  "crafts-making/jewelry-making": "crafts-diy",
  "crafts-making/knitting": "yarn-fabric",
  "crafts-making/makerspaces": "tech-tinkering",
  "crafts-making/miniatures": "tech-tinkering",
  "crafts-making/model-making": "tech-tinkering",
  "crafts-making/paper-crafts": "crafts-diy",
  "art-creative/life-drawing": "art-design",
  "travel-adventure/city-walks": "culture-community",
  "photography-film/film-clubs": "culture-community",
  "food-cooking/food-tours": "culture-community",
  "gaming-tabletop/mahjong": "games-puzzles",
  "travel-adventure/rafting": "outdoors-adventure",
  "books-writing/letter-writing": "reading-writing",
  "sports-fitness/hyrox": "running-fitness",
  "sports-fitness/walking-clubs": "running-fitness",
  "sports-fitness/badminton": "sports-martial-arts",
  "sports-fitness/skating": "sports-martial-arts",
  "sports-fitness/ultimate-frisbee": "sports-martial-arts",
  "crafts-making/pottery": "crafts-diy",
  "crafts-making/scrapbooking": "crafts-diy",
  "crafts-making/sewing": "yarn-fabric",
  "crafts-making/soap-making": "crafts-diy",
  "crafts-making/upcycling": "crafts-diy",
  "crafts-making/woodworking": "crafts-diy",
  "crafts-making/zines": "art-design",
  "fashion-beauty/fashion": "collecting-style",
  "fashion-beauty/fragrance": "collecting-style",
  "fashion-beauty/makeup": "collecting-style",
  "fashion-beauty/nails": "collecting-style",
  "fashion-beauty/sneakers": "collecting-style",
  "fashion-beauty/thrifting": "collecting-style",
  "food-cooking/baking": "food-drink",
  "food-cooking/bbq": "food-drink",
  "food-cooking/cocktail-making": "food-drink",
  "food-cooking/coffee": "food-drink",
  "food-cooking/cooking": "food-drink",
  "food-cooking/espresso": "food-drink",
  "food-cooking/fermentation": "food-drink",
  "food-cooking/home-brewing": "food-drink",
  "food-cooking/home-coffee": "food-drink",
  "food-cooking/kombucha": "food-drink",
  "food-cooking/pasta": "food-drink",
  "food-cooking/sourdough": "food-drink",
  // A database-only Corner (corners row), filed here by judgement: it sat under
  // Food & Cooking but is a writing Corner. Not one of the 149 built-ins.
  "food-cooking/storytelling": "reading-writing",
  "food-cooking/supper-clubs": "culture-community",
  "food-cooking/tea": "food-drink",
  "gaming-tabletop/board-games": "games-puzzles",
  "gaming-tabletop/chess": "games-puzzles",
  "gaming-tabletop/d-d": "games-puzzles",
  "gaming-tabletop/puzzles": "games-puzzles",
  "gaming-tabletop/tabletop-rpgs": "games-puzzles",
  "gaming-tabletop/trading-cards": "collecting-style",
  "gaming-tabletop/trivia": "games-puzzles",
  "gaming-tabletop/video-games": "games-puzzles",
  "health-wellness/breathwork": "rest-ritual",
  "health-wellness/meditation": "rest-ritual",
  "health-wellness/mindfulness": "rest-ritual",
  "health-wellness/pilates": "running-fitness",
  "health-wellness/sauna-cold-plunge": "rest-ritual",
  "health-wellness/yoga": "running-fitness",
  "home-garden/composting": "home-garden",
  "home-garden/diy": "home-garden",
  "home-garden/furniture-flipping": "home-garden",
  "home-garden/gardening": "home-garden",
  "home-garden/houseplants": "home-garden",
  "home-garden/indoor-growing": "home-garden",
  "home-garden/interior-design": "home-garden",
  "home-garden/native-plants": "home-garden",
  "home-garden/restoration": "home-garden",
  "home-garden/vegetable-gardens": "home-garden",
  "music/choir": "music-sound",
  "music/djing": "music-sound",
  "music/guitar": "music-sound",
  "music/karaoke": "dance-stage",
  "music/live-music": "culture-community",
  "music/make-a-beat": "music-sound",
  "music/music-production": "music-sound",
  "music/singing": "music-sound",
  "music/songwriting": "music-sound",
  "nature-outdoors/birdwatching": "outdoors-adventure",
  "nature-outdoors/camping": "outdoors-adventure",
  "nature-outdoors/fishing": "outdoors-adventure",
  "nature-outdoors/foraging": "outdoors-adventure",
  "nature-outdoors/hiking": "outdoors-adventure",
  "nature-outdoors/kayaking": "outdoors-adventure",
  "nature-outdoors/nature-journaling": "art-design",
  "nature-outdoors/outdoor-photography": "photo-film",
  "nature-outdoors/surfing": "outdoors-adventure",
  "nature-outdoors/wild-swimming": "outdoors-adventure",
  "photography-film/film-photography": "photo-film",
  "photography-film/filmmaking": "photo-film",
  "photography-film/outdoor-photography": "photo-film",
  "photography-film/photography": "photo-film",
  "photography-film/video": "photo-film",
  "sports-fitness/basketball": "sports-martial-arts",
  "sports-fitness/boxing": "sports-martial-arts",
  "sports-fitness/climbing": "sports-martial-arts",
  "sports-fitness/cycling": "running-fitness",
  "sports-fitness/dance": "dance-stage",
  "sports-fitness/martial-arts": "sports-martial-arts",
  "sports-fitness/padel": "sports-martial-arts",
  "sports-fitness/pickleball": "sports-martial-arts",
  "sports-fitness/cricket": "sports-martial-arts",
  "sports-fitness/table-tennis": "sports-martial-arts",
  "gaming-tabletop/carrom": "games-puzzles",
  "art-creative/open-mics": "dance-stage",
  "art-creative/indian-classical-dance": "dance-stage",
  "music/indian-classical-music": "music-sound",
  "music/piano": "music-sound",
  "health-wellness/sound-baths": "rest-ritual",
  "nature-outdoors/stargazing": "outdoors-adventure",
  "crafts-making/block-printing": "crafts-diy",
  "sports-fitness/run-clubs": "running-fitness",
  "sports-fitness/running": "running-fitness",
  "sports-fitness/skateboarding": "sports-martial-arts",
  "sports-fitness/soccer": "sports-martial-arts",
  "sports-fitness/strength-training": "running-fitness",
  "sports-fitness/swimming": "running-fitness",
  "sports-fitness/tennis": "sports-martial-arts",
  "sports-fitness/volleyball": "sports-martial-arts",
  "tech-building/3d-printing": "tech-tinkering",
  "tech-building/ai-projects": "skills-side-projects",
  "tech-building/ar-vr-projects": "tech-tinkering",
  "tech-building/arduino": "tech-tinkering",
  "tech-building/cad": "tech-tinkering",
  "tech-building/cnc": "tech-tinkering",
  "tech-building/coding": "skills-side-projects",
  "tech-building/creative-coding": "skills-side-projects",
  "tech-building/cybersecurity-learning": "skills-side-projects",
  "tech-building/data-visualization": "skills-side-projects",
  "tech-building/drones": "tech-tinkering",
  "tech-building/electronics": "tech-tinkering",
  "tech-building/game-development": "skills-side-projects",
  "tech-building/laser-cutting": "tech-tinkering",
  "tech-building/no-code-building": "skills-side-projects",
  "tech-building/product-prototyping": "tech-tinkering",
  "tech-building/raspberry-pi": "tech-tinkering",
  "tech-building/robotics": "tech-tinkering",
  "tech-building/smart-home-projects": "tech-tinkering",
  "tech-building/web-design": "skills-side-projects",
  "travel-adventure/backpacking": "outdoors-adventure",
  "travel-adventure/exploration": "culture-community",
  "travel-adventure/road-trips": "outdoors-adventure",
  "travel-adventure/skiing": "outdoors-adventure",
  "travel-adventure/travel": "outdoors-adventure",
  "travel-adventure/volunteering": "culture-community",
};

export function categoryOfCorner(spaceSlug: string, cornerSlug: string): CornerCategory | undefined {
  const slug = CATEGORY_BY_CORNER[`${spaceSlug}/${cornerSlug}`];
  return slug ? CORNER_CATEGORIES.find((c) => c.slug === slug) : undefined;
}

/** Each Corner once, in the order the old Spaces list them. */
export function cornersInCategory(categorySlug: string): { spaceSlug: string; cornerSlug: string }[] {
  const seen = new Set<string>();
  const out: { spaceSlug: string; cornerSlug: string }[] = [];
  for (const [key, cat] of Object.entries(CATEGORY_BY_CORNER)) {
    if (cat !== categorySlug) continue;
    const [spaceSlug, cornerSlug] = key.split("/");
    if (seen.has(cornerSlug)) continue;
    seen.add(cornerSlug);
    out.push({ spaceSlug, cornerSlug });
  }
  return out;
}
