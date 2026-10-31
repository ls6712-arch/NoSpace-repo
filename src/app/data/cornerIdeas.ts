/**
 * Discover v2 "What could you do?" ideas, one per Corner that has a guide, keyed like
 * `cornerGuides.ts` (`${spaceSlug}/${cornerSlug}`).
 *
 * Values approved by the founder on Oct 31, 2026 (docs/discover-v2-idea-proposals.md).
 * The titles and how lines are still proposals until the founder signs off the copy.
 * The Discover page reads this through `ideasFor()` in lib/ideaMatch.ts.
 *
 * The pills are ceilings. `time` is the smallest pill the idea fits and `spend` the
 * smallest spend pill, so An hour is inside Tonight is inside Weekend, and Free is
 * inside Under $25 is inside Treat me. An idea matches a pill when its own value is at
 * or below the pill's. `who` is the list of Who pills it fits; it is not a ceiling.
 *
 * Treat me is for an idea that means booking a paid class, session, tour or room.
 * Drop-ins and open play stay Under $25. `who` is worked out from the idea, not from the
 * guide: Solo means you can do it on your own (every idea done alone at home has it), A
 * friend means with someone you know, New people means the idea itself puts you with
 * people you do not know.
 *
 * An idea is Corner level and undated, never a specific event or Pursuit. `ideaTitle` is
 * a short verb phrase and `how` is the time plus where, ending in a full stop. Neither
 * mentions a price.
 *
 * Six guides have no idea of their own because they repeat another Corner's (see
 * DUPLICATE_GUIDES). Guides marked adultsOnly stay out of the idea row until age checks
 * exist, like the rest of general browsing.
 */

export type IdeaTime = "hour" | "tonight" | "weekend";
export type IdeaSpend = "free" | "under25" | "treat";
export type IdeaWho = "solo" | "friend" | "new";

export interface CornerIdea {
  /** The smallest time pill that fits. */
  time: IdeaTime;
  /** The smallest spend pill that fits. */
  spend: IdeaSpend;
  /** Every Who pill it fits. */
  who: readonly IdeaWho[];
  ideaTitle: string;
  how: string;
  adultsOnly?: true;
}

/** Guides that repeat another Corner's idea, so they get none: the kept Corner is on the right. */
export const DUPLICATE_GUIDES: Record<string, string> = {
  "food-cooking/home-coffee": "food-cooking/coffee",
  "food-cooking/espresso": "food-cooking/coffee",
  "tech-building/arduino": "tech-building/electronics",
  "books-writing/books": "books-writing/reading",
  "books-writing/creative-writing": "books-writing/writing",
  "collecting-fandom/trading-cards": "gaming-tabletop/trading-cards",
};

