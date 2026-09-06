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
  crochet: "photo-1615647665602-e2e5b8e9f6ba",
  embroidery: "photo-1606722590583-6951b5ea92ad",
  sewing: "photo-1594633312681-425c7b97ccd1",
  woodworking: "photo-1588854337221-4cf9fa96059c",
  "jewelry-making": "photo-1611652022419-a9419f74343d",
  "candle-making": "photo-1624479163091-3c000402218d",
  "soap-making": "photo-1600857544200-b2f666a9a2ec",
  "furniture-flipping": "photo-1503602642458-232111445657",
  restoration: "photo-1513519245088-0e12902e5a38",
  upcycling: "photo-1532996122724-e3c354a0b15b",
  "paper-crafts": "photo-1499744937866-d7e566a20a61",
  zines: "photo-1519682337058-a94d519337bc",
  scrapbooking: "photo-1544716278-ca5e3f4abd8c",

  // Maker Lab
  "3d-printing": "photo-1631545806609-946d4f37b2a1",
  cad: "photo-1581092160562-40aa08e78837",
  "laser-cutting": "photo-1565043666747-69f6646db940",
  cnc: "photo-1518709594023-6eab9bab7b23",
  electronics: "photo-1553406830-ef2513450d76",
  arduino: "photo-1608564697071-ddf911d81370",
  "raspberry-pi": "photo-1587202372775-e229f172b9d7",
  robotics: "photo-1485827404703-89b55fcc595e",
  drones: "photo-1473968512647-3e447244af8f",
  "model-making": "photo-1595429035839-c99c298ffdde",
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
  dance: "photo-1508700115892-45ecd05ae2ad",
  pickleball: "photo-1626224583764-f87db24ac4ea",
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
  sourdough: "photo-1585478259715-876acc5be8eb",
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
  bbq: "photo-1529692236671-f1dc5f60b3e3",

  // Rooted & Wild
  gardening: "photo-1416879595882-3373a0480b5b",
  houseplants: "photo-1485955900006-10f4d324d411",
  "vegetable-gardens": "photo-1595855759920-86582396756a",
  "native-plants": "photo-1470137237906-d8a4f71e1966",
  composting: "photo-1580412356030-1a3e1f0d2b3a",
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
  drawing: "photo-1503454537195-1dcabb73ffb9",
  watercolor: "photo-1596548438137-d51ea5c83ca5",
  photography: "photo-1502920917128-1aa500764cbd",
  filmmaking: "photo-1485846234645-a62644f84728",
  "film-photography": "photo-1516035069371-29a1b244cc32",
  video: "photo-1492724441997-5dc865305da7",
  "music-production": "photo-1598488035139-bdbb2231ce04",
  instrument: "photo-1510915361894-db8b60106cb1",
  singing: "photo-1516280440614-37939bbacd81",
  guitar: "photo-1525201548942-d8732f6617a0",
  songwriting: "photo-1493225457124-a3eb161ffa5f",
  djing: "photo-1571266028243-d220c9c3b0e3",
  writing: "photo-1455390582262-044cdead277a",
  poetry: "photo-1474932430478-367dbb6832c1",
  journaling: "photo-1517842645767-c639042777db",
  calligraphy: "photo-1607190074257-dd4b7af0309f",
  theater: "photo-1503095396549-807759245b35",
  illustration: "photo-1547891654-e66ed7ebb968",
  sculpture: "photo-1561214115-f2f134cc4912",

  // The Rabbit Hole
  "board-games": "photo-1610890716171-6b1bb98ffd09",
  chess: "photo-1529699211952-734e80c4d42b",
  "tabletop-rpgs": "photo-1614682835402-06e3a1f0f2c4",
  "d&d": "photo-1511512578047-dfb367046420",
  "video-games": "photo-1542751371-adc38448a05e",
  "trading-cards": "photo-1699898016940-ac6892b79171",
  antiques: "photo-1567016432779-094069958ea5",
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
  fragrance: "photo-1541643600914-78b084683601",
  puzzles: "photo-1611996575749-79a3a250f948",
  "language-learning": "photo-1546410531-bb4caa6b424d",
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
