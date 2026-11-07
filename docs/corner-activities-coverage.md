# Corner activities: what each of the 50 Corners still needs for the main grid

Brief of Nov 7, 2026, section 2.4. A Corner with activities counts as having a **guide** for the "no Corner ships thin" rule (`hasGuide` in `src/app/data/homeCorners.ts`). To move from the "Not started here yet" chips into the main grid on `/corners` and its category page it also needs a **curated entry** (`src/app/data/curatedCorners.ts`) and its **own photo with a credit** (`src/app/data/hobbyPhotos.ts`). It moves on its own once it has all three. **No photos are picked here; that is yours.**

**5 of the 50 are already complete** (they were built-in Corners with a curated entry and a photo before the activities arrived): Badminton, Karaoke, Mahjong, Skateboarding, Table tennis. They keep their place in the grid and gain a "Things to try" section.

**The other 45** have a guide (their six activities) and still need the two things below. Nothing else is missing for any of them: all 50 resolve through the catalog merge to the Corner people see (45 are catalog Corners under their own slug; the five merged ones land on the existing Corner of the same slug).

| Corner | Slug | Space | Guide (activities) | Curated entry | Own photo and credit |
|---|---|---|---|---|---|
| Animation | `animation` | `art-creative` | yes | missing | missing |
| Astronomy | `astronomy` | `nature-outdoors` | yes | missing | missing |
| Badminton | `badminton` | `sports-fitness` | yes | yes | yes |
| Beachcombing | `beachcombing` | `nature-outdoors` | yes | missing | missing |
| Beatboxing | `beatboxing` | `music` | yes | missing | missing |
| Bonsai | `bonsai` | `home-garden` | yes | missing | missing |
| Breadmaking | `breadmaking` | `food-cooking` | yes | missing | missing |
| Bullet journaling | `bullet-journaling` | `books-writing` | yes | missing | missing |
| Calisthenics | `calisthenics` | `sports-fitness` | yes | missing | missing |
| Card games | `card-games` | `gaming-tabletop` | yes | missing | missing |
| Cheesemaking | `cheesemaking` | `food-cooking` | yes | missing | missing |
| Clothesmaking | `clothesmaking` | `fashion-beauty` | yes | missing | missing |
| Coffee roasting | `coffee-roasting` | `food-cooking` | yes | missing | missing |
| Cross-stitch | `cross-stitch` | `crafts-making` | yes | missing | missing |
| Crossword puzzles | `crossword-puzzles` | `gaming-tabletop` | yes | missing | missing |
| Flower arranging | `flower-arranging` | `home-garden` | yes | missing | missing |
| Geocaching | `geocaching` | `nature-outdoors` | yes | missing | missing |
| Go | `go` | `gaming-tabletop` | yes | missing | missing |
| Juggling | `juggling` | `sports-fitness` | yes | missing | missing |
| Jumping rope | `jumping-rope` | `sports-fitness` | yes | missing | missing |
| Karaoke | `karaoke` | `music` | yes | yes | yes |
| Kite flying | `kite-flying` | `nature-outdoors` | yes | missing | missing |
| Leathercraft | `leathercraft` | `crafts-making` | yes | missing | missing |
| Macrame | `macrame` | `crafts-making` | yes | missing | missing |
| Mahjong | `mahjong` | `gaming-tabletop` | yes | yes | yes |
| Museum visiting | `museum-visiting` | `travel-adventure` | yes | missing | missing |
| Origami | `origami` | `crafts-making` | yes | missing | missing |
| People-watching | `people-watching` | `travel-adventure` | yes | missing | missing |
| Philosophy | `philosophy` | `books-writing` | yes | missing | missing |
| Picnicking | `picnicking` | `nature-outdoors` | yes | missing | missing |
| Playing an instrument | `playing-an-instrument` | `music` | yes | missing | missing |
| Podcasting | `podcasting` | `books-writing` | yes | missing | missing |
| Postcrossing | `postcrossing` | `books-writing` | yes | missing | missing |
| Quilting | `quilting` | `crafts-making` | yes | missing | missing |
| Recipe creation | `recipe-creation` | `food-cooking` | yes | missing | missing |
| Rock painting | `rock-painting` | `art-creative` | yes | missing | missing |
| Roller skating | `roller-skating` | `sports-fitness` | yes | missing | missing |
| Skateboarding | `skateboarding` | `sports-fitness` | yes | yes | yes |
| Sketching | `sketching` | `art-creative` | yes | missing | missing |
| Social dancing | `social-dancing` | `sports-fitness` | yes | missing | missing |
| Speedcubing | `speedcubing` | `gaming-tabletop` | yes | missing | missing |
| Stamp collecting | `stamp-collecting` | `collecting-fandom` | yes | missing | missing |
| Stand-up comedy | `stand-up-comedy` | `art-creative` | yes | missing | missing |
| Stretching | `stretching` | `health-wellness` | yes | missing | missing |
| Table tennis | `table-tennis` | `sports-fitness` | yes | yes | yes |
| Tai chi | `tai-chi` | `health-wellness` | yes | missing | missing |
| Terrariums | `terrariums` | `home-garden` | yes | missing | missing |
| Video editing | `video-editing` | `photography-film` | yes | missing | missing |
| Walking | `walking` | `sports-fitness` | yes | missing | missing |
| Whittling | `whittling` | `crafts-making` | yes | missing | missing |

Regenerate this list from the code by running the completeness check (`isCompleteCorner`) over `cornersWithActivities()`; the numbers above are as of this PR.
