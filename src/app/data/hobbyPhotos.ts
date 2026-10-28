/**
 * A photograph per hobby, for the places where the profile wants warmth and
 * texture rather than illustration — chiefly the space and hobby shelves. The
 * generated art remains the reliable fallback, while this mapping keeps every
 * photographic card tied to the activity it names.
 *
 * Chosen for a consistent look: warm light, muted colour, hands or landscape
 * rather than stock-posed people, so a shelf of four sits together calmly.
 */
const PHOTO: Record<string, string> = {
  // Workbench
  pottery: "photo-1565193566173-7a0ee3dbe261",
  ceramics: "photo-1590605095243-072811dbe64c",
  knitting: "photo-1584992236310-6edddc08acff",
  crochet: "photo-1591051649443-453d2e0a716d",
  embroidery: "photo-1568288796918-03e7d93306bd",
  sewing: "photo-1594633312681-425c7b97ccd1",
  woodworking: "photo-1659930087003-2d64e33181f7",
  "jewelry-making": "photo-1611652022419-a9419f74343d",
  "candle-making": "photo-1624479163091-3c000402218d",
  "soap-making": "photo-1600857544200-b2f666a9a2ec",
  "furniture-flipping": "photo-1503602642458-232111445657",
  restoration: "photo-1513519245088-0e12902e5a38",
  upcycling: "photo-1532996122724-e3c354a0b15b",
  "paper-crafts": "photo-1563260797-cb5cd70254c8",
  zines: "photo-1519682337058-a94d519337bc",
  scrapbooking: "photo-1544716278-ca5e3f4abd8c",

  // Maker Lab
  "3d-printing": "photo-1642969164999-979483e21601",
  cad: "photo-1581092160562-40aa08e78837",
  "laser-cutting": "photo-1565043666747-69f6646db940",
  cnc: "photo-1518709594023-6eab9bab7b23",
  electronics: "photo-1553406830-ef2513450d76",
  arduino: "photo-1608564697071-ddf911d81370",
  "raspberry-pi": "photo-1587202372775-e229f172b9d7",
  robotics: "photo-1485827404703-89b55fcc595e",
  drones: "photo-1473968512647-3e447244af8f",
  "model-making": "photo-1790112626698-c024002301f3",
  miniatures: "photo-1549490349-8643362247b5",
  makerspaces: "photo-1581092918056-0c4c3acd3789",
  "product-prototyping": "photo-1581092795360-fd1ca04f0952",

  // Build Stack
  coding: "photo-1461749280684-dccba630e2f6",
  "no-code-building": "photo-1517245386807-bb43f82c33c4",
  "creative-coding": "photo-1550439062-609e1531270e",
  "web-design": "photo-1507238691740-187a5b1d37b8",
  "game-development": "photo-1552820728-8b83bb6b773f",
  "ai-workflows": "photo-1620712943543-bcc4688e7485",
  "generative-design": "photo-1518709268805-4e9042af2176",
  "data-visualization": "photo-1551288049-bebda4e38f71",
  "ar-vr-projects": "photo-1592478411213-6153e4ebc07d",
  "smart-home-projects": "photo-1558002038-1055907df827",
  "ai-projects": "photo-1677442136019-21780ecad995",
  "cybersecurity-learning": "photo-1550751827-4bd374c3f58b",

  // In Motion
  running: "photo-1571008887538-b36bb32f4571",
  "run-clubs": "photo-1502904550040-7534597429ae",
  yoga: "photo-1506126613408-eca07ce68773",
  meditation: "photo-1474418397713-7ede21d49118",
  mindfulness: "photo-1545389336-cf090694435e",
  breathwork: "photo-1473496169904-658ba7c44d8a",
  climbing: "photo-1522163182402-834f871fd851",
  cycling: "photo-1541625602330-2277a4c46182",
  dance: "photo-1787724691140-94b3f9867e67",
  pickleball: "photo-1693142518820-78d7a05f1546",
  padel: "photo-1658723826297-fe4d1b1e6600",
  tennis: "photo-1595435934249-5df7ed86e1c0",
  hiking: "photo-1551632811-561732d1e306",
  swimming: "photo-1530549387789-4c1017266635",
  "martial-arts": "photo-1555597673-b21d5c935865",
  "strength-training": "photo-1534438327276-14e5300c3a48",
  weightlifting: "photo-1517836357463-d25dfeac3438",
  basketball: "photo-1546519638-68e109498ffc",
  soccer: "photo-1517927033932-b3d18e61fb3a",
  volleyball: "photo-1612872087720-bb876e2e67d1",
  pilates: "photo-1518611012118-696072aa579a",

  // Kitchen Table
  cooking: "photo-1556909114-f6e7ad7d3136",
  baking: "photo-1509440159596-0249088772ff",
  sourdough: "photo-1590301157172-7ba48dd1c2b2",
  fermentation: "photo-1590301157890-4810ed352733",
  "home-coffee": "photo-1702234683996-9271b4d8231f",
  tea: "photo-1544787219-7f47ccb76574",
  espresso: "photo-1495474472287-4d71bcdd2085",
  "food-photography": "photo-1493770348161-369560ae357d",
  "home-brewing": "photo-1518099074172-2e47ee6cfdc0",
  kombucha: "photo-1595981267035-7b04ca84a82d",
  "cocktail-making": "photo-1514362545857-3bc16c4c7d1b",
  "supper-clubs": "photo-1555939594-58d7cb561ad1",
  coffee: "photo-1445116572660-236099ec97a0",
  bbq: "photo-1579405317876-9340f1d26061",

  // Rooted & Wild
  gardening: "photo-1416879595882-3373a0480b5b",
  houseplants: "photo-1485955900006-10f4d324d411",
  "vegetable-gardens": "photo-1595855759920-86582396756a",
  "native-plants": "photo-1470137237906-d8a4f71e1966",
  composting: "photo-1587733761376-3f26fc81d17f",
  "indoor-growing": "photo-1466692476868-aef1dfb1e735",
  "interior-design": "photo-1618221195710-dd6b41faaea6",
  diy: "photo-1504148455328-c376907d081c",
  birdwatching: "photo-1444464666168-49d633b86797",
  foraging: "photo-1518977676601-b53f82aba655",
  camping: "photo-1504280390367-361c6d9f38f4",
  fishing: "photo-1445217143695-467124038776",
  "outdoor-photography": "photo-1452587925148-ce544e77e70d",
  "nature-journaling": "photo-1469474968028-56623f02e42e",

  // The Studio
  painting: "photo-1513364776144-60967b0f800f",
  drawing: "photo-1593472807861-5bb884af28f6",
  watercolor: "photo-1596548438137-d51ea5c83ca5",
  photography: "photo-1502920917128-1aa500764cbd",
  filmmaking: "photo-1485846234645-a62644f84728",
  "film-photography": "photo-1516035069371-29a1b244cc32",
  video: "photo-1492724441997-5dc865305da7",
  "music-production": "photo-1598488035139-bdbb2231ce04",
  instrument: "photo-1510915361894-db8b60106cb1",
  singing: "photo-1516280440614-37939bbacd81",
  guitar: "photo-1525201548942-d8732f6617a0",
  songwriting: "photo-1590796351790-0878afe48943",
  djing: "photo-1541126274323-dbac58d14741",
  writing: "photo-1455390582262-044cdead277a",
  poetry: "photo-1474932430478-367dbb6832c1",
  journaling: "photo-1517842645767-c639042777db",
  calligraphy: "photo-1564630322990-4a9e93d13946",
  theater: "photo-1503095396549-807759245b35",
  illustration: "photo-1547891654-e66ed7ebb968",
  sculpture: "photo-1499976311613-703e57dd2e53",

  // The Rabbit Hole
  "board-games": "photo-1610890716171-6b1bb98ffd09",
  chess: "photo-1529699211952-734e80c4d42b",
  "tabletop-rpgs": "photo-1614682835402-06e3a1f0f2c4",
  "d&d": "photo-1511512578047-dfb367046420",
  "video-games": "photo-1542751371-adc38448a05e",
  "trading-cards": "photo-1677545216009-342bf4d080a7",
  antiques: "photo-1758779529326-f29d7cbfeab1",
  toys: "photo-1596461404969-9ae70f2830c1",
  anime: "photo-1578632767115-351597cf2477",
  pokemon: "photo-1613771404784-3a5686aa2be3",
  lego: "photo-1585366119957-e9730b6d0f60",
  vinyl: "photo-1483412033650-1015ddeb83d1",
  books: "photo-1512820790803-83ca734da794",
  "book-clubs": "photo-1521123845560-14093637aa7d",
  reading: "photo-1481627834876-b7833e8f5570",
  "creative-writing": "photo-1499750310107-5fef28a66643",
  thrifting: "photo-1441984904996-e0b6ba687e04",
  sneakers: "photo-1552346154-21d32810aba3",
  fashion: "photo-1490481651871-ab68de25d43d",

  // Travel & Adventure
  travel: "photo-1488646953014-85cb44e25828",
  "road-trips": "photo-1469854523086-cc02fe5d8800",
  backpacking: "photo-1527631746610-bca00a040d60",
  skiing: "photo-1551698618-1dfe5d97d256",
  exploration: "photo-1500534623283-312aade485b7",
  makeup: "photo-1522335789203-aabd1fc54bc9",
  nails: "photo-1604654894610-df63bc536371",
  fragrance: "photo-1615634260167-c8cdede054de",
  puzzles: "photo-1611996575749-79a3a250f948",
  "language-learning": "photo-1546410531-bb4caa6b424d",

  // Added with the Corners home: Corners that had no photo of their own. Credits below.
  boxing: "photo-1731955138970-fc88fd48b80f",
  skateboarding: "photo-1659462247462-2d4dd84680aa",
  kayaking: "photo-1746901292452-0cfc287a411d",
  surfing: "photo-1761249571329-69d623df6fae",
  "wild-swimming": "photo-1582617925084-3d1b080dd9ea",
  "sauna-cold-plunge": "photo-1741601274210-14b7ab1ef99c",
  "make-a-beat": "photo-1637759898746-283c2d6c24c5",
  karaoke: "photo-1741594412133-ffd6530482ad",
  "live-music": "photo-1723743809756-d8576dc3fe59",
  choir: "photo-1720186576697-24c1496a07e1",
  pasta: "photo-1447279506476-3faec8071eee",
  trivia: "photo-1558210598-89ba75b1724e",
  improv: "photo-1576724196070-cf259e69503f",
  volunteering: "photo-1599059813005-11265ba4b4ce",
  "d-d": "photo-1677248245750-3a2e0fd341b1",

  // Corner photo pass (Oct 28, 2026): photos for Corners that had none, replacements for broken or off-topic ones. Credits below.
  "life-drawing": "photo-1787725067314-be06d08ac570",
  "walking-clubs": "photo-1597120590849-a1d5a743d155",
  badminton: "photo-1626224583764-f87db24ac4ea",
  skating: "photo-1593029352324-5d8a5230d224",
  "ultimate-frisbee": "photo-1591337819702-5c21810edd47",
  rafting: "photo-1641584495089-5914d85d9bcc",
  mahjong: "photo-1762311413348-d89e9548997d",
  "letter-writing": "photo-1517971071642-34a2d3ecc9cd",
  "city-walks": "photo-1646608220382-4f20ec40b01d",
  "film-clubs": "photo-1485095329183-d0797cdc5676",
  "food-tours": "photo-1760263051323-fcd7da7040b0",
  hyrox: "photo-1779126751404-54acffdb307d",
};

