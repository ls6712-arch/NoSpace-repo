import { cornerGuide, type CornerGuide, type GuideKind } from "./cornerGuides";
import { formatDuration } from "../lib/dates";
import { MOODS, type MoodId } from "./moods";
import { categoryOfCorner } from "./cornerCategories";

/**
 * The curated layer of the Corners home (/corners): the Corners that get a
 * cover, a guide and a place in the browse rows. Every one is a built-in
 * Corner from hobbies.ts, so Moments and Spaces reach it the way they reach
 * any other Corner; nothing here is stored in the database. Live facts
 * (Spaces, events, Moments) are joined on by (spaceSlug, cornerSlug).
 *
 * Emoji, duration, setting and the steps come from the Sidequest app
 * (checked Oct 26, 2026), edited to fit the trust rule: a step is a
 * suggestion, never a promise, and nothing counts days or builds a plan.
 * Step 1 is the Corner's cornerGuides.ts step where it has one.
 * "What you'll need" is plain facts (gear, place, cost, people), no claims.
 *
 * Moods are not stored. cornerMoods() runs moods.ts over the Corner's guide
 * traits (cornerGuides.ts, or the `traits` here where a Corner has no guide).
 *
 * The name must match hobbies.ts exactly; curatedCorners.test.ts fails if it
 * drifts. The URL slug is the Corner's own slug and must be unique here.
 */
export type CornerSetting = "home" | "outdoors" | "anywhere";

export interface CuratedCorner {
  /** The Corner's slug in hobbies.ts, also its URL: /corners/{slug}. */
  slug: string;
  /** The old Space the Corner sits under in hobbies.ts. */
  spaceSlug: string;
  name: string;
  emoji: string;
  durationMinutes: number;
  setting: CornerSetting;
  /** "How to start", after step 1 when the Corner has a guide step. */
  steps: string[];
  /** "What you'll need": 3 to 5 plain facts. */
  needs: string[];
  /** "Why it's worth it": 4 short, plain reasons to try it. Never a health claim or a promise. */
  worth: string[];
  /** What the cover photo shows, for when one is added. */
  coverAlt: string;
  /** Search words for the Unsplash and Pexels links in the cover brief. */
  photoSearch: string;
  /** Only where cornerGuides.ts has no entry for the Corner. */
  traits?: { kind: GuideKind; together: CornerGuide["together"]; haveIt: boolean };
}

const c = (x: CuratedCorner): CuratedCorner => x;

