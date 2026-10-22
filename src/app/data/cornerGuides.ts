/**
 * One plain description and one concrete first step for each built-in
 * Corner, from the Soosh activity library (docs/activity-library, v6,
 * "App-ready" tab). Keyed by `${spaceSlug}/${cornerSlug}` because a Corner
 * slug is only unique inside its own Space.
 *
 * Trust rules (claude/trust-rules-and-categories.md): a first step is a
 * suggestion, never a promise; nothing here claims a result or a time to
 * get good. `quick` marks steps that fit in about 15 minutes with what most
 * people already have; `order` is the library's own 15-minute ordering.
 *
 * Corners without an entry simply show no guide. Generated once from the
 * library; edit here directly from now on.
 */
export interface CornerGuide {
  about: string;
  step: string;
  quick?: boolean;
  order?: number;
}

export const CORNER_GUIDES: Record<string, CornerGuide> = {
  "food-cooking/cooking": { about: "Cooking something you’ve never made, from a new cuisine or a new technique.", step: "Pick one recipe with under 8 ingredients and buy them on the way home." },
  "food-cooking/baking": { about: "Sweet baking from simple cookies up to laminated pastry.", step: "Bake one batch of chocolate chip cookies from a trusted recipe." },
  "food-cooking/sourdough": { about: "Bread leavened with a starter you keep alive and feed.", step: "Mix flour and water in a jar to begin a starter." },
  "food-cooking/fermentation": { about: "Preserving vegetables with salt and time.", step: "Salt one sliced cucumber in a jar for quick pickles." },
  "food-cooking/home-coffee": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." },
  "food-cooking/tea": { about: "Exploring loose-leaf teas, brewing styles and origins.", step: "Brew one loose-leaf tea two ways and compare." },
  "food-cooking/espresso": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." },
  "food-cooking/home-brewing": { about: "Brewing your own beer from grain or extract.", step: "Steep a cup of crushed specialty malt in hot water and taste the sweet wort." },
  "food-cooking/kombucha": { about: "Fermenting sweet tea into a fizzy drink with a SCOBY.", step: "Order or borrow a SCOBY and brew one jar of sweet tea." },
  "food-cooking/cocktail-making": { about: "Mixing classic cocktails and mocktails at home.", step: "Make a classic sour with lemon, sugar and any spirit or tea." },
  "food-cooking/supper-clubs": { about: "Shared dinners with a rotating host and table of new people.", step: "Cook one dish and invite one person over." },
  "food-cooking/coffee": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." },
  "sports-fitness/running": { about: "Running on roads, tracks or trails, alone or in races.", step: "Run-walk for 15 minutes: 1 minute running, 1 minute walking.", quick: true, order: 12 },
  "sports-fitness/run-clubs": { about: "Group runs that end with coffee or brunch.", step: "Find one weekly run club and go once." },
  "sports-fitness/cycling": { about: "Riding for fitness, commuting or long weekend rides.", step: "Ride a bike-share bike for 15 minutes." },
  "sports-fitness/pickleball": { about: "A paddle sport played on a small court, usually in doubles.", step: "Show up at a public court's open play with a borrowed paddle." },
  "sports-fitness/padel": { about: "Doubles racket sport on an enclosed court.", step: "Book a beginner padel session with three others." },
  "sports-fitness/tennis": { about: "Racket sport played in singles or doubles.", step: "Hit against a wall for 15 minutes." },
  "sports-fitness/swimming": { about: "Lap swimming and open water.", step: "Swim 10 lengths at your own pace at a public pool." },
  "sports-fitness/martial-arts": { about: "Training in BJJ, karate, muay thai and more.", step: "Ask a local gym about a trial class." },
  "sports-fitness/strength-training": { about: "Lifting weights or using resistance to build strength.", step: "Learn the goblet squat with one dumbbell." },
  "sports-fitness/volleyball": { about: "Indoor or beach volleyball in teams.", step: "Join a drop-in game at a park or gym." },
  "art-creative/drawing": { about: "Sketching from life or imagination with pencil and paper.", step: "Draw your coffee mug for 10 minutes.", quick: true, order: 2 },
  "art-creative/watercolor": { about: "Painting with transparent, water-based paint.", step: "Paint a color swatch chart, then one leaf." },
  "art-creative/calligraphy": { about: "Writing letters by hand with a brush or nib pen.", step: "Practice 10 minutes of basic strokes with a brush pen." },
  "art-creative/theater": { about: "Acting, backstage work or musicals with a local group.", step: "Read one monologue aloud three times and record the last." },
  "crafts-making/knitting": { about: "Making fabric from yarn with two needles: scarves, hats, sweaters.", step: "Cast on 20 stitches and knit a few rows." },
  "crafts-making/crochet": { about: "Making fabric and toys with a single hook and yarn.", step: "Learn a chain and single crochet with one ball of yarn." },
  "crafts-making/embroidery": { about: "Decorative stitching on fabric with needle and thread.", step: "Stitch your initial on a scrap of cotton in a hoop." },
  "crafts-making/sewing": { about: "Making and altering clothes and home items by hand or machine.", step: "Hem a pair of pants or sew a simple tote by hand." },
  "crafts-making/woodworking": { about: "Building furniture and objects from wood.", step: "Sand and oil one cutting board blank." },
  "crafts-making/jewelry-making": { about: "Beading, wire wrapping and making earrings and bracelets.", step: "String one beaded bracelet." },
  "crafts-making/candle-making": { about: "Pouring scented candles in jars and molds.", step: "Melt soy wax and pour one jar candle." },
  "crafts-making/soap-making": { about: "Making bar soap by melt-and-pour or cold process.", step: "Melt-and-pour one soap with a dried flower." },
  "crafts-making/scrapbooking": { about: "Collaging tickets, paper and photos into a handmade book.", step: "Glue three saved receipts or tickets onto a page.", quick: true, order: 6 },
  "crafts-making/model-making": { about: "Assembling and painting plastic model kits.", step: "Snap together a beginner kit, no glue needed." },
  "crafts-making/miniatures": { about: "Building tiny rooms, food and objects at small scale.", step: "Make one miniature food item from polymer clay." },
  "books-writing/writing": { about: "Writing stories, novels and essays.", step: "Write 300 words starting with “The last time I saw her...”", quick: true, order: 25 },
  "books-writing/poetry": { about: "Reading and writing poems.", step: "Write one 8-line poem about your street.", quick: true, order: 30 },
  "books-writing/books": { about: "Reading books, alone or with a club.", step: "Read 20 pages of a book you've been meaning to start." },
  "books-writing/book-clubs": { about: "Reading one book together and meeting to talk about it.", step: "Read the first chapter of a short book and send it to one friend to read too." },
  "books-writing/language-learning": { about: "Learning to speak and read a new language.", step: "Learn 10 phrases you’d use ordering food.", quick: true, order: 20 },
  "books-writing/reading": { about: "Reading books, alone or with a club.", step: "Read 20 pages of a book you've been meaning to start." },
  "books-writing/creative-writing": { about: "Writing stories, novels and essays.", step: "Write 300 words starting with “The last time I saw her...”", quick: true, order: 25 },
  "nature-outdoors/hiking": { about: "Walking trails in nature, from short loops to full days.", step: "Pick a trail under 3 miles within an hour of home." },
  "nature-outdoors/birdwatching": { about: "Spotting and identifying birds.", step: "Open a bird ID app and listen in a park for 15 minutes.", quick: true, order: 14 },
  "nature-outdoors/foraging": { about: "Identifying and gathering wild plants and mushrooms safely.", step: "Learn to identify one common edible plant in your area." },
  "nature-outdoors/camping": { about: "Sleeping outdoors at campsites.", step: "Pitch a tent in a park or your living room and time yourself." },
  "nature-outdoors/fishing": { about: "Catching fish from shore, pier or boat.", step: "Practice casting with a weighted practice plug in an open park." },
  "home-garden/gardening": { about: "Growing flowers, herbs and food outdoors.", step: "Plant one herb in a pot on a sunny sill." },
  "home-garden/houseplants": { about: "Growing and caring for plants indoors.", step: "Propagate one cutting in a glass of water." },
  "home-garden/vegetable-gardens": { about: "Growing your own vegetables, even on a balcony.", step: "Sow lettuce seeds in one container." },
  "home-garden/diy": { about: "Fixing, painting and improving your home yourself.", step: "Pick one small fix and watch a 5-minute how-to." },
  "gaming-tabletop/board-games": { about: "Strategy and party games around a table.", step: "Teach friends one 30-minute game." },
  "gaming-tabletop/chess": { about: "The classic strategy board game, online or over the board.", step: "Play one game against a friend or a chess app.", quick: true, order: 17 },
  "gaming-tabletop/puzzles": { about: "Assembling puzzles alone or together.", step: "Start a 500-piece puzzle with the edges." },
  "gaming-tabletop/d-d": { about: "Collaborative storytelling role-playing game.", step: "Join a one-shot beginner session at a game store." },
  "gaming-tabletop/video-games": { about: "Co-op and multiplayer games played together, online or on one couch.", step: "Pick a co-op game and schedule one session with a friend." },
  "music/music-production": { about: "Making beats and songs on a laptop.", step: "Make a 4-bar loop in a music app.", quick: true, order: 38 },
  "music/singing": { about: "Training your voice, alone or in a group.", step: "Do a 10-minute warm-up and sing one song.", quick: true, order: 39 },
  "music/guitar": { about: "Learning chords and songs on acoustic or electric guitar.", step: "Learn the G, C and D chords." },
  "music/songwriting": { about: "Writing lyrics and melodies for your own songs.", step: "Write a 4-line chorus about something that happened today.", quick: true, order: 40 },
  "music/djing": { about: "Mixing tracks together live.", step: "Practice one beatmatched transition in a DJ app.", quick: true, order: 37 },
  "photography-film/photography": { about: "Taking photos with any camera or phone.", step: "Take 20 photos of one subject from 20 angles.", quick: true, order: 28 },
  "photography-film/filmmaking": { about: "Writing, shooting and editing short films.", step: "Shoot a 3-shot, 30-second film on your phone.", quick: true, order: 31 },
  "photography-film/film-photography": { about: "Shooting on 35mm or medium-format film.", step: "Buy a disposable film camera and shoot the roll this week." },
  "photography-film/video": { about: "Filming and editing short videos and films.", step: "Film 10 clips of your day and cut a 30-second edit.", quick: true, order: 34 },
  "health-wellness/yoga": { about: "Stretching, strength and breath practice.", step: "Do a 15-minute beginner flow from a video.", quick: true, order: 13 },
  "health-wellness/pilates": { about: "Core-focused strength on a mat or reformer.", step: "Do a 15-minute mat Pilates video.", quick: true, order: 11 },
  "health-wellness/meditation": { about: "Sitting practices that train attention, such as counting breaths.", step: "Sit for 10 minutes and count breaths to 10, then repeat.", quick: true, order: 43 },
  "health-wellness/breathwork": { about: "Structured breathing exercises, such as box breathing.", step: "Try box breathing for 5 minutes." },
  "fashion-beauty/sneakers": { about: "Collecting, cleaning and styling sneakers.", step: "Deep-clean one pair you already own." },
  "fashion-beauty/thrifting": { about: "Hunting for secondhand clothes and objects.", step: "Visit one thrift store with a budget you set before you go." },
  "fashion-beauty/makeup": { about: "Learning looks and techniques with makeup.", step: "Recreate one look from a tutorial with what you own." },
  "fashion-beauty/nails": { about: "Painting designs on your nails.", step: "Try one dotted design with a bobby pin." },
  "fashion-beauty/fragrance": { about: "Exploring and collecting perfumes.", step: "Sample three scents at a store and note which you return to." },
  "tech-building/3d-printing": { about: "Designing and printing objects at home.", step: "Print a downloadable model at a library makerspace." },
  "tech-building/electronics": { about: "Building small circuits and gadgets.", step: "Blink an LED with a starter kit." },
  "tech-building/arduino": { about: "Building small circuits and gadgets.", step: "Blink an LED with a starter kit." },
  "tech-building/drones": { about: "Flying camera drones for aerial footage.", step: "Fly a drone simulator for 15 minutes." },
  "tech-building/coding": { about: "Building apps, sites and tools outside of work.", step: "Build a one-page website about something you love.", quick: true, order: 23 },
  "tech-building/ai-projects": { about: "Using AI tools and workflows for work and side projects.", step: "Use an AI tool to plan one real thing you’re doing this week.", quick: true, order: 21 },
  "collecting-fandom/lego": { about: "Building sets and your own designs.", step: "Build one small set or something from a loose bin." },
  "collecting-fandom/vinyl": { about: "Collecting and listening to records.", step: "Listen to one full album on vinyl at a record store." },
  "travel-adventure/backpacking": { about: "Multi-day hikes carrying everything you need.", step: "Pack a day bag with the 10 essentials and walk 2 miles with it." },
  "travel-adventure/skiing": { about: "Downhill skiing on mountain trails.", step: "Practice the snowplow stance and a balance drill at home for 15 minutes." },
  "travel-adventure/exploration": { about: "Discovering new neighborhoods in your own city.", step: "Walk 15 minutes in a neighborhood you’ve never visited.", quick: true, order: 15 },
};

export function cornerGuide(spaceSlug: string, cornerSlug: string): CornerGuide | undefined {
  return CORNER_GUIDES[`${spaceSlug}/${cornerSlug}`];
}

/** Corners whose first step fits in about 15 minutes, in the library's order. */
export function quickGuides(): { spaceSlug: string; cornerSlug: string; guide: CornerGuide }[] {
  return Object.entries(CORNER_GUIDES)
    .filter(([, g]) => g.quick)
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999))
    // Two Corners can share one library entry (Writing, Creative writing);
    // the row shows each step once.
    .filter(([, g], i, all) => all.findIndex(([, o]) => o.step === g.step) === i)
    .map(([key, guide]) => {
      const [spaceSlug, cornerSlug] = key.split("/");
      return { spaceSlug, cornerSlug, guide };
    });
}
