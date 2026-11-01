/**
 * "What you'll need" and the steps after the first one, for the guided Corners
 * that curatedCorners.ts does not cover. Read by the Start page after
 * curatedCorners.ts. Keyed `${spaceSlug}/${cornerSlug}`, the same as cornerGuides.ts.
 *
 * Trust rules (docs/trust-rules-and-categories.md): plain facts only (gear,
 * place, people). No prices or cost words. No claims about results, health or
 * feelings. Steps are suggestions. The guide's own step is step 1 and is not
 * repeated here.
 *
 * Food and drink Corners where the person picks the dish or the drink keep
 * their needs generic on purpose; the Start page lets them edit the list.
 *
 * Order: Corners Home can suggest at home first (food first, then the rest),
 * then the guided Corners that are outdoors or with other people.
 * Drafted by Claude Code, to be edited by the founder before merge.
 */
export interface CornerPrep {
  /** 3 to 5. */
  needs: string[];
  /** 2 to 3, after the guide step. */
  steps: string[];
}

const p = (needs: string[], steps: string[]): CornerPrep => ({ needs, steps });

export const CORNER_PREP: Record<string, CornerPrep> = {
  // ── Food and drink, at home ──
  "food-cooking/cooking": p(["The ingredients for one recipe", "A pan and a knife", "A chopping board", "A friend to cook with, if you like"], ["Read the recipe through once before you start", "Set out everything on the counter", "Taste as you go and adjust"]),
  "food-cooking/baking": p(["A recipe you trust", "The ingredients, weighed or measured", "A baking tray or tin", "An oven", "A friend to bake with, if you like"], ["Heat the oven while you mix", "Follow the recipe's times and temperatures", "Let it cool before you cut or taste"]),
  "food-cooking/home-coffee": p(["Coffee beans or grounds", "A way to heat water", "A brewer or a filter and cup", "A mug"], ["Heat the water and rinse the filter", "Pour in slow circles", "Taste it next to your usual cup"]),
  "food-cooking/tea": p(["Two or three loose-leaf teas", "A kettle", "A strainer or infuser", "Two cups"], ["Check the leaf's suggested water and time", "Brew the same tea two ways", "Write down what you notice in each cup"]),
  "food-cooking/espresso": p(["Coffee beans or grounds", "An espresso machine or a stovetop pot", "A grinder, if you grind your own", "A small cup"], ["Read how your machine or pot works", "Make a small cup and note how long it took", "Change one thing and make another"]),
  "food-cooking/home-brewing": p(["Brewing equipment or a starter kit", "Grain or extract", "A clean container", "A thermometer", "A recipe"], ["Clean everything that touches the brew", "Follow the recipe's temperatures and times", "Keep notes for next time"]),
  "food-cooking/kombucha": p(["A SCOBY", "Tea and sugar", "A clean glass jar", "A cloth cover and a band", "A spot out of direct sun"], ["Wash your hands and the jar well", "Cover the jar with the cloth", "Taste a little each day until it suits you"]),
  "food-cooking/cocktail-making": p(["A recipe", "The drinks and mixers it calls for", "A shaker or a jar with a lid", "Ice", "A glass"], ["Measure each part before you pour", "Shake or stir for the time the recipe says", "Make a non-alcoholic version if you like"]),
  "food-cooking/coffee": p(["Coffee beans or grounds", "A way to heat water", "A brewer or a filter and cup", "A mug"], ["Heat the water and rinse the filter", "Pour in slow circles", "Taste it next to your usual cup"]),
  // ── Making, at home ──
  "art-creative/watercolor": p(["Watercolor paints", "A brush or two", "Watercolor paper", "A jar of water", "A paper towel"], ["Wet the brush and pick up a little paint", "Try light and dark washes on a scrap", "Paint one leaf from life"]),
  "art-creative/calligraphy": p(["A brush pen or a nib pen and ink", "Smooth paper", "A guide sheet of basic strokes", "A flat surface"], ["Hold the pen at a steady angle", "Copy each stroke slowly", "Write your name when you are ready"]),
  "art-creative/illustration": p(["Paper or a sketchbook", "A pencil and a pen", "One thing from your day to draw", "A flat surface"], ["Sketch it lightly in pencil", "Go over the lines you like in pen", "Add a few colors if you have them"]),
  "art-creative/painting": p(["Paints", "A few brushes", "Canvas, board or thick paper", "A photo to paint from", "Water or a rag"], ["Sketch the big shapes first", "Block in the main colors", "Add small details last"]),
  "art-creative/sculpture": p(["Air-dry clay", "A small cup of water", "A smooth work surface", "A toothpick or a butter knife"], ["Roll the clay into a ball first", "Pinch and press the shape out", "Leave it to dry as the pack says"]),
  "crafts-making/knitting": p(["Yarn", "A pair of knitting needles", "Scissors", "A video or guide for casting on"], ["Cast on the first row", "Knit a few rows slowly", "Count your stitches now and then"]),
  "crafts-making/crochet": p(["Yarn", "A crochet hook that suits the yarn", "Scissors", "A video or guide for the chain stitch"], ["Make a slip knot", "Chain a short row", "Work single crochet back along it"]),
  "crafts-making/embroidery": p(["Embroidery floss", "A needle", "A hoop", "A scrap of cotton fabric", "Small scissors"], ["Pull the fabric tight in the hoop", "Thread the needle with a short length", "Stitch a simple outline first"]),
  "crafts-making/sewing": p(["Needle and thread", "Fabric or the item to mend", "Pins", "Scissors", "A tape measure"], ["Pin the fabric where you will stitch", "Sew small, even stitches", "Tie off the thread and trim it"]),
  "crafts-making/jewelry-making": p(["Beads", "Stretch cord or string", "Scissors", "A small tray for the beads"], ["Lay the beads out in the order you like", "Thread them onto the cord", "Tie a secure knot and trim the ends"]),
  "crafts-making/candle-making": p(["Wax", "A wick", "A heatproof jar", "A pot for melting", "A thermometer"], ["Set the wick in the jar", "Melt the wax gently in a pot", "Pour and leave it undisturbed to set"]),
  "crafts-making/soap-making": p(["Melt-and-pour soap base", "A mold", "A microwave-safe jug", "A dried flower or two", "A knife"], ["Cut the base into small pieces", "Melt it and pour into the mold", "Press in the flower and let it set"]),
  "crafts-making/scrapbooking": p(["A notebook or blank pages", "Glue or tape", "Scissors", "Receipts, tickets or photos you saved"], ["Sort what you saved into a rough order", "Try the layout before you glue", "Add a few words under each item"]),
  "crafts-making/model-making": p(["A beginner model kit", "A clear table", "Small snips or scissors", "Good light"], ["Check the parts against the list", "Follow the instruction sheet in order", "Set it somewhere you can see it"]),
  "crafts-making/miniatures": p(["Polymer clay", "A work surface", "A toothpick for details", "An oven or the way your clay sets"], ["Shape the main form first", "Add small details with the toothpick", "Set it the way the pack says"]),
  "crafts-making/zines": p(["A sheet of paper", "Scissors", "A pen or markers", "Glue or tape if you want to add cut-outs"], ["Fold the sheet to make eight pages", "Plan what goes on each page", "Fill the pages and fold it up"]),
  "crafts-making/upcycling": p(["An old T-shirt or pair of jeans", "Scissors", "Needle and thread or fabric glue", "A video or guide for one simple idea"], ["Lay the piece flat and decide what to make", "Cut only once you are sure", "Stitch or glue the edges"]),
  "crafts-making/paper-crafts": p(["Paper or card", "Scissors", "Glue or tape", "A pen", "A ruler"], ["Fold the card in half", "Cut or fold the shape you want", "Write a message inside"]),
  "tech-building/3d-printing": p(["A model file to print", "Access to a 3D printer", "A way to carry the file"], ["Check the printer's open hours", "Ask staff how to load the file", "Take the print off gently when it is done"]),
  "tech-building/electronics": p(["A starter kit with an LED and a battery", "Jumper wires", "A small breadboard", "The kit's guide"], ["Lay out the parts from the guide", "Wire the LED the way the guide shows", "Switch it on and check the wiring"]),
  "tech-building/arduino": p(["An Arduino starter kit", "A USB cable", "A computer", "The Arduino software", "An LED and a resistor"], ["Install the Arduino software", "Open the Blink example", "Upload it and watch the LED"]),
  "tech-building/ai-projects": p(["An AI tool you can use", "One real thing you are doing this week", "A note of what you want back"], ["Describe the task in a few lines", "Ask for a short list of steps", "Check each step yourself before you use it"]),
  "tech-building/web-design": p(["A computer", "A simple site builder or a text editor", "A few lines about you", "One or two photos"], ["Sketch the page on paper first", "Add your name, a photo and a short bio", "Open it in a browser and look it over"]),
  "tech-building/robotics": p(["A starter robot kit", "The kit's instructions", "A clear table", "A friend to build with", "Batteries, if the kit needs them"], ["Sort the parts by type", "Build one section at a time", "Test each part before you add the next"]),
  "tech-building/game-development": p(["A computer", "A beginner game engine", "A tutorial for a one-screen game", "A notebook for ideas"], ["Install the engine", "Follow the tutorial to the first moving thing", "Change one rule to make it your own"]),
  "collecting-fandom/lego": p(["A set or a bin of loose bricks", "A clear table", "A tray or bowls to sort the pieces", "The set's instructions, if it has them"], ["Sort the pieces by color or size", "Build one section at a time", "Show it to someone when you are done"]),
  "home-garden/diy": p(["The thing that needs fixing", "A how-to video or guide", "The tools it names", "A clear work area"], ["Watch the how-to once through", "Gather the tools before you begin", "Test the fix when you finish"]),
  "home-garden/interior-design": p(["Photos of the room", "A way to collect pictures, paper or an app", "A tape measure", "One corner to change"], ["Collect pictures you like for the room", "Pick the colors and shapes that repeat", "Move one thing in the corner to try it"]),
  "home-garden/furniture-flipping": p(["A secondhand chair", "Sandpaper", "Paint and a brush", "A drop cloth", "A well-aired space"], ["Wipe the chair clean", "Sand the surface until it is smooth", "Paint thin coats and let each dry"]),
  "home-garden/houseplants": p(["A plant to take a cutting from", "Clean scissors", "A glass of water", "A bright spot"], ["Cut just below a node", "Remove the leaves that would sit in the water", "Change the water every few days"]),
  "music/make-a-beat": p(["A beat-making app or program", "Headphones or speakers", "A phone or computer", "A tempo you like"], ["Start with a simple drum pattern", "Loop it and add one more sound", "Save it before you close the app"]),
  "music/singing": p(["A quiet spot", "A song you know", "A glass of water", "The lyrics, if you want them"], ["Warm up with gentle humming", "Sing the song slowly", "Record it if you want to listen back"]),
  "music/guitar": p(["A guitar", "A tuner or a tuner app", "A chord chart", "A pick, if you use one"], ["Tune each string", "Place your fingers for one chord at a time", "Switch between two chords slowly"]),
  "music/songwriting": p(["A notebook or a notes app", "A pen", "A phone to record a melody", "A topic from your day"], ["Write down a few lines about the topic", "Hum a tune that fits", "Record it so you can keep it"]),
  "music/djing": p(["A DJ app or controller", "Headphones", "Two songs at a similar tempo", "A quiet spot"], ["Load one song on each deck", "Match the tempos", "Fade from one song to the other"]),
  "photography-film/video": p(["A phone or a camera", "A video editing app", "A friend to film with, if you like", "Charged battery and space on the device"], ["Film short clips as you go through the day", "Pick the ten you like best", "Put them in order and trim each one"]),
  "books-writing/writing": p(["A notebook or a document", "A pen or a keyboard", "A timer", "A quiet place"], ["Set a timer and keep writing until it ends", "Do not stop to fix mistakes", "Read it through once when you finish"]),
  "books-writing/poetry": p(["Paper or a notes app", "A pen", "A view of your street, or a photo of it", "Someone to read it to, if you like"], ["List a few things you see", "Pick the ones that stand out", "Arrange them into eight lines"]),
  "books-writing/books": p(["A book", "A comfortable place to sit", "A bookmark", "A friend to swap notes with, if you like"], ["Read the first page out loud", "Keep going to page twenty", "Note where you stopped"]),
  "books-writing/reading": p(["A book", "A comfortable place to sit", "A bookmark", "A friend to swap notes with, if you like"], ["Read the first page out loud", "Keep going to page twenty", "Note where you stopped"]),
  "books-writing/creative-writing": p(["A notebook or a document", "A pen or a keyboard", "A timer", "A quiet place"], ["Set a timer and keep writing until it ends", "Do not stop to fix mistakes", "Read it through once when you finish"]),
  "health-wellness/yoga": p(["A mat or a soft floor", "Space to stretch out", "A beginner video", "Comfortable clothes"], ["Clear a space around the mat", "Follow the video at your own pace", "Skip any move that does not feel right"]),
  "health-wellness/pilates": p(["A mat or a soft floor", "A mat Pilates video", "Space to lie down", "Comfortable clothes"], ["Clear a space around the mat", "Follow the video at your own pace", "Stop any move that does not feel right"]),
  "health-wellness/meditation": p(["A quiet spot", "A seat or cushion", "A timer"], ["Set the timer", "Sit and count each breath up to ten", "Start again at one when you lose count"]),
  "health-wellness/breathwork": p(["A quiet spot", "A seat", "A timer", "A guide for box breathing"], ["Breathe in for four counts", "Hold for four, out for four, hold for four", "Stop if you feel dizzy"]),
  "sports-fitness/swimming": p(["Swimsuit and towel", "Goggles", "A public pool and its hours", "A lock for a locker"], ["Check the lap swim times", "Pick a lane that suits your pace", "Rest at the wall whenever you like"]),
  "sports-fitness/strength-training": p(["One dumbbell", "Space to move", "A video or guide for the goblet squat", "A mirror, if you like"], ["Hold the dumbbell at your chest", "Squat slowly and stand up", "Rest between sets"]),
  "fashion-beauty/sneakers": p(["A pair of sneakers you own", "A soft brush", "Mild soap and water", "A cloth"], ["Take out the laces and insoles", "Brush off the loose dirt", "Let them air dry away from direct heat"]),
  "fashion-beauty/thrifting": p(["A thrift store near you", "A short list of what you want", "A bag", "A friend to browse with, if you like"], ["Check the store's hours", "Go through one rack at a time", "Try things on before you decide"]),
  "fashion-beauty/makeup": p(["The makeup you own", "A tutorial for one look", "A mirror and good light", "Brushes or sponges"], ["Pick the look and watch the tutorial once", "Lay out what you will use", "Follow the steps in order"]),
  "fashion-beauty/nails": p(["Nail polish", "A bobby pin", "A cotton pad and remover", "A flat surface"], ["Paint a base coat and let it dry", "Dip the pin's end in polish for dots", "Add a top coat"]),
  "fashion-beauty/fragrance": p(["A store with testers", "Paper strips or your wrist", "A small notebook or phone", "A few minutes between scents"], ["Spray one scent at a time", "Wait a moment between each", "Write down the one you go back to"]),
  "fashion-beauty/fashion": p(["Your wardrobe", "A mirror", "A phone for photos", "A place to lay things out"], ["Pick one piece to build around", "Lay out three outfits on the bed", "Take a photo of each"]),
  "collecting-fandom/vinyl": p(["A record store near you", "Its opening hours", "A turntable or a listening station", "An album you want to hear"], ["Ask staff what you can listen to in store", "Pick an album and hear it through", "Note what you would like to hear next"]),
  "collecting-fandom/antiques": p(["A flea market or antique fair", "Its dates and hours", "A bag", "A list of what you are looking for", "Comfortable shoes"], ["Walk the whole market once first", "Ask the seller about a piece you like", "Look up what you learned afterwards"]),
  "collecting-fandom/anime": p(["A series to watch", "A way to stream it", "A friend to watch with", "Snacks, if you like"], ["Pick the series together", "Watch the first episode in one go", "Talk about what you saw"]),
  "gaming-tabletop/puzzles": p(["A 500-piece puzzle", "A table with space", "Good light", "A tray for sorted pieces"], ["Turn all the pieces face up", "Pick out the edge pieces", "Build the frame, then fill in"]),
  "books-writing/book-clubs": p(["A short book", "A friend to read it with", "A way to message them"], ["Pick a date to talk about the book", "Read the first chapter", "Send your friend the first thing you noticed"]),
  // ── Outdoors or with other people ──
  "sports-fitness/cycling": p(["A bike-share membership or your own bike", "A helmet", "A route you can follow", "Water"], ["Check the bike before you set off", "Ride at an easy pace for 15 minutes", "Lock the bike or dock it when you finish"]),
  "sports-fitness/padel": p(["A padel court booking", "Three other players", "Rackets, which many courts lend", "Sports shoes"], ["Ask who can play at the same time", "Book a beginner session", "Warm up with easy rallies"]),
  "sports-fitness/martial-arts": p(["A gym near you", "Comfortable clothes", "A water bottle", "A friend to go with, if you like"], ["Look up the trial class times", "Message the gym to ask what to bring", "Arrive a little early"]),
  "sports-fitness/volleyball": p(["A park or gym with a net", "Sports shoes", "Water"], ["Check when drop-in games run", "Arrive a little early to meet people", "Ask to join the next game"]),
  "sports-fitness/soccer": p(["Sports shoes", "A pickup game or a league", "Water", "A ball, if the group asks for one"], ["Find a nearby pickup game", "Ask what to bring", "Arrive early and join the warm-up"]),
  "sports-fitness/basketball": p(["Sports shoes", "A ball", "A public court", "Water"], ["Shoot on your own to warm up", "Watch how the games work", "Ask to join the next one"]),
  "art-creative/theater": p(["A monologue", "A quiet room", "A phone to record", "A water bottle"], ["Read it aloud once for the sense", "Say it three times, changing the pace", "Listen back to the last one"]),
  "nature-outdoors/birdwatching": p(["A bird ID app", "A park or green space", "Comfortable shoes", "Binoculars, if you have them", "A phone with battery"], ["Stand still and listen for a minute", "Open the app and let it listen", "Write down what you spotted"]),
  "nature-outdoors/foraging": p(["A local plant guide", "A walking route", "A companion who knows the area", "A phone for photos"], ["Look up which plants grow near you", "Take photos instead of picking at first", "Check each ID with a second source"]),
  "nature-outdoors/camping": p(["A tent", "A park or your living room", "A sleeping bag or blanket", "A timer"], ["Lay out the tent parts", "Start the timer and pitch it", "Note your time for next round"]),
  "nature-outdoors/fishing": p(["A rod and a practice plug", "An open park", "Permission to use the space", "A tackle box or bag"], ["Check the rules for the park", "Cast toward a target on the ground", "Try a few different casts"]),
  "home-garden/gardening": p(["A herb plant or seeds", "A pot with drainage", "Potting soil", "A sunny sill", "Water"], ["Fill the pot with soil", "Plant the herb at the same depth as before", "Water it and set it in the sun"]),
  "home-garden/vegetable-gardens": p(["Lettuce seeds", "A container with drainage", "Potting soil", "A sunny spot", "Water"], ["Fill the container with soil", "Sprinkle the seeds on top and cover lightly", "Water gently and keep the soil damp"]),
  "home-garden/composting": p(["A small bin with a lid", "Kitchen scraps", "Dry leaves or shredded paper", "A spot outdoors"], ["Layer scraps and dry material", "Stir it now and then", "Keep out meat and dairy"]),
  "gaming-tabletop/d-d": p(["A game store with a beginner session", "A set of dice", "A pencil", "A character sheet, which the table can give you"], ["Check the store's event list", "Ask whether to bring dice", "Tell the group you are new"]),
  "gaming-tabletop/video-games": p(["A co-op game you both own", "A console or computer", "A friend"], ["Message your friend a time", "Pick the game together", "Play the first level"]),
  "gaming-tabletop/trading-cards": p(["A starter deck", "The rules sheet", "A local card night", "A friend to play against"], ["Read the rules once", "Play a practice game at home", "Go to the card night and ask for a game"]),
  "collecting-fandom/trading-cards": p(["A starter deck", "The rules sheet", "A local card night", "A friend to play against"], ["Read the rules once", "Play a practice game at home", "Go to the card night and ask for a game"]),
  "crafts-making/makerspaces": p(["A makerspace near you", "Its open night", "Closed-toe shoes", "An idea you would like to try"], ["Check the open night times", "Say you are a first-time visitor", "Ask for a tour of the tools"]),
  "food-cooking/bbq": p(["A grill and charcoal", "Something to grill", "Tongs and a lighter", "A safe outdoor spot", "Friends"], ["Light the charcoal and let it burn down", "Grill in small batches", "Put the fire out fully when you are done"]),
  "photography-film/film-photography": p(["A film camera", "A roll of film", "A place that develops film", "A walk with things to photograph"], ["Load the film following the pack", "Shoot slowly through the roll", "Take the roll in to be developed"]),
  "tech-building/drones": p(["A drone simulator", "A computer or phone", "A game controller, if you have one"], ["Start with the training mode", "Practice hovering in place", "Fly a short loop"]),
  "travel-adventure/backpacking": p(["A day bag", "The ten essentials list", "Comfortable walking shoes", "A map or a phone", "Water"], ["Check the list and pack the bag", "Walk two miles close to home", "Adjust the straps along the way"]),
  "travel-adventure/skiing": p(["Space at home", "Comfortable clothes", "A video of the snowplow stance", "A chair for support"], ["Watch the stance once", "Bend your knees in the stance", "Practice balancing on one foot"]),
  "travel-adventure/exploration": p(["A neighborhood you have not visited", "Comfortable shoes", "A phone with a map", "A friend to walk with, if you like"], ["Pick the neighborhood", "Walk with no set route", "Note one thing you did not expect"]),
  "travel-adventure/travel": p(["A town you have not visited", "A way to get there", "A map or a phone", "A friend to go with, if you like"], ["Check how to get there and back", "List two or three places to stop", "Leave early enough to look around"]),
  "travel-adventure/road-trips": p(["A car or a ride", "A route with three stops", "A crew to go with", "A full tank or a charge"], ["Pick the three stops together", "Check how long each leg takes", "Agree when you will leave"]),
};
