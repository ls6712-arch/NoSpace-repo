# Discover v2: proposed idea values and copy

Status: **proposed, waiting for founder approval.** Source of truth: `src/app/data/cornerIdeas.ts`
(this table is generated from it). Matching: `src/app/lib/ideaMatch.ts`. Nothing on the Discover
page reads these yet (that is PR 2).

## How the pills work now

The Time and Spend pills are **ceilings**: An hour is inside Tonight is inside Weekend, and Free is
inside Under $25 is inside Treat me. Each idea stores its **smallest time** and **smallest spend**,
and matches a pill when both are at or below it. Who is an exact pill (an idea lists every Who it fits).

Tests: every one of the 27 pill combinations returns at least 3 ideas for a person with no picks
(in fact the row fills all 6 everywhere), and widening a pill never removes an idea.

How many ideas each combination matches (Solo / A friend / New people), before the row is capped at 6:

| Time \ Spend | Free | Under $25 | Treat me |
|---|---|---|---|
| An hour | 33 / 37 / 8 | 82 / 86 / 24 | 82 / 87 / 25 |
| Tonight | 37 / 42 / 12 | 89 / 105 / 39 | 90 / 108 / 41 |
| Weekend | 37 / 43 / 13 | 95 / 113 / 42 | 97 / 117 / 44 |

## The rules behind the values

- **Time** comes from the how line: 60 minutes or less is An hour, up to a few hours is Tonight,
  and a full day or something that needs daylight or a booking is Weekend. Weekend by hand:
  film photography, surfing, kayaking, volunteering, furniture flipping, robotics, travel, road trips,
  rafting and wild swimming.
- **Spend:** if you can start with what you have, Free. Otherwise Under $25. Treat me is only for the four
  you named.
- **Who:** from the guide. A solo Corner is Solo, a together Corner is A friend and New people, and
  the rest are Solo and A friend.
- **Titles** are short verb phrases (no more than nine words, no full stop). **How lines** are the time plus
  where, and end in a full stop. Neither mentions a price. US spelling throughout.
- **21 and over** (home brewing, cocktail making): kept in the table but never shown in the idea row,
  like the rest of general browsing, until age checks exist.

## Changes you asked for (all applied)

1. **Ceilings** and the 27 combination test, above.
2. **Titles and how lines** rewritten for every idea, in the table.
3. **Duplicates dropped.** One idea kept per group; the guides stay, they just get no idea:

| Dropped | Kept |
|---|---|
| food-cooking/home-coffee | food-cooking/coffee |
| food-cooking/espresso | food-cooking/coffee |
| tech-building/arduino | tech-building/electronics |
| books-writing/books | books-writing/reading |
| books-writing/creative-writing | books-writing/writing |
| collecting-fandom/trading-cards | gaming-tabletop/trading-cards |
4. **Value fixes.** Breathwork, exploration, backpacking and skiing are Free. Breathwork, exploration and
   skiing are An hour (5, 15 and 15 minutes); backpacking is Tonight. Pottery, climbing, surfing and padel
   are Treat me, and surfing is Weekend.
5. **Full stops** on every how line and **US spelling** throughout, both enforced by tests.

## Calls I made that you should check

- **Time now follows the how line**, so some values moved from what you saw before. For example, live music,
  karaoke, open mics, sauna and sound baths are Tonight (they are evening things), and most 30 and 60 minute
  ideas are An hour. Say if any should be Weekend.
- **Treat me is only the four you named.** Others that are paid, booked or guided and are still Under $25:
  kayaking, rafting, boxing, sauna and cold plunge, sound baths, karaoke, live music, dance, improv, hyrox,
  skating, film photography, travel, road trips, drones and 3D printing. Tell me which to move.
- **Who comes from the guide, not the idea.** A few are odd: skiing is "A friend, New people" although the idea is
  a drill at home, and foraging is the same. Tell me if you want any changed.
- **Near overlaps I did not touch** (not in your list): video and filmmaking, web design and coding,
  exploration and city walks, gardening and vegetable gardens, camping and backpacking, singing and choir.