export const CORNER_IDEAS: Record<string, CornerIdea> = {
  "food-cooking/cooking": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Cook a recipe you have never made", how: "45 minutes, your kitchen and a short ingredient list." },
  "food-cooking/baking": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Bake a batch of cookies", how: "1 hour, your kitchen and a trusted recipe." },
  "food-cooking/sourdough": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Start a sourdough starter", how: "10 minutes, a jar and flour." },
  "food-cooking/fermentation": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Make quick pickles", how: "15 minutes, a jar, salt and a cucumber." },
  "food-cooking/tea": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Brew a tea two ways", how: "20 minutes, your kitchen and loose-leaf tea." },
  "food-cooking/home-brewing": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Steep a cup of specialty malt", how: "30 minutes, your kitchen and crushed malt.", adultsOnly: true },
  "food-cooking/kombucha": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Brew a jar of kombucha", how: "20 minutes, a jar, sweet tea and a SCOBY." },
  "food-cooking/cocktail-making": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Mix a classic sour", how: "15 minutes, your kitchen, a lemon and sugar.", adultsOnly: true },
  "food-cooking/supper-clubs": { time: "tonight", spend: "under25", who: ["friend"], ideaTitle: "Host dinner for one guest", how: "2 hours, your home and one dish." },
  "food-cooking/coffee": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Make a pour-over", how: "10 minutes, your kitchen and a pour-over setup." },
  "sports-fitness/running": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Run-walk for 15 minutes", how: "15 minutes, any road or path outside." },
  "sports-fitness/run-clubs": { time: "hour", spend: "free", who: ["friend", "new"], ideaTitle: "Go to a run club", how: "1 hour, a local run club's meetup spot." },
  "sports-fitness/cycling": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Ride a bike-share bike", how: "30 minutes, a bike dock and a quiet route." },
  "sports-fitness/pickleball": { time: "hour", spend: "under25", who: ["friend", "new"], ideaTitle: "Join open play at a court", how: "1 hour, a public court." },
  "sports-fitness/padel": { time: "hour", spend: "treat", who: ["friend", "new"], ideaTitle: "Book a beginner padel session", how: "1 hour, a padel court and three others." },
  "sports-fitness/tennis": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Hit against a wall", how: "15 minutes, a practice wall and a racket." },
  "sports-fitness/swimming": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Swim ten laps", how: "45 minutes, a public pool." },
  "sports-fitness/martial-arts": { time: "hour", spend: "treat", who: ["friend", "new"], ideaTitle: "Take a trial class", how: "1 hour, a local gym." },
  "sports-fitness/strength-training": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Learn the goblet squat", how: "20 minutes, one dumbbell at home or the gym." },
  "sports-fitness/volleyball": { time: "hour", spend: "free", who: ["friend", "new"], ideaTitle: "Join a drop-in game", how: "1 hour, a park or gym." },
  "art-creative/drawing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Draw your coffee mug", how: "10 minutes, paper and a pencil." },
  "art-creative/watercolor": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Paint a color chart and a leaf", how: "30 minutes, a small watercolor set and paper." },
  "art-creative/calligraphy": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Practice basic brush pen strokes", how: "10 minutes, a brush pen and paper." },
  "art-creative/theater": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Perform a monologue three times", how: "20 minutes, a quiet room and your phone to record." },
  "crafts-making/knitting": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Cast on and knit a few rows", how: "30 minutes, needles and a ball of yarn." },
  "crafts-making/crochet": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Learn a chain and single crochet", how: "30 minutes, a hook and one ball of yarn." },
  "crafts-making/embroidery": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Stitch your initial", how: "30 minutes, a hoop, thread and a scrap of cotton." },
  "crafts-making/sewing": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Hem a pair of pants by hand", how: "1 hour, a needle, thread and a pair of pants." },
  "crafts-making/woodworking": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Sand and oil a cutting board", how: "1 hour, a workbench, sandpaper and oil." },
  "crafts-making/jewelry-making": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "String a beaded bracelet", how: "30 minutes, beads and cord." },
  "crafts-making/candle-making": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Pour a jar candle", how: "1 hour, soy wax, a jar and a pot." },
  "crafts-making/soap-making": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Melt and pour a soap", how: "45 minutes, a soap base and a mold." },
  "crafts-making/scrapbooking": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Glue three keepsakes onto a page", how: "15 minutes, a notebook, glue and saved tickets." },
  "crafts-making/model-making": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Snap together a beginner kit", how: "1 hour, a model kit and a table." },
  "crafts-making/miniatures": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Sculpt a tiny food item", how: "1 hour, polymer clay and a table." },
  "books-writing/writing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Write 300 words from a prompt", how: "20 minutes, a notebook or laptop." },
  "books-writing/poetry": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Write an eight-line poem about your street", how: "15 minutes, paper and a pen." },
  "books-writing/book-clubs": { time: "hour", spend: "under25", who: ["friend", "new"], ideaTitle: "Read a chapter and send it to a friend", how: "30 minutes, a short book and one friend." },
  "books-writing/language-learning": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Learn ten phrases for ordering food", how: "15 minutes, an app or a phrasebook." },
  "books-writing/reading": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Read 20 pages of a book", how: "30 minutes, a comfortable seat and a book." },
  "nature-outdoors/hiking": { time: "tonight", spend: "free", who: ["solo", "friend"], ideaTitle: "Walk a trail under three miles", how: "2 hours, a trail near home." },
  "nature-outdoors/birdwatching": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Listen for birds in a park", how: "15 minutes, a park and a bird ID app." },
  "nature-outdoors/foraging": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Learn to spot one common edible plant", how: "1 hour, a local park or trail and a field guide." },
  "nature-outdoors/camping": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Pitch a tent", how: "30 minutes, a park or your living room." },
  "nature-outdoors/fishing": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Practice casting", how: "30 minutes, an open park and a practice plug." },
  "home-garden/gardening": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Plant an herb in a pot", how: "15 minutes, a pot, soil and a sunny sill." },
  "home-garden/houseplants": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Propagate a cutting in water", how: "10 minutes, a glass of water and a cutting." },
  "home-garden/vegetable-gardens": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Sow lettuce seeds in a container", how: "20 minutes, a container, soil and seeds." },
  "home-garden/diy": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Fix one small thing", how: "30 minutes, a how-to video and basic tools." },
  "gaming-tabletop/board-games": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Teach friends a 30 minute game", how: "1 hour, a table and a board game." },
  "gaming-tabletop/chess": { time: "hour", spend: "free", who: ["friend", "new"], ideaTitle: "Play chess at a park table", how: "20 minutes, a park with chess tables." },
  "gaming-tabletop/puzzles": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Start a 500 piece puzzle", how: "1 hour, a table and a puzzle." },
  "gaming-tabletop/d-d": { time: "tonight", spend: "free", who: ["friend", "new"], ideaTitle: "Join a beginner one-shot", how: "3 hours, a local game store." },
  "gaming-tabletop/video-games": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Plan a co-op game night", how: "1 hour, a co-op game and a friend." },
  "music/music-production": { time: "hour", spend: "free", who: ["solo"], ideaTitle: "Make a four bar loop", how: "20 minutes, a music app." },
  "music/singing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Warm up and sing a song", how: "15 minutes, a quiet room." },
  "music/guitar": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Learn the G, C and D chords", how: "30 minutes, a guitar." },
  "music/songwriting": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Write a four line chorus", how: "15 minutes, paper and a pen." },
  "music/djing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Practice a beatmatched transition", how: "20 minutes, a DJ app." },
  "photography-film/photography": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Shoot one subject from 20 angles", how: "30 minutes, your phone or a camera." },
  "photography-film/filmmaking": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Shoot a 30 second film in three shots", how: "1 hour, your phone and a friend." },
  "photography-film/film-photography": { time: "weekend", spend: "under25", who: ["solo", "friend"], ideaTitle: "Shoot a roll on a disposable camera", how: "A few evenings, a disposable film camera." },
  "photography-film/video": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Film ten clips and cut a 30 second edit", how: "45 minutes, your phone and an editing app." },
  "health-wellness/yoga": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Do a 15 minute beginner flow", how: "15 minutes, a mat and a video." },
  "health-wellness/pilates": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Do a 15 minute mat video", how: "15 minutes, a mat and a video." },
  "health-wellness/meditation": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Count breaths for ten minutes", how: "10 minutes, a quiet seat." },
  "health-wellness/breathwork": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Try box breathing", how: "5 minutes, a quiet seat." },
  "fashion-beauty/sneakers": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Deep clean a pair of sneakers", how: "30 minutes, a brush, soap and a pair you own." },
  "fashion-beauty/thrifting": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Visit a thrift store with a list", how: "1 hour, a thrift store." },
  "fashion-beauty/makeup": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Recreate a look from a tutorial", how: "30 minutes, your own makeup and a video." },
  "fashion-beauty/nails": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Try a dotted nail design", how: "30 minutes, a bobby pin and nail polish." },
  "fashion-beauty/fragrance": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Sample three scents", how: "30 minutes, a store with testers." },
  "tech-building/3d-printing": { time: "tonight", spend: "free", who: ["solo"], ideaTitle: "Print a downloaded model", how: "2 hours, a library makerspace." },
  "tech-building/electronics": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Blink an LED", how: "45 minutes, a starter kit." },
  "tech-building/drones": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Fly a drone simulator", how: "15 minutes, a laptop or phone." },
  "tech-building/coding": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Build a one page website", how: "1 hour, a laptop." },
  "tech-building/ai-projects": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Plan something real with an AI tool", how: "20 minutes, a laptop or phone." },
  "collecting-fandom/lego": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Build a small set", how: "1 hour, a set or a bin of bricks." },
  "collecting-fandom/vinyl": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Listen to an album on vinyl", how: "1 hour, a record store." },
  "travel-adventure/backpacking": { time: "tonight", spend: "free", who: ["solo", "friend"], ideaTitle: "Walk two miles with a day bag", how: "1 hour, a day bag with the 10 essentials." },
  "travel-adventure/skiing": { time: "hour", spend: "free", who: ["solo"], ideaTitle: "Practice the snowplow stance", how: "15 minutes, floor space at home." },
  "travel-adventure/exploration": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Walk a neighborhood you have never visited", how: "15 minutes, a neighborhood new to you." },
  "art-creative/illustration": { time: "hour", spend: "free", who: ["solo"], ideaTitle: "Illustrate one thing from your day", how: "30 minutes, paper and a pen." },
  "crafts-making/zines": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Fold and fill a mini zine", how: "30 minutes, one sheet of paper and a pen." },
  "crafts-making/upcycling": { time: "hour", spend: "free", who: ["solo"], ideaTitle: "Flip an old T-shirt", how: "1 hour, an old T-shirt and scissors." },
  "crafts-making/pottery": { time: "tonight", spend: "treat", who: ["solo", "friend"], ideaTitle: "Take a beginner wheel class", how: "2 hours, a local studio." },
  "sports-fitness/boxing": { time: "hour", spend: "treat", who: ["friend", "new"], ideaTitle: "Take a beginner boxing class", how: "1 hour, a boxing gym." },
  "sports-fitness/skateboarding": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Practice pushing on a skateboard", how: "30 minutes, a flat quiet path and a helmet." },
  "sports-fitness/soccer": { time: "hour", spend: "under25", who: ["friend", "new"], ideaTitle: "Join a pickup game", how: "1 hour, a local field." },
  "sports-fitness/basketball": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Shoot hoops at a public court", how: "1 hour, a public court." },
  "home-garden/composting": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Start a kitchen scrap bin", how: "30 minutes, a small bin, greens and browns." },
  "nature-outdoors/surfing": { time: "weekend", spend: "treat", who: ["solo", "friend"], ideaTitle: "Take a beginner surf lesson", how: "3 hours, a surf school on the coast." },
  "nature-outdoors/kayaking": { time: "weekend", spend: "treat", who: ["solo", "friend"], ideaTitle: "Take a guided kayak tour", how: "3 hours, calm water and a tour company." },
  "music/choir": { time: "tonight", spend: "free", who: ["friend", "new"], ideaTitle: "Go to an open choir rehearsal", how: "2 hours, a community choir." },
  "music/karaoke": { time: "tonight", spend: "treat", who: ["friend"], ideaTitle: "Book a karaoke room", how: "2 hours, a karaoke venue and a few friends." },
  "music/live-music": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "See a small local gig", how: "3 hours, a small venue." },
  "art-creative/improv": { time: "tonight", spend: "treat", who: ["friend", "new"], ideaTitle: "Join a beginner improv workshop", how: "2 hours, a local workshop." },
  "food-cooking/pasta": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Roll fresh pasta by hand", how: "1 hour, your kitchen, flour and eggs." },
  "health-wellness/sauna-cold-plunge": { time: "tonight", spend: "treat", who: ["friend", "new"], ideaTitle: "Try a sauna or bathhouse session", how: "2 hours, a sauna or bathhouse." },
  "gaming-tabletop/trivia": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "Join a quiz night with a team", how: "2 hours, a bar or café with a quiz night." },
  "travel-adventure/volunteering": { time: "weekend", spend: "free", who: ["friend", "new"], ideaTitle: "Sign up for a volunteer shift", how: "3 hours, a local cause." },
  "home-garden/interior-design": { time: "tonight", spend: "free", who: ["solo"], ideaTitle: "Make a moodboard for one room", how: "2 hours, your room and a few photos." },
  "tech-building/web-design": { time: "hour", spend: "free", who: ["solo"], ideaTitle: "Build a one page personal site", how: "1 hour, a laptop and a simple tool." },
  "home-garden/furniture-flipping": { time: "weekend", spend: "under25", who: ["solo"], ideaTitle: "Sand and repaint a secondhand chair", how: "4 hours, a secondhand chair, sandpaper and paint." },
  "crafts-making/makerspaces": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "Visit a makerspace open night", how: "2 hours, a local makerspace." },
  "food-cooking/bbq": { time: "tonight", spend: "under25", who: ["solo", "friend"], ideaTitle: "Grill over charcoal with friends", how: "2 hours, a park grill or backyard." },
  "art-creative/painting": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Paint a small scene from a photo", how: "1 hour, paints and a small canvas." },
  "art-creative/sculpture": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Shape a figure from air-dry clay", how: "1 hour, air-dry clay and a table." },
  "crafts-making/paper-crafts": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Make a card for someone", how: "30 minutes, paper and scissors." },
  "gaming-tabletop/trading-cards": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "Play a starter deck at a card night", how: "2 hours, a local game store." },
  "fashion-beauty/fashion": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Build three outfits from your closet", how: "30 minutes, your closet." },
  "tech-building/robotics": { time: "weekend", spend: "under25", who: ["solo", "friend"], ideaTitle: "Build a starter robot kit with a friend", how: "4 hours, a robot kit and a friend." },
  "tech-building/game-development": { time: "tonight", spend: "free", who: ["solo"], ideaTitle: "Make a one screen game", how: "2 hours, a laptop and a beginner engine." },
  "collecting-fandom/antiques": { time: "tonight", spend: "under25", who: ["solo", "friend"], ideaTitle: "Pick one piece at a flea market", how: "2 hours, a flea market or antique fair." },
  "collecting-fandom/anime": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Watch a first episode with a friend", how: "30 minutes, a screen and a friend." },
  "travel-adventure/travel": { time: "weekend", spend: "treat", who: ["solo", "friend"], ideaTitle: "Plan a day trip", how: "A full day, a town you have never visited." },
  "travel-adventure/road-trips": { time: "weekend", spend: "treat", who: ["friend"], ideaTitle: "Plan a one day loop", how: "A full day, a car and a crew." },
  "sports-fitness/climbing": { time: "tonight", spend: "treat", who: ["friend", "new"], ideaTitle: "Try an intro bouldering session", how: "90 minutes, a climbing gym." },
  "sports-fitness/dance": { time: "hour", spend: "treat", who: ["friend", "new"], ideaTitle: "Try a salsa, swing or bachata class", how: "1 hour, a dance studio." },
  "nature-outdoors/wild-swimming": { time: "weekend", spend: "under25", who: ["solo", "friend"], ideaTitle: "Find a safe swim spot", how: "2 hours, a known and safe swim spot." },
  "music/make-a-beat": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Make a beat", how: "30 minutes, a beat-making app." },
  "art-creative/life-drawing": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "Go to a drop-in life drawing session", how: "2 hours, a local studio." },
  "travel-adventure/city-walks": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Walk a neighborhood you have never walked", how: "1 hour, a neighborhood new to you." },
  "photography-film/film-clubs": { time: "tonight", spend: "free", who: ["friend", "new"], ideaTitle: "Pick a film and watch it together", how: "3 hours, a screen or cinema and some friends." },
  "food-cooking/food-tours": { time: "tonight", spend: "under25", who: ["solo", "friend"], ideaTitle: "Eat your way down one street", how: "2 hours, a street or market known for food." },
  "gaming-tabletop/mahjong": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Learn the tiles", how: "1 hour, a rules guide and a set." },
  "travel-adventure/rafting": { time: "weekend", spend: "treat", who: ["friend", "new"], ideaTitle: "Pick a beginner river stretch", how: "A full day, a guided trip." },
  "books-writing/letter-writing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Write a letter by hand", how: "30 minutes, paper, a pen and a stamp." },
  "sports-fitness/hyrox": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Learn the eight Hyrox stations", how: "1 hour, a gym." },
  "sports-fitness/walking-clubs": { time: "hour", spend: "free", who: ["friend", "new"], ideaTitle: "Join a walking group", how: "1 hour, a meetup point near you." },
  "sports-fitness/badminton": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Rally with a racket and shuttles", how: "45 minutes, a court or park." },
  "sports-fitness/skating": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Rent skates for a first go", how: "1 hour, a rink." },
  "sports-fitness/ultimate-frisbee": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Learn the backhand throw", how: "30 minutes, a disc and a friend in a park." },
  "sports-fitness/cricket": { time: "hour", spend: "under25", who: ["friend", "new"], ideaTitle: "Ask for a turn at a local game", how: "1 hour, a local ground or park." },
  "gaming-tabletop/carrom": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Play a game of carrom", how: "30 minutes, a board and a friend." },
  "sports-fitness/table-tennis": { time: "hour", spend: "under25", who: ["friend"], ideaTitle: "Rally on a table", how: "30 minutes, a table and a friend." },
  "art-creative/open-mics": { time: "tonight", spend: "under25", who: ["friend", "new"], ideaTitle: "Watch an open mic", how: "2 hours, a local venue." },
  "art-creative/indian-classical-dance": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Watch a recital and pick a style", how: "1 hour, a recital or a video of one." },
  "music/indian-classical-music": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Listen to Carnatic and Hindustani pieces", how: "30 minutes, headphones and two recordings." },
  "music/piano": { time: "hour", spend: "under25", who: ["solo"], ideaTitle: "Pick out a simple tune", how: "20 minutes, a piano or keyboard." },
  "health-wellness/sound-baths": { time: "tonight", spend: "treat", who: ["friend", "new"], ideaTitle: "Book a group sound bath", how: "90 minutes, a studio or hall." },
  "nature-outdoors/stargazing": { time: "hour", spend: "free", who: ["solo", "friend"], ideaTitle: "Look up after dark", how: "10 minutes, a dark spot away from bright lights." },
  "crafts-making/block-printing": { time: "hour", spend: "under25", who: ["solo", "friend"], ideaTitle: "Print a simple shape with a potato", how: "20 minutes, a cut potato, ink and paper." },
};

export function cornerIdea(spaceSlug: string, cornerSlug: string): CornerIdea | undefined {
  return CORNER_IDEAS[`${spaceSlug}/${cornerSlug}`];
}