/**
 * Who took each photo added with the Corners home, where it lives, and what it
 * shows. Unsplash License (free, no Unsplash+). Shown as "Photo: {credit} on
 * Unsplash" under the hero of a single Corner page; `alt` is the image's alt text.
 * Older entries in PHOTO have no credit on record and show none.
 */
export const CREDITS: Record<string, { credit: string; source: string; alt: string }> = {
  boxing: { credit: "Lisa Marie Theck", source: "https://unsplash.com/photos/VpAp_3AKIIY", alt: "Woman throwing a punch in boxing gloves at a gym" },
  skateboarding: { credit: "Bobby Thapa", source: "https://unsplash.com/photos/7N1TqEn0aYI", alt: "Skateboarder doing a trick at Venice Beach skate park" },
  kayaking: { credit: "T (@tanyabarrow)", source: "https://unsplash.com/photos/-zDqIMKa7BA", alt: "People kayaking together on a lake" },
  surfing: { credit: "Red Zeppelin", source: "https://unsplash.com/photos/w1IKykb2YmQ", alt: "Surfers riding waves at sunset" },
  "wild-swimming": { credit: "Arisa S.", source: "https://unsplash.com/photos/OiftrDG44JE", alt: "People swimming in a clear natural pool" },
  "sauna-cold-plunge": { credit: "HUUM", source: "https://unsplash.com/photos/S3DQDLWe_Ps", alt: "Two friends laughing together in a steamy sauna" },
  "make-a-beat": { credit: "Veikko Venemies", source: "https://unsplash.com/photos/obU1Dubo3vM", alt: "Producer making music at a studio desk" },
  karaoke: { credit: "Singa Karaoke", source: "https://unsplash.com/photos/4w_8pDze9ys", alt: "Friends in costumes singing karaoke into shared microphones" },
  "live-music": { credit: "Negley Stockman", source: "https://unsplash.com/photos/aYDgO7Hf0B8", alt: "Crowd with hands raised in front of a concert stage" },
  pasta: { credit: "Jorge Zapata", source: "https://unsplash.com/photos/4nXkhLCrkLo", alt: "Hands rolling fresh pasta dough through a machine" },
  trivia: { credit: "Victor Clime", source: "https://unsplash.com/photos/0L-IgR1-3fE", alt: "Friends at a pub bar, drinking and talking" },
  improv: { credit: "Yiran Ding", source: "https://unsplash.com/photos/vtZqNeV_dlA", alt: "Performers on a small blue-lit stage" },
  volunteering: { credit: "Joel Muniz", source: "https://unsplash.com/photos/3k3l2brxmwQ", alt: "Volunteers sorting canned food donations" },
  // Corner photo pass (Oct 28, 2026)
  "life-drawing": { credit: "Vitaly Gariev", source: "https://unsplash.com/photos/brL2-n7XUF8", alt: "Art students painting a seated model in a studio class" },
  "walking-clubs": { credit: "Kitera Dent", source: "https://unsplash.com/photos/jWv1ILisuSc", alt: "A group walking together along a tree-lined path" },
  badminton: { credit: "Muktasim Azlan", source: "https://unsplash.com/photos/rjWfNR_AC5g", alt: "Badminton player jumping to smash a shuttlecock on an indoor court" },
  skating: { credit: "Lukas Schroeder", source: "https://unsplash.com/photos/MTwzYSHnoXE", alt: "People skating at an indoor roller rink" },
  "ultimate-frisbee": { credit: "Stefano Zocca", source: "https://unsplash.com/photos/dG-t92hPCKA", alt: "Players leaping for a disc on a grass field" },
  rafting: { credit: "Chandan Chaurasia", source: "https://unsplash.com/photos/z32bIS5O1KQ", alt: "A group in helmets rafting through river rapids" },
  mahjong: { credit: "Ryo Tanaka", source: "https://unsplash.com/photos/K0pFTjeb4oY", alt: "Four friends playing mahjong at a table" },
  "letter-writing": { credit: "Hannah Olinger", source: "https://unsplash.com/photos/8eSrC43qdro", alt: "A hand writing with a pen in a notebook" },
  "city-walks": { credit: "Etienne Girardet", source: "https://unsplash.com/photos/i7cMcSQXFMw", alt: "A group of people walking together down a city street" },
  "film-clubs": { credit: "Jake Hills", source: "https://unsplash.com/photos/23LET4Hxj_U", alt: "An audience in a dark cinema facing a bright screen" },
  "food-tours": { credit: "Zoshua Colah", source: "https://unsplash.com/photos/KPC-IA1-ZaA", alt: "A street vendor serving pani puri from his stall" },
  hyrox: { credit: "Daan Sonneveld", source: "https://unsplash.com/photos/zrtTvAAANTM", alt: "Two athletes running during a fitness race" },
  crochet: { credit: "Karina L", source: "https://unsplash.com/photos/d1yqso_6tns", alt: "A crochet hook resting on a crocheted piece" },
  "3d-printing": { credit: "Osman Talha Dikyar", source: "https://unsplash.com/photos/NMCABEhN0RE", alt: "A 3D printer making a yellow part with a blue light below" },
  sourdough: { credit: "Vicky Ng", source: "https://unsplash.com/photos/yL9qjDDmmMU", alt: "A homemade sourdough loaf on a wooden table" },
  bbq: { credit: "Mike Kilcoyne", source: "https://unsplash.com/photos/_Mw0_ayYPl0", alt: "Friends cooking together on an outdoor grill" },
  composting: { credit: "Edward Howell", source: "https://unsplash.com/photos/v7G32kVgM84", alt: "A small compost heap in a garden" },
  djing: { credit: "Romina veliz", source: "https://unsplash.com/photos/DGKJzOmjyS4", alt: "Hands mixing music on a DJ controller" },
  embroidery: { credit: "Elio Santos", source: "https://unsplash.com/photos/5ZQn_gWKvLE", alt: "Hands embroidering white fabric with needle and thread" },
  woodworking: { credit: "Craft Kitties", source: "https://unsplash.com/photos/GfYA6q5ESLI", alt: "A woodworker marking a cut line on a board" },
  "paper-crafts": { credit: "Carolina Garcia Tavizon", source: "https://unsplash.com/photos/Ay7Nkvc49ag", alt: "Folded paper origami cranes in bright colours" },
  "model-making": { credit: "Jiří Suchý", source: "https://unsplash.com/photos/y45VwslS_vE", alt: "Small hand-finished miniature figures with dice" },
  drawing: { credit: "Andrés Gómez", source: "https://unsplash.com/photos/RP7cgKNW2-g", alt: "A pencil sketch of a face on white paper" },
  songwriting: { credit: "Adhy Setya", source: "https://unsplash.com/photos/4FN2TwPkbDA", alt: "Writing lyrics by hand on paper" },
  calligraphy: { credit: "Judith Browne", source: "https://unsplash.com/photos/9TucEPaZxok", alt: "Hand-lettered calligraphy on white paper" },
  sculpture: { credit: "Karen Maes", source: "https://unsplash.com/photos/9bnJPZdU_pU", alt: "Hands shaping wet clay" },
  pickleball: { credit: "Alex Saks", source: "https://unsplash.com/photos/KO6QJcddk28", alt: "Two pickleball paddles and balls on a court" },
  antiques: { credit: "Melanie Chan", source: "https://unsplash.com/photos/x-OxyNc-6gc", alt: "A collection of antique objects on display" },
  dance: { credit: "Vitaly Gariev", source: "https://unsplash.com/photos/vPDyN8wmMHQ", alt: "A teacher leading a group dance class in a studio" },
  "trading-cards": { credit: "2H Media", source: "https://unsplash.com/photos/-iRcQ2CrR2Q", alt: "A player looking through a hand of trading cards at a table" },
  "d-d": { credit: "2H Media", source: "https://unsplash.com/photos/_q-eRycFcPM", alt: "A player holding up a die during a D&D game" },
  choir: { credit: "Green Liu", source: "https://unsplash.com/photos/ZaZcvU_WuF8", alt: "A choir singing in a church with a conductor in front" },
  fragrance: { credit: "Ulysse Pointcheval", source: "https://unsplash.com/photos/-j6LLsAehUo", alt: "A clear glass perfume bottle catching soft light" },
};