- Trading cards: I kept the Gaming and tabletop one and dropped the Collecting one.

## All ideas

| Corner | Time | Spend | Who | Idea title | How |
|---|---|---|---|---|---|
| food-cooking/cooking | An hour | Under $25 | Solo, A friend | Cook a recipe you have never made | 45 minutes, your kitchen and a short ingredient list. |
| food-cooking/baking | An hour | Under $25 | Solo, A friend | Bake a batch of cookies | 1 hour, your kitchen and a trusted recipe. |
| food-cooking/sourdough | An hour | Under $25 | Solo, A friend | Start a sourdough starter | 10 minutes, a jar and flour. |
| food-cooking/fermentation | An hour | Under $25 | Solo | Make quick pickles | 15 minutes, a jar, salt and a cucumber. |
| food-cooking/tea | An hour | Under $25 | Solo, A friend | Brew a tea two ways | 20 minutes, your kitchen and loose-leaf tea. |
| food-cooking/home-brewing (21 and over) | An hour | Under $25 | Solo, A friend | Steep a cup of specialty malt | 30 minutes, your kitchen and crushed malt. |
| food-cooking/kombucha | An hour | Under $25 | Solo | Brew a jar of kombucha | 20 minutes, a jar, sweet tea and a SCOBY. |
| food-cooking/cocktail-making (21 and over) | An hour | Under $25 | Solo, A friend | Mix a classic sour | 15 minutes, your kitchen, a lemon and sugar. |
| food-cooking/supper-clubs | Tonight | Under $25 | A friend, New people | Host dinner for one guest | 2 hours, your home and one dish. |
| food-cooking/coffee | An hour | Under $25 | Solo | Make a pour-over | 10 minutes, your kitchen and a pour-over setup. |
| sports-fitness/running | An hour | Free | Solo, A friend | Run-walk for 15 minutes | 15 minutes, any road or path outside. |
| sports-fitness/run-clubs | An hour | Free | A friend, New people | Go to a run club | 1 hour, a local run club's meetup spot. |
| sports-fitness/cycling | An hour | Under $25 | Solo, A friend | Ride a bike-share bike | 30 minutes, a bike dock and a quiet route. |
| sports-fitness/pickleball | An hour | Under $25 | A friend, New people | Join open play at a court | 1 hour, a public court. |
| sports-fitness/padel | An hour | Treat me | A friend, New people | Book a beginner padel session | 1 hour, a padel court and three others. |
| sports-fitness/tennis | An hour | Under $25 | A friend, New people | Hit against a wall | 15 minutes, a practice wall and a racket. |
| sports-fitness/swimming | An hour | Under $25 | Solo, A friend | Swim ten laps | 45 minutes, a public pool. |
| sports-fitness/martial-arts | An hour | Free | A friend, New people | Take a trial class | 1 hour, a local gym. |
| sports-fitness/strength-training | An hour | Under $25 | Solo, A friend | Learn the goblet squat | 20 minutes, one dumbbell at home or the gym. |
| sports-fitness/volleyball | An hour | Free | A friend, New people | Join a drop-in game | 1 hour, a park or gym. |
| art-creative/drawing | An hour | Free | Solo, A friend | Draw your coffee mug | 10 minutes, paper and a pencil. |
| art-creative/watercolor | An hour | Under $25 | Solo, A friend | Paint a color chart and a leaf | 30 minutes, a small watercolor set and paper. |
| art-creative/calligraphy | An hour | Under $25 | Solo, A friend | Practice basic brush pen strokes | 10 minutes, a brush pen and paper. |
| art-creative/theater | An hour | Free | A friend, New people | Perform a monologue three times | 20 minutes, a quiet room and your phone to record. |
| crafts-making/knitting | An hour | Under $25 | Solo, A friend | Cast on and knit a few rows | 30 minutes, needles and a ball of yarn. |
| crafts-making/crochet | An hour | Under $25 | Solo, A friend | Learn a chain and single crochet | 30 minutes, a hook and one ball of yarn. |
| crafts-making/embroidery | An hour | Under $25 | Solo, A friend | Stitch your initial | 30 minutes, a hoop, thread and a scrap of cotton. |
| crafts-making/sewing | An hour | Under $25 | Solo, A friend | Hem a pair of pants by hand | 1 hour, a needle, thread and a pair of pants. |
| crafts-making/woodworking | An hour | Under $25 | Solo, A friend | Sand and oil a cutting board | 1 hour, a workbench, sandpaper and oil. |
| crafts-making/jewelry-making | An hour | Under $25 | Solo, A friend | String a beaded bracelet | 30 minutes, beads and cord. |
| crafts-making/candle-making | An hour | Under $25 | Solo, A friend | Pour a jar candle | 1 hour, soy wax, a jar and a pot. |
| crafts-making/soap-making | An hour | Under $25 | Solo | Melt and pour a soap | 45 minutes, a soap base and a mold. |
| crafts-making/scrapbooking | An hour | Free | Solo, A friend | Glue three keepsakes onto a page | 15 minutes, a notebook, glue and saved tickets. |
| crafts-making/model-making | An hour | Under $25 | Solo | Snap together a beginner kit | 1 hour, a model kit and a table. |
| crafts-making/miniatures | An hour | Under $25 | Solo | Sculpt a tiny food item | 1 hour, polymer clay and a table. |
| books-writing/writing | An hour | Free | Solo, A friend | Write 300 words from a prompt | 20 minutes, a notebook or laptop. |
| books-writing/poetry | An hour | Free | Solo, A friend | Write an eight-line poem about your street | 15 minutes, paper and a pen. |
| books-writing/book-clubs | An hour | Under $25 | A friend, New people | Read a chapter and send it to a friend | 30 minutes, a short book and one friend. |
| books-writing/language-learning | An hour | Free | Solo, A friend | Learn ten phrases for ordering food | 15 minutes, an app or a phrasebook. |
| books-writing/reading | An hour | Free | Solo, A friend | Read 20 pages of a book | 30 minutes, a comfortable seat and a book. |
| nature-outdoors/hiking | Tonight | Free | Solo, A friend | Walk a trail under three miles | 2 hours, a trail near home. |
| nature-outdoors/birdwatching | An hour | Free | Solo, A friend | Listen for birds in a park | 15 minutes, a park and a bird ID app. |
| nature-outdoors/foraging | An hour | Free | A friend, New people | Learn to spot one common edible plant | 1 hour, a local park or trail and a field guide. |
| nature-outdoors/camping | An hour | Under $25 | A friend, New people | Pitch a tent | 30 minutes, a park or your living room. |
| nature-outdoors/fishing | An hour | Under $25 | Solo, A friend | Practice casting | 30 minutes, an open park and a practice plug. |
| home-garden/gardening | An hour | Under $25 | Solo, A friend | Plant an herb in a pot | 15 minutes, a pot, soil and a sunny sill. |
| home-garden/houseplants | An hour | Under $25 | Solo | Propagate a cutting in water | 10 minutes, a glass of water and a cutting. |
| home-garden/vegetable-gardens | An hour | Under $25 | Solo, A friend | Sow lettuce seeds in a container | 20 minutes, a container, soil and seeds. |
| home-garden/diy | An hour | Under $25 | Solo | Fix one small thing | 30 minutes, a how-to video and basic tools. |
| gaming-tabletop/board-games | An hour | Under $25 | A friend, New people | Teach friends a 30 minute game | 1 hour, a table and a board game. |
| gaming-tabletop/chess | An hour | Free | Solo, A friend | Play one game of chess | 20 minutes, a board or a chess app. |
| gaming-tabletop/puzzles | An hour | Under $25 | Solo, A friend | Start a 500 piece puzzle | 1 hour, a table and a puzzle. |
| gaming-tabletop/d-d | Tonight | Free | A friend, New people | Join a beginner one-shot | 3 hours, a local game store. |
| gaming-tabletop/video-games | An hour | Under $25 | A friend, New people | Schedule a co-op session | 1 hour, a co-op game and a friend. |
| music/music-production | An hour | Free | Solo | Make a four bar loop | 20 minutes, a music app. |
| music/singing | An hour | Free | Solo, A friend | Warm up and sing a song | 15 minutes, a quiet room. |
| music/guitar | An hour | Under $25 | Solo, A friend | Learn the G, C and D chords | 30 minutes, a guitar. |
| music/songwriting | An hour | Free | Solo, A friend | Write a four line chorus | 15 minutes, paper and a pen. |
| music/djing | An hour | Free | Solo, A friend | Practice a beatmatched transition | 20 minutes, a DJ app. |
| photography-film/photography | An hour | Free | Solo, A friend | Shoot one subject from 20 angles | 30 minutes, your phone or a camera. |
| photography-film/filmmaking | An hour | Free | A friend, New people | Shoot a 30 second film in three shots | 1 hour, your phone and a friend. |
| photography-film/film-photography | Weekend | Under $25 | Solo, A friend | Shoot a roll on a disposable camera | A few evenings, a disposable film camera. |
| photography-film/video | An hour | Free | Solo, A friend | Film ten clips and cut a 30 second edit | 45 minutes, your phone and an editing app. |
| health-wellness/yoga | An hour | Free | Solo, A friend | Do a 15 minute beginner flow | 15 minutes, a mat and a video. |
| health-wellness/pilates | An hour | Free | Solo, A friend | Do a 15 minute mat video | 15 minutes, a mat and a video. |
| health-wellness/meditation | An hour | Free | Solo, A friend | Count breaths for ten minutes | 10 minutes, a quiet seat. |
| health-wellness/breathwork | An hour | Free | Solo, A friend | Try box breathing | 5 minutes, a quiet seat. |
| fashion-beauty/sneakers | An hour | Under $25 | Solo | Deep clean a pair of sneakers | 30 minutes, a brush, soap and a pair you own. |
| fashion-beauty/thrifting | An hour | Under $25 | Solo, A friend | Visit a thrift store with a list | 1 hour, a thrift store. |
| fashion-beauty/makeup | An hour | Under $25 | Solo, A friend | Recreate a look from a tutorial | 30 minutes, your own makeup and a video. |
| fashion-beauty/nails | An hour | Under $25 | Solo, A friend | Try a dotted nail design | 30 minutes, a bobby pin and nail polish. |
| fashion-beauty/fragrance | An hour | Free | Solo, A friend | Sample three scents | 30 minutes, a store with testers. |
| tech-building/3d-printing | Tonight | Free | Solo | Print a downloaded model | 2 hours, a library makerspace. |
| tech-building/electronics | An hour | Under $25 | Solo | Blink an LED | 45 minutes, a starter kit. |
| tech-building/drones | An hour | Under $25 | Solo | Fly a drone simulator | 15 minutes, a laptop or phone. |
| tech-building/coding | An hour | Free | Solo, A friend | Build a one page website | 1 hour, a laptop. |
| tech-building/ai-projects | An hour | Free | Solo, A friend | Plan something real with an AI tool | 20 minutes, a laptop or phone. |
| collecting-fandom/lego | An hour | Under $25 | Solo, A friend | Build a small set | 1 hour, a set or a bin of bricks. |
| collecting-fandom/vinyl | An hour | Under $25 | Solo, A friend | Listen to an album on vinyl | 1 hour, a record store. |
| travel-adventure/backpacking | Tonight | Free | A friend, New people | Walk two miles with a day bag | 1 hour, a day bag with the 10 essentials. |
| travel-adventure/skiing | An hour | Free | A friend, New people | Practice the snowplow stance | 15 minutes, floor space at home. |
| travel-adventure/exploration | An hour | Free | Solo, A friend | Walk a neighborhood you have never visited | 15 minutes, a neighborhood new to you. |
| art-creative/illustration | An hour | Free | Solo | Illustrate one thing from your day | 30 minutes, paper and a pen. |
| crafts-making/zines | An hour | Free | Solo, A friend | Fold and fill a mini zine | 30 minutes, one sheet of paper and a pen. |
| crafts-making/upcycling | An hour | Free | Solo | Flip an old T-shirt | 1 hour, an old T-shirt and scissors. |
| crafts-making/pottery | Tonight | Treat me | Solo, A friend | Take a beginner wheel class | 2 hours, a local studio. |
| sports-fitness/boxing | An hour | Under $25 | A friend, New people | Take a beginner boxing class | 1 hour, a boxing gym. |
| sports-fitness/skateboarding | An hour | Under $25 | Solo, A friend | Practice pushing on a skateboard | 30 minutes, a flat quiet path and a helmet. |
| sports-fitness/soccer | An hour | Under $25 | A friend, New people | Join a pickup game | 1 hour, a local field. |
| sports-fitness/basketball | An hour | Under $25 | Solo, A friend | Shoot hoops at a public court | 1 hour, a public court. |
| home-garden/composting | An hour | Under $25 | Solo | Start a kitchen scrap bin | 30 minutes, a small bin, greens and browns. |
| nature-outdoors/surfing | Weekend | Treat me | Solo, A friend | Take a beginner surf lesson | 3 hours, a surf school on the coast. |
| nature-outdoors/kayaking | Weekend | Under $25 | Solo, A friend | Take a guided kayak tour | 3 hours, calm water and a tour company. |
| music/choir | Tonight | Free | A friend, New people | Go to an open choir rehearsal | 2 hours, a community choir. |
| music/karaoke | Tonight | Under $25 | A friend, New people | Book a karaoke room | 2 hours, a karaoke venue and a few friends. |
| music/live-music | Tonight | Under $25 | A friend, New people | See a small local gig | 3 hours, a small venue. |
| art-creative/improv | Tonight | Under $25 | A friend, New people | Join a beginner improv workshop | 2 hours, a local workshop. |
| food-cooking/pasta | An hour | Under $25 | Solo, A friend | Roll fresh pasta by hand | 1 hour, your kitchen, flour and eggs. |
| health-wellness/sauna-cold-plunge | Tonight | Under $25 | A friend, New people | Try a sauna or bathhouse session | 2 hours, a sauna or bathhouse. |
| gaming-tabletop/trivia | Tonight | Under $25 | A friend, New people | Join a quiz night with a team | 2 hours, a bar or café with a quiz night. |
| travel-adventure/volunteering | Weekend | Free | A friend, New people | Sign up for a volunteer shift | 3 hours, a local cause. |
| home-garden/interior-design | Tonight | Free | Solo | Make a moodboard for one room | 2 hours, your room and a few photos. |
| tech-building/web-design | An hour | Free | Solo | Build a one page personal site | 1 hour, a laptop and a simple tool. |
| home-garden/furniture-flipping | Weekend | Under $25 | Solo | Sand and repaint a secondhand chair | 4 hours, a secondhand chair, sandpaper and paint. |
| crafts-making/makerspaces | Tonight | Under $25 | A friend, New people | Visit a makerspace open night | 2 hours, a local makerspace. |
| food-cooking/bbq | Tonight | Under $25 | Solo, A friend | Grill over charcoal with friends | 2 hours, a park grill or backyard. |
| art-creative/painting | An hour | Under $25 | Solo | Paint a small scene from a photo | 1 hour, paints and a small canvas. |
| art-creative/sculpture | An hour | Under $25 | Solo | Shape a figure from air-dry clay | 1 hour, air-dry clay and a table. |
| crafts-making/paper-crafts | An hour | Free | Solo, A friend | Make a card for someone | 30 minutes, paper and scissors. |
| gaming-tabletop/trading-cards | Tonight | Under $25 | A friend, New people | Play a starter deck at a card night | 2 hours, a local game store. |
| fashion-beauty/fashion | An hour | Free | Solo, A friend | Build three outfits from your closet | 30 minutes, your closet. |
| tech-building/robotics | Weekend | Under $25 | Solo, A friend | Build a starter robot kit with a friend | 4 hours, a robot kit and a friend. |
| tech-building/game-development | Tonight | Free | Solo | Make a one screen game | 2 hours, a laptop and a beginner engine. |
| collecting-fandom/antiques | Tonight | Under $25 | Solo, A friend | Pick one piece at a flea market | 2 hours, a flea market or antique fair. |
| collecting-fandom/anime | An hour | Free | Solo, A friend | Watch a first episode with a friend | 30 minutes, a screen and a friend. |
| travel-adventure/travel | Weekend | Under $25 | Solo, A friend | Plan a day trip | A full day, a town you have never visited. |
| travel-adventure/road-trips | Weekend | Under $25 | A friend, New people | Plan a one day loop | A full day, a car and a crew. |
| sports-fitness/climbing | Tonight | Treat me | A friend, New people | Try an intro bouldering session | 90 minutes, a climbing gym. |
| sports-fitness/dance | An hour | Under $25 | A friend, New people | Try a salsa, swing or bachata class | 1 hour, a dance studio. |
| nature-outdoors/wild-swimming | Weekend | Under $25 | Solo, A friend | Find a safe swim spot | 2 hours, a known and safe swim spot. |
| music/make-a-beat | An hour | Under $25 | Solo | Make a beat | 30 minutes, a beat-making app. |
| art-creative/life-drawing | Tonight | Under $25 | A friend, New people | Go to a drop-in life drawing session | 2 hours, a local studio. |
| travel-adventure/city-walks | An hour | Free | Solo, A friend | Walk a neighborhood you have never walked | 1 hour, a neighborhood new to you. |
| photography-film/film-clubs | Tonight | Free | A friend, New people | Pick a film and watch it together | 3 hours, a screen or cinema and some friends. |
| food-cooking/food-tours | Tonight | Under $25 | Solo, A friend | Eat your way down one street | 2 hours, a street or market known for food. |
| gaming-tabletop/mahjong | An hour | Under $25 | A friend, New people | Learn the tiles | 1 hour, a rules guide and a set. |
| travel-adventure/rafting | Weekend | Under $25 | A friend, New people | Pick a beginner river stretch | A full day, a guided trip. |
| books-writing/letter-writing | An hour | Free | Solo, A friend | Write a letter by hand | 30 minutes, paper, a pen and a stamp. |
| sports-fitness/hyrox | An hour | Under $25 | A friend, New people | Learn the eight Hyrox stations | 1 hour, a gym. |
| sports-fitness/walking-clubs | An hour | Free | A friend, New people | Join a walking group | 1 hour, a meetup point near you. |
| sports-fitness/badminton | An hour | Under $25 | A friend, New people | Rally with a racket and shuttles | 45 minutes, a court or park. |
| sports-fitness/skating | An hour | Under $25 | Solo, A friend | Rent skates for a first go | 1 hour, a rink. |
| sports-fitness/ultimate-frisbee | An hour | Under $25 | A friend, New people | Learn the backhand throw | 30 minutes, a disc and a friend in a park. |
| sports-fitness/cricket | An hour | Under $25 | A friend, New people | Ask for a turn at a local game | 1 hour, a local ground or park. |
| gaming-tabletop/carrom | An hour | Under $25 | A friend, New people | Play a game of carrom | 30 minutes, a board and a friend. |
| sports-fitness/table-tennis | An hour | Under $25 | A friend, New people | Rally on a table | 30 minutes, a table and a friend. |
| art-creative/open-mics | Tonight | Under $25 | A friend, New people | Watch an open mic | 2 hours, a local venue. |
| art-creative/indian-classical-dance | An hour | Under $25 | Solo, A friend | Watch a recital and pick a style | 1 hour, a recital or a video of one. |
| music/indian-classical-music | An hour | Under $25 | Solo, A friend | Listen to Carnatic and Hindustani pieces | 30 minutes, headphones and two recordings. |
| music/piano | An hour | Under $25 | Solo | Pick out a simple tune | 20 minutes, a piano or keyboard. |
| health-wellness/sound-baths | Tonight | Under $25 | A friend, New people | Book a group sound bath | 90 minutes, a studio or hall. |
| nature-outdoors/stargazing | An hour | Free | Solo, A friend | Look up after dark | 10 minutes, a dark spot away from bright lights. |
| crafts-making/block-printing | An hour | Under $25 | Solo, A friend | Print a simple shape with a potato | 20 minutes, a cut potato, ink and paper. |