export const CURATED_CORNERS: readonly CuratedCorner[] = [
  c({
    slug: "running", spaceSlug: "sports-fitness", name: "Running", emoji: "🏃", durationMinutes: 30, setting: "outdoors",
    steps: ["Get comfy shoes", "Try a group run once you can jog 20 minutes"],
    needs: ["Comfortable running shoes", "A road, track or trail", "Free to start", "Go alone or with a group"],
    worth: ["Out of the house in minutes", "Easy to do alone or with others", "Costs almost nothing to start", "You pick the pace and the route"],
    coverAlt: "Runners crossing a bridge at sunrise", photoSearch: "friends running sunrise",
  }),
  c({
    slug: "run-clubs", spaceSlug: "sports-fitness", name: "Run clubs", emoji: "👟", durationMinutes: 60, setting: "outdoors",
    steps: ["Show up at the slowest pace group", "Grab coffee after"],
    needs: ["Running shoes", "A meeting spot, usually a cafe or shop", "Most clubs are free to join", "Groups run at different paces"],
    worth: ["A ready-made group to show up to", "Every pace has a place", "A reason to leave the house on time", "Coffee after is part of it"],
    coverAlt: "A run club stretching together before a morning run", photoSearch: "run club group morning",
  }),
  c({
    slug: "climbing", spaceSlug: "sports-fitness", name: "Climbing", emoji: "🧗", durationMinutes: 120, setting: "anywhere",
    steps: ["Book an intro session at a bouldering gym", "Rent shoes and chalk", "Start on the easiest color routes"],
    needs: ["Climbing shoes and chalk, both rentable at a gym", "A bouldering gym or climbing wall", "Entry and rental fees apply", "Easy with a friend, and gyms are full of people"],
    worth: ["Every route is a small puzzle", "Gyms rent the gear you need", "Beginners climb the same walls", "Easy to share with a friend"],
    coverAlt: "A climber chalking up at a bouldering wall", photoSearch: "bouldering gym climbers",
    traits: { kind: "skill", together: "together", haveIt: false },
  }),
  c({
    slug: "pickleball", spaceSlug: "sports-fitness", name: "Pickleball", emoji: "🏓", durationMinutes: 60, setting: "outdoors",
    steps: ["Learn the kitchen rule", "Play doubles to start"],
    needs: ["A paddle and balls, often loaned at open play", "A court, public or private", "Free at many public courts", "Doubles needs four players"],
    worth: ["Simple rules, quick to learn", "Games take under an hour", "Courts are often open to drop in", "Good for mixed groups"],
    coverAlt: "Friends playing doubles pickleball on an outdoor court", photoSearch: "pickleball doubles court",
  }),
  c({
    slug: "tennis", spaceSlug: "sports-fitness", name: "Tennis", emoji: "🎾", durationMinutes: 60, setting: "outdoors",
    steps: ["Borrow a racket and a can of balls", "Book a public court with a friend"],
    needs: ["A racket and balls", "A wall or a court", "Courts can be booked, some for a fee", "Singles needs two players"],
    worth: ["Rallying is fun from the first hour", "Public courts are cheap or free", "Works with one friend", "A game for any age"],
    coverAlt: "Two friends rallying on a tennis court in warm evening light", photoSearch: "tennis friends court",
  }),
  c({
    slug: "hiking", spaceSlug: "nature-outdoors", name: "Hiking", emoji: "🥾", durationMinutes: 240, setting: "outdoors",
    steps: ["Pack water, snacks, a layer", "Tell someone your route"],
    needs: ["Sturdy shoes", "Water, snacks and an extra layer", "A marked trail", "Free at most trails", "Easier with company"],
    worth: ["Time outside with no screen needed", "Trails for every length", "Little gear to begin with", "Good with company or alone"],
    coverAlt: "A group of hikers on a ridge trail in golden light", photoSearch: "hiking group trail",
  }),
  c({
    slug: "pottery", spaceSlug: "crafts-making", name: "Pottery", emoji: "🏺", durationMinutes: 180, setting: "anywhere",
    steps: ["Or try air-dry clay at home", "Make a small bowl"],
    needs: ["Clay, provided at a taster class", "A studio, or a table at home for air-dry clay", "Classes and tasters cost money", "An apron or clothes that can get messy"],
    worth: ["You leave with something you made", "Tasters let you try before you buy", "Slow, hands-on time", "Every piece comes out different"],
    coverAlt: "Hands shaping clay together on a pottery wheel", photoSearch: "pottery wheel hands class",
    traits: { kind: "making", together: "either", haveIt: false },
  }),
  c({
    slug: "woodworking", spaceSlug: "crafts-making", name: "Woodworking", emoji: "🪚", durationMinutes: 240, setting: "home",
    steps: ["Take a beginner workshop", "Start with a simple shelf or box", "Learn tool safety"],
    needs: ["Hand tools or a workshop with them", "Wood, sandpaper and oil or finish", "Eye and ear protection", "Classes and materials cost money"],
    worth: ["Make something you can use", "Small projects finish in a day", "Skills build one cut at a time", "Makerspaces lend the tools"],
    coverAlt: "Two people sanding a wooden board in a workshop", photoSearch: "woodworking workshop beginners",
  }),
  c({
    slug: "photography", spaceSlug: "photography-film", name: "Photography", emoji: "📷", durationMinutes: 60, setting: "outdoors",
    steps: ["Use your phone", "Pick a theme: shadows, red, circles"],
    needs: ["A phone or any camera", "Somewhere to walk", "Free to start", "A walk with friends works well"],
    worth: ["Your phone is enough to start", "A new way to look at your street", "Each walk gives you something to keep", "Easy to share one photo"],
    coverAlt: "Friends on a photo walk looking at their cameras", photoSearch: "photo walk friends street",
  }),
  c({
    slug: "filmmaking", spaceSlug: "photography-film", name: "Filmmaking", emoji: "🎬", durationMinutes: 120, setting: "anywhere",
    steps: ["Write a 1-minute idea", "Edit with a free app"],
    needs: ["A phone that films video", "A free editing app", "Free to start", "Friends to act, hold the phone or help with sound"],
    worth: ["A phone is enough to start", "Short films can take one afternoon", "A reason to gather friends", "You end up with something to show"],
    coverAlt: "A small crew filming a short scene with a phone on a street", photoSearch: "friends filming short film",
  }),
  c({
    slug: "chess", spaceSlug: "gaming-tabletop", name: "Chess", emoji: "♟️", durationMinutes: 30, setting: "anywhere",
    steps: ["Learn how each piece moves", "Study one opening"],
    needs: ["A board or a chess app", "A table, a park bench or a phone", "Free to start", "Games need two players, in person or online"],
    worth: ["Free to play, anywhere", "A game fits in ten minutes", "Play a friend or a stranger", "Every game teaches you something"],
    coverAlt: "Two people playing chess at an outdoor table", photoSearch: "chess park players",
  }),
  c({
    slug: "board-games", spaceSlug: "gaming-tabletop", name: "Board games", emoji: "🎲", durationMinutes: 180, setting: "home",
    steps: ["Invite 3 to 5 friends", "Pick an easy game like Codenames", "Snacks are mandatory"],
    needs: ["One or two games to start", "A table with room for everyone", "A game costs money, or borrow one", "Three to five people"],
    worth: ["Easy to bring people together", "One box, a whole evening", "No skill needed to join", "Games range from five minutes to hours"],
    coverAlt: "Friends laughing around a table of board games", photoSearch: "friends board game night",
  }),
  c({
    slug: "coding", spaceSlug: "tech-building", name: "Coding", emoji: "💻", durationMinutes: 120, setting: "home",
    steps: ["Pick a free beginner course", "Share it with a friend"],
    needs: ["A laptop or computer", "An internet connection", "Plenty of free courses exist", "A friend or community to share with"],
    worth: ["Build something that runs", "Free tools and lessons", "Small projects finish in a sitting", "Learn alone or at a meetup"],
    coverAlt: "Two friends coding together at a laptop in a cafe", photoSearch: "coding together laptop cafe",
  }),
  c({
    slug: "supper-clubs", spaceSlug: "food-cooking", name: "Supper clubs", emoji: "🍽️", durationMinutes: 240, setting: "home",
    steps: ["Plan a 3-course menu", "Prep ahead", "Set the table nicely"],
    needs: ["A kitchen and a table", "Ingredients for a few dishes", "Groceries add up with more guests", "A table of guests, often new faces"],
    worth: ["A table of people to meet", "Eat food you did not cook", "A set evening to look forward to", "Hosts love new faces"],
    coverAlt: "Friends sharing a long supper table lit by candles", photoSearch: "dinner party friends table",
  }),
  c({
    slug: "fermentation", spaceSlug: "food-cooking", name: "Fermentation", emoji: "🥬", durationMinutes: 60, setting: "home",
    steps: ["Start with sauerkraut: cabbage and salt", "Pack in a jar", "Wait a week"],
    needs: ["Vegetables and salt", "A clean jar", "Cheap to start", "A shelf or counter to keep the jar"],
    worth: ["Cheap to start", "Mostly waiting, little work", "Something tasty at the end", "Jars make good gifts"],
    coverAlt: "Hands packing shredded cabbage into a jar", photoSearch: "fermenting vegetables jars hands",
  }),
  c({
    slug: "sourdough", spaceSlug: "food-cooking", name: "Sourdough", emoji: "🍞", durationMinutes: 240, setting: "home",
    steps: ["Use a simple no-knead recipe", "Let it rise overnight", "Bake in a hot pot"],
    needs: ["Flour, water and salt", "A jar, a bowl and a pot with a lid", "An oven", "Cheap to start"],
    worth: ["Flour and water to start", "A loaf at the end", "Slow, hands-on time", "A starter is easy to share"],
    coverAlt: "Friends sharing a loaf of bread fresh from the oven", photoSearch: "baking bread kitchen friends",
  }),
  c({
    slug: "illustration", spaceSlug: "art-creative", name: "Illustration", emoji: "🖌️", durationMinutes: 90, setting: "home",
    steps: ["Use a tablet or free app", "Trace a photo to start", "Learn layers"],
    needs: ["A tablet or a computer", "A free drawing app", "A stylus helps", "Free to start"],
    worth: ["A pen and paper are enough", "A sketch takes minutes", "Your style shows up with practice", "Easy to share one drawing"],
    coverAlt: "An artist drawing on a tablet at a shared desk", photoSearch: "digital illustration tablet artist",
    traits: { kind: "making", together: "either", haveIt: false },
  }),
  c({
    slug: "dance", spaceSlug: "sports-fitness", name: "Dance", emoji: "🕺", durationMinutes: 90, setting: "anywhere",
    steps: ["Try salsa, swing or bachata", "No partner needed", "Go to 3 classes before judging"],
    needs: ["Comfortable shoes you can move in", "A studio or hall that runs classes", "Classes cost money, drop-ins are common", "No partner needed, you rotate"],
    worth: ["Start in your living room", "Classes welcome beginners", "Music does half the work", "Fun alone or with a partner"],
    coverAlt: "Dancers in a social dance class laughing as they rotate partners", photoSearch: "social dance class salsa",
    traits: { kind: "skill", together: "together", haveIt: false },
  }),
  c({
    slug: "language-learning", spaceSlug: "books-writing", name: "Language learning", emoji: "🌍", durationMinutes: 60, setting: "anywhere",
    steps: ["Find a language cafe meetup", "Swap 30 minutes each", "Make a friend"],
    needs: ["A language you want to practice", "A cafe, a hall or a video call", "Meetups are often free", "A partner who speaks the other language"],
    worth: ["Start with five words", "Free apps and exchanges", "A reason to talk to new people", "Small steps add up"],
    coverAlt: "A small group talking over coffee at a language meetup", photoSearch: "language exchange meetup cafe",
  }),
  c({
    slug: "boxing", spaceSlug: "sports-fitness", name: "Boxing", emoji: "🥊", durationMinutes: 60, setting: "anywhere",
    steps: ["Get hand wraps and gloves", "Try a boxing fitness class"],
    needs: ["Hand wraps and gloves, often rentable", "A gym with a bag or a class", "Gym fees apply", "A coach or class helps"],
    worth: ["Gyms offer beginner classes", "Gloves are cheap to rent", "A full session in under an hour", "Learn the basics one drill at a time"],
    coverAlt: "A coach holding pads for a boxer in a bright gym", photoSearch: "boxing gym training pads",
    traits: { kind: "skill", together: "together", haveIt: false },
  }),
  c({
    slug: "skateboarding", spaceSlug: "sports-fitness", name: "Skateboarding", emoji: "🛹", durationMinutes: 60, setting: "outdoors",
    steps: ["Practice balance on grass first", "Learn to push and stop"],
    needs: ["A complete board and a helmet", "Flat ground or a skatepark", "A board costs money, a park is free", "Other skaters at the park"],
    worth: ["A board and a flat spot", "Skate parks welcome beginners", "Learn one trick at a time", "Great with friends"],
    coverAlt: "Friends skating together at a park in the late afternoon", photoSearch: "skatepark friends skateboarding",
    traits: { kind: "skill", together: "either", haveIt: false },
  }),
  c({
    slug: "kayaking", spaceSlug: "nature-outdoors", name: "Kayaking", emoji: "🛶", durationMinutes: 180, setting: "outdoors",
    steps: ["Rent a kayak at a calm lake", "Wear a life jacket", "Learn the forward stroke"],
    needs: ["A kayak, paddle and life jacket, all rentable", "Calm water", "Rental fees apply", "Easier with a partner or a group"],
    worth: ["Time on the water", "Rentals cover the gear", "Calm lakes suit a first paddle", "Good for two or a group"],
    coverAlt: "Friends paddling kayaks across a calm lake", photoSearch: "friends kayaking lake",
    traits: { kind: "experience", together: "either", haveIt: false },
  }),
  c({
    slug: "surfing", spaceSlug: "nature-outdoors", name: "Surfing", emoji: "🏄", durationMinutes: 180, setting: "outdoors",
    steps: ["Use a soft-top board", "Practice pop-ups on sand"],
    needs: ["A soft-top board, rentable", "A wetsuit in cool water", "A beach with small, gentle waves", "Lessons and rentals cost money"],
    worth: ["Lessons come with a board", "Time in the sea", "Every session is different", "A day out with friends"],
    coverAlt: "A surf group walking into the water with boards at sunrise", photoSearch: "surf lesson beginners beach",
    traits: { kind: "skill", together: "either", haveIt: false },
  }),
  c({
    slug: "wild-swimming", spaceSlug: "nature-outdoors", name: "Wild swimming", emoji: "🌊", durationMinutes: 60, setting: "outdoors",
    steps: ["Find a safe, known swim spot", "Never swim alone", "Enter slowly"],
    needs: ["Swimwear and a towel", "A safe, known spot", "Free", "At least one other person"],
    worth: ["A swim somewhere new", "Little kit needed", "Go with a friend", "Spots are often free"],
    coverAlt: "Friends wading into a lake together in soft morning light", photoSearch: "friends wild swimming lake",
    traits: { kind: "experience", together: "either", haveIt: false },
  }),
  c({
    slug: "sauna-cold-plunge", spaceSlug: "health-wellness", name: "Sauna & cold plunge", emoji: "🧖", durationMinutes: 90, setting: "anywhere",
    steps: ["Go with a friend", "Follow the venue’s guidance on heat and cold"],
    needs: ["Swimwear and a towel", "A sauna, bathhouse or spa", "Entry costs money", "Many venues are social, so friends are welcome"],
    worth: ["A slow hour away from your phone", "Sessions run in short rounds", "A good reason to go with a friend", "Most places explain it on arrival"],
    coverAlt: "Friends relaxing together in a wooden sauna", photoSearch: "friends sauna social wood",
    traits: { kind: "experience", together: "together", haveIt: false },
  }),
  c({
    slug: "make-a-beat", spaceSlug: "music", name: "Make a beat", emoji: "🎧", durationMinutes: 60, setting: "home",
    steps: ["Open a free beat-making app", "Lay down drums first", "Add a bassline and melody"],
    needs: ["A phone or computer", "A free beat-making app", "Headphones", "Free to start"],
    worth: ["Free apps are enough to start", "A loop takes minutes", "No instrument needed", "Share it with one friend"],
    coverAlt: "Two friends making a beat on a pad controller and laptop", photoSearch: "making beats studio friends",
    traits: { kind: "making", together: "solo", haveIt: false },
  }),
  c({
    slug: "karaoke", spaceSlug: "music", name: "Karaoke", emoji: "🎙️", durationMinutes: 120, setting: "anywhere",
    steps: ["Gather friends", "Pick one silly song"],
    needs: ["A microphone, or just a speaker", "A karaoke bar, a booked room or your living room", "Rooms and bars cost money", "A group of friends"],
    worth: ["No skill needed", "A room full of people cheering", "A good night out", "Pick a song you know"],
    coverAlt: "Friends singing into microphones together at a karaoke night", photoSearch: "friends karaoke night singing",
    traits: { kind: "experience", together: "together", haveIt: false },
  }),
  c({
    slug: "live-music", spaceSlug: "music", name: "Live music", emoji: "🎟️", durationMinutes: 180, setting: "anywhere",
    steps: ["Try a genre you don’t know", "Go even if alone"],
    needs: ["A ticket, or free entry at some venues", "Comfortable shoes", "Earplugs if it gets loud", "Go with friends or by yourself"],
    worth: ["A night out with a plan", "Small rooms, close to the band", "Hear new music up close", "Go alone or with friends"],
    coverAlt: "A crowd watching a band in a small venue", photoSearch: "small venue gig crowd",
    traits: { kind: "experience", together: "either", haveIt: false },
  }),
  c({
    slug: "choir", spaceSlug: "music", name: "Choir", emoji: "🎶", durationMinutes: 90, setting: "anywhere",
    steps: ["Show up and listen", "Join a section"],
    needs: ["Yourself and a voice", "A rehearsal room, often a hall or church", "Some choirs are free, some charge fees", "A group that sings in parts"],
    worth: ["Sing with others", "No audition at many choirs", "Music is handed to you", "A weekly time to look forward to"],
    coverAlt: "A community choir singing together in a rehearsal room", photoSearch: "community choir rehearsal",
    traits: { kind: "regular", together: "together", haveIt: true },
  }),
  c({
    slug: "pasta", spaceSlug: "food-cooking", name: "Pasta", emoji: "🍝", durationMinutes: 90, setting: "home",
    steps: ["Mix 100 g flour per egg", "Knead 10 minutes"],
    needs: ["Flour and eggs", "A clean counter and a rolling pin", "Cheap", "Friends to roll and cut with"],
    worth: ["Flour and eggs to start", "A meal at the end", "Good with a friend", "Cheap to make"],
    coverAlt: "Friends rolling fresh pasta dough on a floured counter", photoSearch: "making fresh pasta friends kitchen",
    traits: { kind: "making", together: "either", haveIt: false },
  }),
  c({
    slug: "trivia", spaceSlug: "gaming-tabletop", name: "Trivia", emoji: "❓", durationMinutes: 120, setting: "anywhere",
    steps: ["Find a pub quiz", "Come up with a team name"],
    needs: ["A pub or venue that hosts a quiz", "A pen and paper, often provided", "Often free to enter, drinks extra", "A team of about four"],
    worth: ["Teams welcome newcomers", "A set night each week", "Quick to join", "A good reason to go out"],
    coverAlt: "A team huddled over an answer sheet at a pub quiz", photoSearch: "pub quiz team friends",
    traits: { kind: "games", together: "together", haveIt: false },
  }),
  c({
    slug: "improv", spaceSlug: "art-creative", name: "Improv", emoji: "🎭", durationMinutes: 120, setting: "anywhere",
    steps: ["Say “yes, and”", "Embrace being silly"],
    needs: ["Comfortable clothes you can move in", "A studio or theatre that runs classes", "Classes cost money", "A class full of other beginners"],
    worth: ["Beginner classes are common", "No script to learn", "Laughing in a room of people", "Small steps in a safe group"],
    coverAlt: "An improv class laughing together in a circle", photoSearch: "improv class group laughing",
    traits: { kind: "skill", together: "together", haveIt: true },
  }),
  c({
    slug: "volunteering", spaceSlug: "travel-adventure", name: "Volunteering", emoji: "🤝", durationMinutes: 180, setting: "anywhere",
    steps: ["Find a food bank or shelter", "Bring a friend"],
    needs: ["Closed shoes and clothes that can get messy", "A local organization that needs help", "Free", "Other volunteers, and a friend if you like"],
    worth: ["Meet people near you", "Help with something that matters locally", "Roles for every amount of time", "Start with one afternoon"],
    coverAlt: "Volunteers packing food boxes together at a table", photoSearch: "volunteers food bank packing",
    traits: { kind: "helping", together: "together", haveIt: true },
  }),
c({
  slug: "life-drawing", spaceSlug: "art-creative", name: "Life drawing", emoji: "✏️", durationMinutes: 120, setting: "anywhere",
  steps: ["Find a drop-in life drawing session near you", "Bring a pad and pencils or charcoal", "Start with the quick poses"],
  needs: ["A sketch pad and pencils or charcoal", "A drop-in session at a studio or art school", "Sessions usually charge an entry fee", "A room of people drawing together"],
  worth: ["A real person to draw, not a photo", "Drop in, no course to sign up for", "Quick poses leave no time to overthink", "Every level draws in the same room"],
  coverAlt: "Artists sketching at easels in a life drawing class", photoSearch: "life drawing class easels",
  traits: { kind: "skill", together: "together", haveIt: false },
}),
c({
  slug: "city-walks", spaceSlug: "travel-adventure", name: "City walks", emoji: "🏛️", durationMinutes: 120, setting: "outdoors",
  steps: ["Pick a neighbourhood you have never walked", "Join a local heritage walk", "Save the spots you want to go back to"],
  needs: ["Comfortable shoes", "A neighbourhood or old quarter to explore", "Free on your own; guided walks may charge", "Go alone, with a friend or with a group"],
  worth: ["See your own city like a visitor", "Stories behind places you pass daily", "Easy to do with a friend", "Ends wherever the good cafe is"],
  coverAlt: "A small group on a guided walk through old city lanes", photoSearch: "heritage walk group old city",
  traits: { kind: "exploring", together: "either", haveIt: true },
}),
c({
  slug: "film-clubs", spaceSlug: "photography-film", name: "Film clubs", emoji: "🍿", durationMinutes: 180, setting: "anywhere",
  steps: ["Pick a film and a place to watch it together", "Invite a few people who will stay to talk", "Take turns choosing the next film"],
  needs: ["A screen and a room, or a local screening", "A film everyone can watch", "Free at home; screenings may charge", "Works best with a small group"],
  worth: ["Talking after is half the film", "Films you would not pick alone", "Easy to host at home", "A standing reason to see the same people"],
  coverAlt: "Friends watching a film projected on a living room wall", photoSearch: "friends watching movie projector",
  traits: { kind: "exploring", together: "together", haveIt: true },
}),
c({
  slug: "food-tours", spaceSlug: "food-cooking", name: "Food tours", emoji: "🥟", durationMinutes: 180, setting: "outdoors",
  steps: ["Pick one street or market known for food", "Try one thing from each of three stalls", "Join a guided food walk for the stories"],
  needs: ["An appetite and a little cash for stalls", "A food street, market or old quarter", "Self-guided costs only the food", "Better with friends to share plates"],
  worth: ["Taste a neighbourhood in an afternoon", "Sharing plates is half the fun", "Small spends, lots to try", "Meet the people who cook it"],
  coverAlt: "Friends sharing street food at a busy evening market stall", photoSearch: "friends street food market night",
  traits: { kind: "exploring", together: "either", haveIt: false },
}),
c({
  slug: "mahjong", spaceSlug: "gaming-tabletop", name: "Mahjong", emoji: "🀄", durationMinutes: 120, setting: "home",
  steps: ["Learn the tiles with a free rules guide", "Play a teaching game with three others", "Join a mahjong social or club night"],
  needs: ["A mahjong set, or a club that has one", "Four players at one table", "Played for fun, no money", "Rules vary by style, so agree first"],
  worth: ["Four people, one table, hours of talk", "Many styles to try once you know one", "The tiles are a joy to play with", "A reason for a regular night in"],
  coverAlt: "Four friends around a table mid-game of mahjong", photoSearch: "friends playing mahjong table",
  traits: { kind: "games", together: "together", haveIt: false },
}),
c({
  slug: "rafting", spaceSlug: "travel-adventure", name: "Rafting", emoji: "🚣", durationMinutes: 240, setting: "outdoors",
  steps: ["Pick a beginner-graded stretch of river", "Book with a licensed rafting operator", "Go with friends to fill a raft"],
  needs: ["A licensed operator who provides the raft", "A helmet and life jacket, worn the whole trip", "Trips are paid; prices vary by stretch", "Usually done as a group in one raft"],
  worth: ["A whole raft working as one team", "Rivers you cannot see from a road", "Beginner stretches exist", "A day out you will talk about after"],
  coverAlt: "A group in helmets paddling a raft through white water", photoSearch: "white water rafting group",
  traits: { kind: "experience", together: "together", haveIt: false },
}),
c({
  slug: "letter-writing", spaceSlug: "books-writing", name: "Letter writing", emoji: "✉️", durationMinutes: 30, setting: "home",
  steps: ["Write one letter by hand to someone who would love it", "Pick stationery or stamps that feel like you", "Find a pen pal through a letter club"],
  needs: ["Paper, a pen and an envelope", "A stamp and an address", "Costs the price of a stamp", "Better with a pen pal writing back"],
  worth: ["Post that is not a bill", "Something they can keep", "Stationery is half the fun", "A slow friendship across distance"],
  coverAlt: "Hands writing a letter beside stamps and envelopes on a cafe table", photoSearch: "writing letter stamps envelopes",
  traits: { kind: "making", together: "either", haveIt: true },
}),
c({
  slug: "hyrox", spaceSlug: "sports-fitness", name: "Hyrox", emoji: "🛷", durationMinutes: 90, setting: "anywhere",
  steps: ["Learn the eight stations and the run between each", "Try a class at a gym that runs Hyrox sessions", "Enter a race as a doubles pair"],
  needs: ["Running shoes and gym kit", "A gym or club that runs Hyrox sessions", "Races charge an entry fee", "Doubles and relays let you race with friends"],
  worth: ["The same race format worldwide", "Train together, race with a partner", "Running and gym work in one", "A race day to aim at together"],
  coverAlt: "Two athletes pushing sleds side by side in a busy gym", photoSearch: "sled push gym group",
  traits: { kind: "regular", together: "together", haveIt: false },
}),
c({
  slug: "walking-clubs", spaceSlug: "sports-fitness", name: "Walking clubs", emoji: "🚶", durationMinutes: 60, setting: "outdoors",
  steps: ["Find a walking group that meets near you", "Show up once, at your own pace", "Try their sunrise or sunset walk"],
  needs: ["Comfortable shoes", "A park, promenade or trail", "Most groups are free", "A group that sets off together"],
  worth: ["Talking pace, the whole way", "No kit beyond shoes", "A reason to see the same faces", "Easy for anyone to join"],
  coverAlt: "A walking group chatting on a park path at sunrise", photoSearch: "walking group park sunrise",
  traits: { kind: "regular", together: "together", haveIt: true },
}),
c({
  slug: "badminton", spaceSlug: "sports-fitness", name: "Badminton", emoji: "🏸", durationMinutes: 60, setting: "anywhere",
  steps: ["Borrow or buy a racket and shuttles", "Book a court with three friends for doubles", "Join a social or club session"],
  needs: ["A racket and shuttlecocks", "An indoor court, usually booked by the hour", "Court hire applies", "Doubles needs four players"],
  worth: ["Rallies from the very first game", "Easy to fill a court with friends", "Games are short and quick", "Works for mixed groups"],
  coverAlt: "Friends playing doubles badminton on an indoor court", photoSearch: "badminton doubles indoor court",
  traits: { kind: "skill", together: "together", haveIt: false },
}),
c({
  slug: "skating", spaceSlug: "sports-fitness", name: "Skating", emoji: "🛼", durationMinutes: 60, setting: "anywhere",
  steps: ["Rent skates at a rink for your first go", "Learn to stop before you learn speed", "Join a group skate or roller disco night"],
  needs: ["Skates, rentable at most rinks", "A helmet and wrist guards for roller skating", "A rink or a smooth, quiet path", "Rink entry applies"],
  worth: ["Music, lights and laps at a rink", "Roller and ice share one scene", "Group skates welcome beginners", "Rentals mean no big buy-in"],
  coverAlt: "Friends roller skating together under rink lights", photoSearch: "roller skating friends rink",
  traits: { kind: "skill", together: "either", haveIt: false },
}),
c({
  slug: "ultimate-frisbee", spaceSlug: "sports-fitness", name: "Ultimate frisbee", emoji: "🥏", durationMinutes: 90, setting: "outdoors",
  steps: ["Learn the backhand throw with a friend", "Go to a pickup game and ask to join a side", "Find a mixed social league"],
  needs: ["A disc and running shoes", "A field or open park", "Pickup games are usually free", "Teams of seven a side"],
  worth: ["Players call their own fouls", "Mixed teams are common", "One disc is all the kit", "Team sport with no referee"],
  coverAlt: "A mixed team diving for a disc on a grass field", photoSearch: "ultimate frisbee game field",
  traits: { kind: "skill", together: "together", haveIt: false },
}),
];

