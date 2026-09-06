export interface Product {
  id: number;
  name: string;
  price: number;
  hobbySlug: string;
  image: string;
  description: string;
  rating: number;
  reviews: number;
  colors?: string[];
  sizes?: string[];
  creator: string;
  type: "physical" | "digital" | "course";
}

export const products: Product[] = [
  // Workbench
  {
    id: 1,
    name: "Pottery Starter Kit",
    price: 64.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1595351298020-038700609878?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Everything you need to start your pottery journey. Includes modeling tools, wire cutter, and a step-by-step guide.",
    rating: 4.8,
    reviews: 143,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 2,
    name: "Embroidery Hoop Set",
    price: 32.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1599589915468-b4c71ed62543?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Beginner-friendly kit with 5 hoops, 40 thread colors, and floral pattern templates.",
    rating: 4.7,
    reviews: 289,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 3,
    name: "Air-Dry Clay Kit",
    price: 28.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1590605095243-072811dbe64c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Smooth, non-toxic air-dry clay with shaping tools and paint. No kiln needed, perfect for home crafting.",
    rating: 4.6,
    reviews: 178,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 4,
    name: "Crochet Starter Kit",
    price: 38.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1584992236310-6edddc08acff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Complete kit with pastel yarn bundles, ergonomic hooks, stitch markers, and a beginner pattern booklet.",
    rating: 4.9,
    reviews: 412,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 5,
    name: "Candle-Making Kit",
    price: 44.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1624479163091-3c000402218d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Soy wax kit with 6 fragrance blends, cotton wicks, glass vessels, and dried botanicals for decoration.",
    rating: 4.8,
    reviews: 356,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 6,
    name: "Watercolor Sketchbook Set",
    price: 36.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1577941796491-999f99ba658f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Cold-press watercolor pad with 24 professional pigment pans, two brushes, and a color mixing guide.",
    rating: 4.7,
    reviews: 221,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 7,
    name: "Hand-Building Pottery: Video Course",
    price: 39.0,
    hobbySlug: "workbench",
    image:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "6-part video course on coil, slab, and pinch techniques, shot in Mara's home studio. Watch at your own pace.",
    rating: 4.9,
    reviews: 64,
    creator: "Mara Chen",
    type: "course",
  },

  // In Motion
  {
    id: 14,
    name: "Pickleball Paddle Set",
    price: 79.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1659318006095-4d44845f3a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Matched pair of graphite-core paddles with four balls and a zippered carry bag. Ready to rally.",
    rating: 4.8,
    reviews: 167,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 15,
    name: "Padel Racket",
    price: 119.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1658723826297-fe4d1b1e6600?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Mid-level foam-core padel racket with a diamond head shape. Great for aggressive baseline play.",
    rating: 4.7,
    reviews: 89,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 16,
    name: "Portable Sport Net",
    price: 54.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1618551763300-dc7eb8ce3560?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Quick-assembly 10-ft pop-up net for pickleball, badminton, or volleyball. Packs into a shoulder bag in under 2 minutes.",
    rating: 4.5,
    reviews: 132,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 17,
    name: "Court Shoes",
    price: 88.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1663573690125-d326a87a2535?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Lateral-support court sneakers with non-marking soles. Designed for quick side-to-side movement on any surface.",
    rating: 4.8,
    reviews: 341,
    sizes: ["6", "7", "8", "9", "10", "11"],
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 18,
    name: "Sport Water Bottle",
    price: 28.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "32 oz insulated stainless steel bottle with a flip straw lid. Keeps drinks cold for 24 hours on the court.",
    rating: 4.7,
    reviews: 512,
    colors: ["White", "Sage", "Pink"],
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 19,
    name: "Pickleball Fundamentals: 5-Lesson Course",
    price: 29.0,
    hobbySlug: "inmotion",
    image:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Footwork, dinking, and serve strategy from a certified instructor. Built for total beginners.",
    rating: 4.9,
    reviews: 118,
    creator: "Jordan Price",
    type: "course",
  },

  // Kitchen Table
  {
    id: 20,
    name: "Mini Espresso Machine",
    price: 149.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1596018589855-e9a2a91f687f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Compact 15-bar pump espresso machine that pulls café-quality shots in under 30 seconds. Fits any countertop.",
    rating: 4.8,
    reviews: 287,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 21,
    name: "Latte Syrup Set",
    price: 36.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1514066558159-fc8c737ef259?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Set of 6 barista-grade syrups: vanilla, caramel, hazelnut, brown sugar, lavender, and cardamom rose.",
    rating: 4.9,
    reviews: 633,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 22,
    name: "Coffee Station Tray",
    price: 48.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1702234683996-9271b4d8231f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Rattan-trimmed bamboo tray with cup slots and a drawer for pods, stirrers, and accessories. Coffee-corner goals.",
    rating: 4.7,
    reviews: 178,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 23,
    name: "Milk Frother",
    price: 32.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1577590835286-1cdd24c08fd7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Handheld electric frother for silky microfoam in seconds. Two speeds, dishwasher-safe whisk, included stand.",
    rating: 4.8,
    reviews: 891,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 24,
    name: "Cozy Throw Blanket",
    price: 68.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1674475760738-8c7af859f821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Chunky-knit cotton throw in oatmeal, sage, and blush. Drape it over your reading chair or curl up café-style.",
    rating: 4.9,
    reviews: 772,
    colors: ["Oatmeal", "Sage", "Blush"],
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 25,
    name: "Home Barista Masterclass",
    price: 42.0,
    hobbySlug: "kitchentable",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Dial in your grind, steam microfoam, and pour latte art, filmed step-by-step in a real kitchen, not a café.",
    rating: 4.9,
    reviews: 203,
    creator: "Theo Reyes",
    type: "course",
  },

  // Rabbit Hole
  {
    id: 26,
    name: "Trinket Display Shelf",
    price: 74.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1767338718786-92f7934e925e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Three-tier floating shelf with cubed cubbies and a wood-and-brass finish. Made to show off your tiny treasures.",
    rating: 4.7,
    reviews: 198,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 27,
    name: "Trading Card Binder",
    price: 24.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1699898016940-ac6892b79171?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "9-pocket premium binder with 30 archival pages for 540 cards. Side-loading sleeves protect against bending.",
    rating: 4.8,
    reviews: 367,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 28,
    name: "Sashiko Mending Kit",
    price: 38.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1671535108665-eeeb723ebebf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Traditional Japanese visible mending kit with indigo thread, a darning mushroom, needles, and a pattern guide.",
    rating: 4.9,
    reviews: 143,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 29,
    name: "Keepsake Display Case",
    price: 52.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1620228389798-c685290a453a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Shadow-box display case with 24 velvet-lined compartments. Perfect for pins, coins, stamps, or small figurines.",
    rating: 4.6,
    reviews: 221,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 30,
    name: "Upcycled Tote Bag",
    price: 46.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1688126753535-0ca32e3b5cbb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "Made from reclaimed fabric scraps, each bag is one-of-a-kind. Patchwork exterior with a zipper inner pocket.",
    rating: 4.8,
    reviews: 289,
    creator: "NoSpace Makers",
    type: "physical",
  },
  {
    id: 31,
    name: "Visible Mending 101: Digital Guide",
    price: 18.0,
    hobbySlug: "rabbithole",
    image:
      "https://images.unsplash.com/photo-1606213988003-f2f74c4aa22d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    description:
      "A 40-page illustrated PDF on sashiko stitches, patch placement, and giving old clothes a second life.",
    rating: 4.7,
    reviews: 76,
    creator: "Sam Okafor",
    type: "digital",
  },
];

export function productsByHobby(slug: string) {
  return products.filter((p) => p.hobbySlug === slug);
}
