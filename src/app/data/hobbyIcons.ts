/**
 * A small line icon per hobby, for the label band on a shelf book and the
 * chips beside a hobby name. Names resolve against lucide-react at render
 * time, the same way badge icons do.
 *
 * Deliberately sparse: only hobbies with an obviously readable glyph get a
 * specific one. Everything else falls back to its Space's icon, which is
 * better than a wrong-but-specific picture.
 */
const BY_HOBBY: Record<string, string> = {
  // The Workbench
  pottery: "Amphora",
  ceramics: "Amphora",
  knitting: "Grip",
  crochet: "Grip",
  embroidery: "Scissors",
  sewing: "Scissors",
  woodworking: "Hammer",
  "jewelry-making": "Gem",
  "candle-making": "Flame",
  "soap-making": "Droplets",
  "furniture-flipping": "Armchair",
  restoration: "Wrench",
  upcycling: "Recycle",
  "paper-crafts": "Scroll",
  zines: "BookOpen",
  scrapbooking: "BookImage",

  // The Maker Lab
  "3d-printing": "Box",
  cad: "PencilRuler",
  "laser-cutting": "Zap",
  cnc: "Cog",
  electronics: "CircuitBoard",
  arduino: "CircuitBoard",
  "raspberry-pi": "Cpu",
  robotics: "Bot",
  drones: "Plane",
  "model-making": "Blocks",
  miniatures: "Blocks",

  // The Build Stack
  coding: "Code",
  "no-code-building": "Blocks",
  "creative-coding": "Sparkles",
  "web-design": "Layout",
  "game-development": "Gamepad2",
  "ai-workflows": "Bot",
  "data-visualization": "ChartLine",

  // In Motion
  running: "Footprints",
  "run-clubs": "Footprints",
  yoga: "Flower2",
  pilates: "Flower2",
  climbing: "Mountain",
  cycling: "Bike",
  dance: "Music",
  pickleball: "Target",
  padel: "Target",
  tennis: "Target",
  hiking: "TreePine",
  swimming: "Waves",
  "martial-arts": "Swords",
  "strength-training": "Dumbbell",
  weightlifting: "Dumbbell",
  basketball: "Target",
  soccer: "Target",
  volleyball: "Target",

  // The Kitchen Table
  cooking: "ChefHat",
  baking: "Croissant",
  sourdough: "Wheat",
  fermentation: "FlaskConical",
  "home-coffee": "Coffee",
  tea: "CupSoda",
  espresso: "Coffee",
  "food-photography": "Camera",
  "home-brewing": "Beer",
  kombucha: "FlaskConical",
  "cocktail-making": "Martini",
  "supper-clubs": "Utensils",

  // Rooted & Wild
  gardening: "Sprout",
  houseplants: "Leaf",
  "vegetable-gardens": "Carrot",
  "native-plants": "Leaf",
  composting: "Recycle",
  "indoor-growing": "Sprout",
  birdwatching: "Bird",
  foraging: "Leaf",
  camping: "Tent",
  fishing: "Fish",
  "outdoor-photography": "Camera",
  "nature-journaling": "NotebookPen",

  // The Studio
  painting: "Palette",
  drawing: "Pencil",
  watercolor: "Palette",
  photography: "Camera",
  filmmaking: "Clapperboard",
  "music-production": "AudioLines",
  instrument: "Guitar",
  singing: "Mic",
  writing: "PenLine",
  poetry: "Feather",
  journaling: "NotebookPen",
  calligraphy: "PenTool",
  theater: "Drama",

  // The Rabbit Hole
  "board-games": "Dices",
  chess: "Crown",
  "tabletop-rpgs": "Dices",
  "trading-cards": "Layers",
  pokemon: "Layers",
  lego: "Blocks",
  vinyl: "Disc3",
  books: "BookOpen",
  "book-clubs": "BookOpen",
  thrifting: "ShoppingBag",
  sneakers: "Footprints",
  puzzles: "Puzzle",
  "language-learning": "Languages",
};

const BY_SPACE: Record<string, string> = {
  workbench: "Hammer",
  makerlab: "Cog",
  buildstack: "Code",
  inmotion: "Footprints",
  kitchentable: "ChefHat",
  rooted: "Sprout",
  thestudio: "Palette",
  rabbithole: "Dices",
};

/** Lucide icon name for a hobby, falling back to its Space's icon. */
export function hobbyIconName(subSlug: string | undefined, hobbySlug: string) {
  return (subSlug ? BY_HOBBY[subSlug] : undefined) ?? BY_SPACE[hobbySlug] ?? "Sparkles";
}
