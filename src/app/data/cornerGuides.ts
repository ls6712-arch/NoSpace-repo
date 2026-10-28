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
import { isBrowsableCorner } from "./hobbies";

/** What kind of pursuit it is (the library's "Kind of pursuit", Stebbins). */
export type GuideKind =
  | "making" | "skill" | "regular" | "games" | "exploring"
  | "collecting" | "experience" | "project" | "helping";

export interface CornerGuide {
  about: string;
  step: string;
  quick?: boolean;
  order?: number;
  /** Library traits. Facts about the activity itself, never claims about how
   * it will make someone feel (trust rules 2 and 3), so they can drive
   * "what are you in the mood for" filters honestly. */
  kind: GuideKind;
  /** "solo": usually on your own; "together": needs other people; "either". */
  together: "solo" | "together" | "either";
  where: "indoors" | "outdoors" | "either";
  /** True when you can start with what you already have at home. */
  haveIt: boolean;
  /** Library age note (21 and over, or no-money play only): keep out of
   * general browsing until age checks exist. */
  adultsOnly?: boolean;
}

export const CORNER_GUIDES: Record<string, CornerGuide> = {
  "food-cooking/cooking": { about: "Cooking something you’ve never made, from a new cuisine or a new technique.", step: "Pick one recipe with under 8 ingredients and buy them on the way home." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "food-cooking/baking": { about: "Sweet baking from simple cookies up to laminated pastry.", step: "Bake one batch of chocolate chip cookies from a trusted recipe." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "food-cooking/sourdough": { about: "Bread leavened with a starter you keep alive and feed.", step: "Mix flour and water in a jar to begin a starter." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "food-cooking/fermentation": { about: "Preserving vegetables with salt and time.", step: "Salt one sliced cucumber in a jar for quick pickles." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "food-cooking/home-coffee": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "food-cooking/tea": { about: "Exploring loose-leaf teas, brewing styles and origins.", step: "Brew one loose-leaf tea two ways and compare." , kind: "exploring", together: "either", where: "indoors", haveIt: false },
  "food-cooking/espresso": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "food-cooking/home-brewing": { about: "Brewing your own beer from grain or extract.", step: "Steep a cup of crushed specialty malt in hot water and taste the sweet wort." , kind: "making", together: "either", where: "indoors", haveIt: false, adultsOnly: true },
  "food-cooking/kombucha": { about: "Fermenting sweet tea into a fizzy drink with a SCOBY.", step: "Order or borrow a SCOBY and brew one jar of sweet tea." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "food-cooking/cocktail-making": { about: "Mixing classic cocktails and mocktails at home.", step: "Make a classic sour with lemon, sugar and any spirit or tea." , kind: "making", together: "either", where: "indoors", haveIt: false, adultsOnly: true },
  "food-cooking/supper-clubs": { about: "Shared dinners with a rotating host and table of new people.", step: "Cook one dish and invite one person over." , kind: "project", together: "together", where: "indoors", haveIt: false },
  "food-cooking/coffee": { about: "Making coffee at home, from pour-over to espresso.", step: "Make a pour-over and taste it against your usual cup." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "sports-fitness/running": { about: "Running on roads, tracks or trails, alone or in races.", step: "Run-walk for 15 minutes: 1 minute running, 1 minute walking.", quick: true, order: 12 , kind: "skill", together: "either", where: "outdoors", haveIt: true },
  "sports-fitness/run-clubs": { about: "Group runs that end with coffee or brunch.", step: "Find one weekly run club and go once." , kind: "regular", together: "together", where: "outdoors", haveIt: true },
  "sports-fitness/cycling": { about: "Riding for fitness, commuting or long weekend rides.", step: "Ride a bike-share bike for 15 minutes." , kind: "regular", together: "either", where: "outdoors", haveIt: false },
  "sports-fitness/pickleball": { about: "A paddle sport played on a small court, usually in doubles.", step: "Show up at a public court's open play with a borrowed paddle." , kind: "skill", together: "together", where: "either", haveIt: false },
  "sports-fitness/padel": { about: "Doubles racket sport on an enclosed court.", step: "Book a beginner padel session with three others." , kind: "skill", together: "together", where: "either", haveIt: false },
  "sports-fitness/tennis": { about: "Racket sport played in singles or doubles.", step: "Hit against a wall for 15 minutes." , kind: "skill", together: "together", where: "outdoors", haveIt: false },
  "sports-fitness/swimming": { about: "Lap swimming and open water.", step: "Swim 10 lengths at your own pace at a public pool." , kind: "skill", together: "either", where: "indoors", haveIt: false },
  "sports-fitness/martial-arts": { about: "Training in BJJ, karate, muay thai and more.", step: "Ask a local gym about a trial class." , kind: "skill", together: "together", where: "indoors", haveIt: true },
  "sports-fitness/strength-training": { about: "Lifting weights or using resistance to build strength.", step: "Learn the goblet squat with one dumbbell." , kind: "regular", together: "either", where: "indoors", haveIt: false },
  "sports-fitness/volleyball": { about: "Indoor or beach volleyball in teams.", step: "Join a drop-in game at a park or gym." , kind: "skill", together: "together", where: "either", haveIt: true },
  "art-creative/drawing": { about: "Sketching from life or imagination with pencil and paper.", step: "Draw your coffee mug for 10 minutes.", quick: true, order: 2 , kind: "skill", together: "either", where: "either", haveIt: true },
  "art-creative/watercolor": { about: "Painting with transparent, water-based paint.", step: "Paint a color swatch chart, then one leaf." , kind: "skill", together: "either", where: "either", haveIt: false },
  "art-creative/calligraphy": { about: "Writing letters by hand with a brush or nib pen.", step: "Practice 10 minutes of basic strokes with a brush pen." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "art-creative/theater": { about: "Acting, backstage work or musicals with a local group.", step: "Read one monologue aloud three times and record the last." , kind: "skill", together: "together", where: "indoors", haveIt: true },
  "crafts-making/knitting": { about: "Making fabric from yarn with two needles: scarves, hats, sweaters.", step: "Cast on 20 stitches and knit a few rows." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/crochet": { about: "Making fabric and toys with a single hook and yarn.", step: "Learn a chain and single crochet with one ball of yarn." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/embroidery": { about: "Decorative stitching on fabric with needle and thread.", step: "Stitch your initial on a scrap of cotton in a hoop." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/sewing": { about: "Making and altering clothes and home items by hand or machine.", step: "Hem a pair of pants or sew a simple tote by hand." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/woodworking": { about: "Building furniture and objects from wood.", step: "Sand and oil one cutting board blank." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/jewelry-making": { about: "Beading, wire wrapping and making earrings and bracelets.", step: "String one beaded bracelet." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/candle-making": { about: "Pouring scented candles in jars and molds.", step: "Melt soy wax and pour one jar candle." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "crafts-making/soap-making": { about: "Making bar soap by melt-and-pour or cold process.", step: "Melt-and-pour one soap with a dried flower." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "crafts-making/scrapbooking": { about: "Collaging tickets, paper and photos into a handmade book.", step: "Glue three saved receipts or tickets onto a page.", quick: true, order: 6 , kind: "making", together: "either", where: "indoors", haveIt: true },
  "crafts-making/model-making": { about: "Assembling and painting plastic model kits.", step: "Snap together a beginner kit, no glue needed." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "crafts-making/miniatures": { about: "Building tiny rooms, food and objects at small scale.", step: "Make one miniature food item from polymer clay." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "books-writing/writing": { about: "Writing stories, novels and essays.", step: "Write 300 words starting with “The last time I saw her...”", quick: true, order: 25 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "books-writing/poetry": { about: "Reading and writing poems.", step: "Write one 8-line poem about your street.", quick: true, order: 30 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "books-writing/books": { about: "Reading books, alone or with a club.", step: "Read 20 pages of a book you've been meaning to start." , kind: "exploring", together: "either", where: "indoors", haveIt: true },
  "books-writing/book-clubs": { about: "Reading one book together and meeting to talk about it.", step: "Read the first chapter of a short book and send it to one friend to read too." , kind: "exploring", together: "together", where: "indoors", haveIt: false },
  "books-writing/language-learning": { about: "Learning to speak and read a new language.", step: "Learn 10 phrases you’d use ordering food.", quick: true, order: 20 , kind: "exploring", together: "either", where: "indoors", haveIt: true },
  "books-writing/reading": { about: "Reading books, alone or with a club.", step: "Read 20 pages of a book you've been meaning to start." , kind: "exploring", together: "either", where: "indoors", haveIt: true },
  "books-writing/creative-writing": { about: "Writing stories, novels and essays.", step: "Write 300 words starting with “The last time I saw her...”", quick: true, order: 25 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "nature-outdoors/hiking": { about: "Walking trails in nature, from short loops to full days.", step: "Pick a trail under 3 miles within an hour of home." , kind: "regular", together: "either", where: "outdoors", haveIt: true },
  "nature-outdoors/birdwatching": { about: "Spotting and identifying birds.", step: "Open a bird ID app and listen in a park for 15 minutes.", quick: true, order: 14 , kind: "collecting", together: "either", where: "outdoors", haveIt: true },
  "nature-outdoors/foraging": { about: "Identifying and gathering wild plants and mushrooms safely.", step: "Learn to identify one common edible plant in your area." , kind: "regular", together: "together", where: "outdoors", haveIt: true },
  "nature-outdoors/camping": { about: "Sleeping outdoors at campsites.", step: "Pitch a tent in a park or your living room and time yourself." , kind: "regular", together: "together", where: "outdoors", haveIt: false },
  "nature-outdoors/fishing": { about: "Catching fish from shore, pier or boat.", step: "Practice casting with a weighted practice plug in an open park." , kind: "regular", together: "either", where: "outdoors", haveIt: false },
  "home-garden/gardening": { about: "Growing flowers, herbs and food outdoors.", step: "Plant one herb in a pot on a sunny sill." , kind: "regular", together: "either", where: "outdoors", haveIt: false },
  "home-garden/houseplants": { about: "Growing and caring for plants indoors.", step: "Propagate one cutting in a glass of water." , kind: "regular", together: "solo", where: "indoors", haveIt: false },
  "home-garden/vegetable-gardens": { about: "Growing your own vegetables, even on a balcony.", step: "Sow lettuce seeds in one container." , kind: "regular", together: "either", where: "outdoors", haveIt: false },
  "home-garden/diy": { about: "Fixing, painting and improving your home yourself.", step: "Pick one small fix and watch a 5-minute how-to." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "gaming-tabletop/board-games": { about: "Strategy and party games around a table.", step: "Teach friends one 30-minute game." , kind: "games", together: "together", where: "indoors", haveIt: false },
  "gaming-tabletop/chess": { about: "The classic strategy board game, online or over the board.", step: "Play one game against a friend or a chess app.", quick: true, order: 17 , kind: "games", together: "either", where: "indoors", haveIt: true },
  "gaming-tabletop/puzzles": { about: "Assembling puzzles alone or together.", step: "Start a 500-piece puzzle with the edges." , kind: "games", together: "either", where: "indoors", haveIt: false },
  "gaming-tabletop/d-d": { about: "Collaborative storytelling role-playing game.", step: "Join a one-shot beginner session at a game store." , kind: "games", together: "together", where: "indoors", haveIt: true },
  "gaming-tabletop/video-games": { about: "Co-op and multiplayer games played together, online or on one couch.", step: "Pick a co-op game and schedule one session with a friend." , kind: "games", together: "together", where: "indoors", haveIt: false },
  "music/music-production": { about: "Making beats and songs on a laptop.", step: "Make a 4-bar loop in a music app.", quick: true, order: 38 , kind: "skill", together: "solo", where: "indoors", haveIt: true },
  "music/singing": { about: "Training your voice, alone or in a group.", step: "Do a 10-minute warm-up and sing one song.", quick: true, order: 39 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "music/guitar": { about: "Learning chords and songs on acoustic or electric guitar.", step: "Learn the G, C and D chords." , kind: "skill", together: "either", where: "indoors", haveIt: false },
  "music/songwriting": { about: "Writing lyrics and melodies for your own songs.", step: "Write a 4-line chorus about something that happened today.", quick: true, order: 40 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "music/djing": { about: "Mixing tracks together live.", step: "Practice one beatmatched transition in a DJ app.", quick: true, order: 37 , kind: "skill", together: "either", where: "indoors", haveIt: true },
  "photography-film/photography": { about: "Taking photos with any camera or phone.", step: "Take 20 photos of one subject from 20 angles.", quick: true, order: 28 , kind: "skill", together: "either", where: "either", haveIt: true },
  "photography-film/filmmaking": { about: "Writing, shooting and editing short films.", step: "Shoot a 3-shot, 30-second film on your phone.", quick: true, order: 31 , kind: "skill", together: "together", where: "either", haveIt: true },
  "photography-film/film-photography": { about: "Shooting on 35mm or medium-format film.", step: "Buy a disposable film camera and shoot the roll this week." , kind: "skill", together: "either", where: "outdoors", haveIt: false },
  "photography-film/video": { about: "Filming and editing short videos and films.", step: "Film 10 clips of your day and cut a 30-second edit.", quick: true, order: 34 , kind: "skill", together: "either", where: "either", haveIt: true },
  "health-wellness/yoga": { about: "Stretching, strength and breath practice.", step: "Do a 15-minute beginner flow from a video.", quick: true, order: 13 , kind: "regular", together: "either", where: "indoors", haveIt: true },
  "health-wellness/pilates": { about: "Core-focused strength on a mat or reformer.", step: "Do a 15-minute mat Pilates video.", quick: true, order: 11 , kind: "regular", together: "either", where: "indoors", haveIt: true },
  "health-wellness/meditation": { about: "Sitting practices that train attention, such as counting breaths.", step: "Sit for 10 minutes and count breaths to 10, then repeat.", quick: true, order: 43 , kind: "regular", together: "either", where: "indoors", haveIt: true },
  "health-wellness/breathwork": { about: "Structured breathing exercises, such as box breathing.", step: "Try box breathing for 5 minutes." , kind: "experience", together: "either", where: "indoors", haveIt: true },
  "fashion-beauty/sneakers": { about: "Collecting, cleaning and styling sneakers.", step: "Deep-clean one pair you already own." , kind: "collecting", together: "solo", where: "indoors", haveIt: false },
  "fashion-beauty/thrifting": { about: "Hunting for secondhand clothes and objects.", step: "Visit one thrift store with a short list in hand." , kind: "collecting", together: "either", where: "indoors", haveIt: false },
  "fashion-beauty/makeup": { about: "Learning looks and techniques with makeup.", step: "Recreate one look from a tutorial with what you own." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "fashion-beauty/nails": { about: "Painting designs on your nails.", step: "Try one dotted design with a bobby pin." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "fashion-beauty/fragrance": { about: "Exploring and collecting perfumes.", step: "Sample three scents at a store and note which you return to." , kind: "collecting", together: "either", where: "indoors", haveIt: true },
  "tech-building/3d-printing": { about: "Designing and printing objects at home.", step: "Print a downloadable model at a library makerspace." , kind: "making", together: "solo", where: "indoors", haveIt: true },
  "tech-building/electronics": { about: "Building small circuits and gadgets.", step: "Blink an LED with a starter kit." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "tech-building/arduino": { about: "Building small circuits and gadgets.", step: "Blink an LED with a starter kit." , kind: "making", together: "solo", where: "indoors", haveIt: false },
  "tech-building/drones": { about: "Flying camera drones for aerial footage.", step: "Fly a drone simulator for 15 minutes." , kind: "skill", together: "solo", where: "outdoors", haveIt: false },
  "tech-building/coding": { about: "Building apps, sites and tools outside of work.", step: "Build a one-page website about something you love.", quick: true, order: 23 , kind: "making", together: "either", where: "indoors", haveIt: true },
  "tech-building/ai-projects": { about: "Using AI tools and workflows for work and side projects.", step: "Use an AI tool to plan one real thing you’re doing this week.", quick: true, order: 21 , kind: "making", together: "either", where: "indoors", haveIt: true },
  "collecting-fandom/lego": { about: "Building sets and your own designs.", step: "Build one small set or something from a loose bin." , kind: "making", together: "either", where: "indoors", haveIt: false },
  "collecting-fandom/vinyl": { about: "Collecting and listening to records.", step: "Listen to one full album on vinyl at a record store." , kind: "collecting", together: "either", where: "indoors", haveIt: false },
  "travel-adventure/backpacking": { about: "Multi-day hikes carrying everything you need.", step: "Pack a day bag with the 10 essentials and walk 2 miles with it." , kind: "regular", together: "together", where: "outdoors", haveIt: false },
  "travel-adventure/skiing": { about: "Downhill skiing on mountain trails.", step: "Practice the snowplow stance and a balance drill at home for 15 minutes." , kind: "skill", together: "together", where: "outdoors", haveIt: false },
  "travel-adventure/exploration": { about: "Discovering new neighborhoods in your own city.", step: "Walk 15 minutes in a neighborhood you’ve never visited.", quick: true, order: 15 , kind: "experience", together: "either", where: "outdoors", haveIt: true },
  "art-creative/illustration": { about: "Drawing pictures that tell a story or show an idea, on paper or screen.", step: "Draw one thing from your day as a small illustration.", kind: "making", together: "solo", where: "indoors", haveIt: true },
  "crafts-making/zines": { about: "Small, self-published booklets of drawings, writing or photos.", step: "Fold one sheet into an 8-page mini-zine and fill it.", kind: "making", together: "either", where: "indoors", haveIt: true },
  "crafts-making/upcycling": { about: "Turning old clothes and objects into something new.", step: "Pick one old T-shirt or pair of jeans and try one simple flip.", kind: "making", together: "solo", where: "indoors", haveIt: true },
  "crafts-making/pottery": { about: "Shaping clay on a wheel and firing it into pieces you can use.", step: "Book a beginner wheel class at a local studio.", kind: "making", together: "either", where: "indoors", haveIt: false },
  "sports-fitness/boxing": { about: "Learning to punch, move and defend, in a class or a ring.", step: "Try a beginner boxing class and learn the jab and cross.", kind: "skill", together: "together", where: "indoors", haveIt: false },
  "sports-fitness/skateboarding": { about: "Riding a board, from cruising streets to tricks at a skatepark.", step: "Get a board and a helmet and practise pushing on a flat, quiet path.", kind: "skill", together: "either", where: "outdoors", haveIt: false },
  "sports-fitness/soccer": { about: "Football with friends, from 5-a-side to a league.", step: "Join a pickup game or a social 5-a-side league.", kind: "skill", together: "together", where: "outdoors", haveIt: false },
  "sports-fitness/basketball": { about: "Shooting hoops alone or playing pickup at a court.", step: "Shoot hoops at a public court and ask to join the next game.", kind: "skill", together: "either", where: "outdoors", haveIt: false },
  "home-garden/composting": { about: "Turning kitchen and garden scraps into soil.", step: "Start a small bin for kitchen scraps, mixing greens and browns.", kind: "making", together: "solo", where: "outdoors", haveIt: false },
  "nature-outdoors/surfing": { about: "Riding waves, starting on a soft-top board.", step: "Take a beginner lesson with a surf school.", kind: "skill", together: "either", where: "outdoors", haveIt: false },
  "nature-outdoors/kayaking": { about: "Paddling a kayak on calm water, rivers or the sea.", step: "Book a guided kayak tour on calm water.", kind: "experience", together: "either", where: "outdoors", haveIt: false },
  "music/choir": { about: "Singing in a group, from pop to classical.", step: "Find a community choir and go to one open rehearsal.", kind: "regular", together: "together", where: "indoors", haveIt: true },
  "music/karaoke": { about: "Singing along with friends in a private room or at a bar.", step: "Book a karaoke room with a few friends.", kind: "experience", together: "together", where: "indoors", haveIt: false },
  "music/live-music": { about: "Going to gigs, from small local sets to big shows.", step: "Pick one small local gig and go.", kind: "experience", together: "together", where: "indoors", haveIt: false },
  "art-creative/improv": { about: "Making up scenes on the spot with other people.", step: "Join a beginner improv workshop.", kind: "skill", together: "together", where: "indoors", haveIt: false },
  "food-cooking/pasta": { about: "Making fresh pasta by hand from flour and eggs.", step: "Make egg dough by hand, then roll and cut tagliatelle.", kind: "making", together: "either", where: "indoors", haveIt: false },
  "health-wellness/sauna-cold-plunge": { about: "Taking turns in heat and cold, often with friends.", step: "Try a session at a sauna or bathhouse and follow the venue’s safety guidance.", kind: "experience", together: "together", where: "indoors", haveIt: false },
  "gaming-tabletop/trivia": { about: "Team quiz nights at a cafe, bar or online.", step: "Gather a team and join a quiz night.", kind: "games", together: "together", where: "indoors", haveIt: false },
  "travel-adventure/volunteering": { about: "Giving time to a cause alongside other people.", step: "Pick one cause and sign up for a single shift.", kind: "helping", together: "together", where: "either", haveIt: true },
  "home-garden/interior-design": { about: "Styling and changing the rooms you live in.", step: "Make a moodboard for one room and change one corner of it.", kind: "project", together: "solo", where: "indoors", haveIt: true },
  "tech-building/web-design": { about: "Designing and building websites.", step: "Build a one-page personal site with a simple tool.", kind: "making", together: "solo", where: "indoors", haveIt: true },
  "home-garden/furniture-flipping": { about: "Finding old furniture and giving it new life.", step: "Find a secondhand chair, then sand and repaint it.", kind: "project", together: "solo", where: "indoors", haveIt: false },
  "crafts-making/makerspaces": { about: "Shared workshops with tools and people to learn from.", step: "Visit a makerspace on its open night.", kind: "exploring", together: "together", where: "indoors", haveIt: false },
  "food-cooking/bbq": { about: "Cooking over fire or coals, from grilling to slow smoking.", step: "Grill one thing over charcoal with friends.", kind: "making", together: "either", where: "outdoors", haveIt: false },
  "art-creative/painting": { about: "Painting with acrylics, oils or gouache on canvas or paper.", step: "Paint one small scene from a photo you took.", kind: "making", together: "solo", where: "indoors", haveIt: false },
  "art-creative/sculpture": { about: "Shaping clay, wood, stone or found objects into 3D forms.", step: "Shape one small figure from air-dry clay.", kind: "making", together: "solo", where: "indoors", haveIt: false },
  "crafts-making/paper-crafts": { about: "Making things from paper: cards, origami, collage and bound books.", step: "Fold or cut one card for someone.", kind: "making", together: "either", where: "indoors", haveIt: true },
  "gaming-tabletop/trading-cards": { about: "Collecting and playing trading card games.", step: "Learn a starter deck and play one game at a local card night.", kind: "games", together: "together", where: "indoors", haveIt: false },
  // Trading cards sits in two old Spaces and is one Corner; the guide is keyed under both.
  "collecting-fandom/trading-cards": { about: "Collecting and playing trading card games.", step: "Learn a starter deck and play one game at a local card night.", kind: "games", together: "together", where: "indoors", haveIt: false },
  "fashion-beauty/fashion": { about: "Putting outfits together and finding your own style.", step: "Build three outfits from clothes you already own.", kind: "making", together: "either", where: "indoors", haveIt: true },
  "tech-building/robotics": { about: "Building robots that sense and move.", step: "Build a starter robot kit with a friend.", kind: "project", together: "either", where: "indoors", haveIt: false },
  "tech-building/game-development": { about: "Making your own video games.", step: "Make a one-screen game with a beginner engine.", kind: "making", together: "solo", where: "indoors", haveIt: true },
  "collecting-fandom/antiques": { about: "Hunting for and learning about old objects.", step: "Visit a flea market or antique fair and pick one piece to learn about.", kind: "collecting", together: "either", where: "either", haveIt: false },
  "collecting-fandom/anime": { about: "Watching and talking about anime, and the fandom around it.", step: "Watch the first episode of a series with a friend.", kind: "exploring", together: "either", where: "indoors", haveIt: true },
  "travel-adventure/travel": { about: "Planning trips and exploring new places.", step: "Plan a day trip to a town you have never visited.", kind: "experience", together: "either", where: "outdoors", haveIt: false },
  "travel-adventure/road-trips": { about: "Trips by car or bike where the drive is part of it.", step: "Plan a one-day loop with three stops and a crew.", kind: "experience", together: "together", where: "outdoors", haveIt: false },
  // Corners added with the curated layer: the guide holds the description, step 1 and the traits moods.ts reads.
  "sports-fitness/climbing": { about: "Climbing walls and boulders, mostly indoors to start.", step: "Book an intro session at a bouldering gym", kind: "skill", together: "together", where: "either", haveIt: false },
  "sports-fitness/dance": { about: "Dancing with other people, from salsa and swing to Bollywood and hip-hop.", step: "Try salsa, swing or bachata", kind: "skill", together: "together", where: "either", haveIt: false },
  "nature-outdoors/wild-swimming": { about: "Swimming in lakes, rivers and the sea instead of a pool.", step: "Find a safe, known swim spot", kind: "experience", together: "either", where: "outdoors", haveIt: false },
  "music/make-a-beat": { about: "Building a beat from drums, samples and loops on a laptop or phone.", step: "Open a beat-making app", kind: "making", together: "solo", where: "indoors", haveIt: false },
  "art-creative/life-drawing": { about: "Drawing a live model in a group session.", step: "Find a drop-in life drawing session near you", kind: "skill", together: "together", where: "either", haveIt: false },
  "travel-adventure/city-walks": { about: "Exploring neighbourhoods on foot, alone or on a guided walk.", step: "Pick a neighbourhood you have never walked", kind: "exploring", together: "either", where: "outdoors", haveIt: true },
  "photography-film/film-clubs": { about: "Watching films together and talking about them after.", step: "Pick a film and a place to watch it together", kind: "exploring", together: "together", where: "either", haveIt: true },
  "food-cooking/food-tours": { about: "Eating your way through a street, market or neighbourhood.", step: "Pick one street or market known for food", kind: "exploring", together: "either", where: "outdoors", haveIt: false },
  "gaming-tabletop/mahjong": { about: "A tile game for four players, with many regional styles.", step: "Learn the tiles with a rules guide", kind: "games", together: "together", where: "indoors", haveIt: false },
  "travel-adventure/rafting": { about: "Paddling a raft down a river with a guide and a crew.", step: "Pick a beginner-graded stretch of river", kind: "experience", together: "together", where: "outdoors", haveIt: false },
  "books-writing/letter-writing": { about: "Handwritten letters, stationery and pen pals.", step: "Write one letter by hand to someone who would love it", kind: "making", together: "either", where: "indoors", haveIt: true },
  "sports-fitness/hyrox": { about: "A fitness race of running and gym stations, done alone, in pairs or in relays.", step: "Learn the eight stations and the run between each", kind: "regular", together: "together", where: "either", haveIt: false },
  "sports-fitness/walking-clubs": { about: "Group walks at a talking pace, in parks, on promenades and on trails.", step: "Find a walking group that meets near you", kind: "regular", together: "together", where: "outdoors", haveIt: true },
  "sports-fitness/badminton": { about: "Fast racket games on an indoor court, usually played as doubles.", step: "Borrow or buy a racket and shuttles", kind: "skill", together: "together", where: "either", haveIt: false },
  "sports-fitness/skating": { about: "Roller and ice skating, from rink laps to group skates.", step: "Rent skates at a rink for your first go", kind: "skill", together: "either", where: "either", haveIt: false },
  "sports-fitness/ultimate-frisbee": { about: "A team game with a disc where players call their own fouls.", step: "Learn the backhand throw with a friend", kind: "skill", together: "together", where: "outdoors", haveIt: false },
};

export function cornerGuide(spaceSlug: string, cornerSlug: string): CornerGuide | undefined {
  return CORNER_GUIDES[`${spaceSlug}/${cornerSlug}`];
}

/** Corners whose first step fits in about 15 minutes, in the library's order. */
export function quickGuides(): { spaceSlug: string; cornerSlug: string; guide: CornerGuide }[] {
  return Object.entries(CORNER_GUIDES)
    .filter(([key, g]) => g.quick && isBrowsableCorner(key.split("/")[0], key.split("/")[1]))
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999))
    // Two Corners can share one library entry (Writing, Creative writing);
    // the row shows each step once.
    .filter(([, g], i, all) => all.findIndex(([, o]) => o.step === g.step) === i)
    .map(([key, guide]) => {
      const [spaceSlug, cornerSlug] = key.split("/");
      return { spaceSlug, cornerSlug, guide };
    });
}