const BY_SLUG = new Map(CURATED_CORNERS.map((x) => [x.slug, x]));

export function curatedBySlug(slug: string): CuratedCorner | undefined {
  return BY_SLUG.get(slug);
}

export function curatedFor(spaceSlug: string, cornerSlug: string): CuratedCorner | undefined {
  const found = BY_SLUG.get(cornerSlug);
  return found && found.spaceSlug === spaceSlug ? found : undefined;
}

/** The Corner's category slug (one of the 18), from cornerCategories.ts. */
export function curatedCategory(x: CuratedCorner): string | undefined {
  return categoryOfCorner(x.spaceSlug, x.slug)?.slug;
}

/** Curated Corners in one category, in list order. */
export function curatedInCategory(categorySlug: string): CuratedCorner[] {
  return CURATED_CORNERS.filter((x) => curatedCategory(x) === categorySlug);
}

/** "How to start": step 1 from cornerGuides.ts when the Corner has one. */
export function howToStart(x: CuratedCorner): string[] {
  const step = cornerGuide(x.spaceSlug, x.slug)?.step;
  return step ? [step, ...x.steps] : x.steps;
}

/** The guide traits moods.ts reads, from cornerGuides.ts or the entry's own. */
function guideFor(x: CuratedCorner): CornerGuide {
  const g = cornerGuide(x.spaceSlug, x.slug);
  if (g) return g;
  const t = x.traits;
  return {
    about: "",
    step: "",
    kind: t?.kind ?? "experience",
    together: t?.together ?? "either",
    where: x.setting === "outdoors" ? "outdoors" : x.setting === "home" ? "indoors" : "either",
    haveIt: t?.haveIt ?? false,
  };
}