const SPACE_COVER_HOBBY: Record<string, string> = {
  "food-cooking": "cooking",
  "sports-fitness": "running",
  "art-creative": "painting",
  "crafts-making": "pottery",
  "books-writing": "books",
  "nature-outdoors": "hiking",
  "home-garden": "gardening",
  "gaming-tabletop": "board-games",
  music: "instrument",
  "photography-film": "photography",
  "health-wellness": "yoga",
  "fashion-beauty": "thrifting",
  "tech-building": "electronics",
  "collecting-fandom": "vinyl",
  "travel-adventure": "camping",
};

const UNSPLASH = "https://images.unsplash.com/";

function photoUrl(id: string, width: number) {
  return `${UNSPLASH}${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=${width}`;
}

export function spacePhoto(hobbySlug: string, width = 1200) {
  const subSlug = SPACE_COVER_HOBBY[hobbySlug];
  const id = subSlug ? PHOTO[subSlug] : undefined;
  return id ? photoUrl(id, width) : undefined;
}

/**
 * A photo URL for a hobby, sized for a card. Falls back to the correct parent
 * Space cover so a shelf never shows a hole or an unrelated category image.
 */
export function hobbyPhoto(subSlug: string, hobbySlug?: string, width = 600) {
  const id = PHOTO[subSlug];
  if (id) return photoUrl(id, width);
  return hobbySlug ? spacePhoto(hobbySlug, width) : undefined;
}

export function hasHobbyPhoto(subSlug: string) {
  return subSlug in PHOTO;
}

/** Credit, source page and alt text for a Corner's own photo, when one is on record. */
export function photoCredit(subSlug: string) {
  return CREDITS[subSlug];
}

/** Every photo id in PHOTO, with the Corner slug it belongs to (for the one-photo-per-Corner test). */
export function photoEntries(): [string, string][] {
  return Object.entries(PHOTO);
}