/** The moods.ts moods this Corner matches. */
export function cornerMoods(x: CuratedCorner): MoodId[] {
  const g = guideFor(x);
  return MOODS.filter((m) => m.matches(g, x.spaceSlug, x.slug)).map((m) => m.id);
}

/** The duration filter chips: a Corner shows under every chip it fits in. */
export const DURATION_LIMITS = [60, 120, 240] as const;

/** Unsplash and Pexels searches for the cover brief. */
export function photoSearchLinks(x: CuratedCorner): { unsplash: string; pexels: string } {
  const q = x.photoSearch;
  return {
    unsplash: `https://unsplash.com/s/photos/${encodeURIComponent(q).replace(/%20/g, "-")}`,
    pexels: `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
  };
}

const SETTING_LABEL: Record<CornerSetting, string> = { home: "At home", outdoors: "Outdoors", anywhere: "Anywhere" };

/** "1 hr · Outdoors": how long a curated Corner takes and where. */
export function cornerMeta(x: CuratedCorner): string {
  return [formatDuration(x.durationMinutes), SETTING_LABEL[x.setting]].filter(Boolean).join(" · ");
}

/**
 * The moods.ts moods for any built-in Corner that has a guide in
 * cornerGuides.ts, adults-only ones left out (as on Discover's mood row).
 * A Corner with no guide has no moods.
 */
export function guideMoods(spaceSlug: string, cornerSlug: string): MoodId[] {
  const g = cornerGuide(spaceSlug, cornerSlug);
  if (!g || g.adultsOnly) return [];
  return MOODS.filter((m) => m.matches(g, spaceSlug, cornerSlug)).map((m) => m.id);
}
