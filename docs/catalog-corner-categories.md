# Catalog Corners and the 18 categories

For the founder to review. The 307 Corners added from `data/corners_catalog.csv` had no category, so `/corners`, the category pages and Discover skipped them. This is the assignment, one category each, from the 18 in `docs/categories-18.md` (names unchanged). The CSV only has the 15 old groups, so each Corner was placed by what it is, not by its old group.

**"review"** marks a judgement call (a Corner that could sit in two categories). Change any row by editing `src/app/data/catalogCornerCategories.ts`; a Corner with no entry fails a test.

Rule of thumb used: a sport you play against others or a martial art goes to Sports and martial arts; exercise you do for fitness goes to Running and fitness; collecting hobbies go to Collecting and style, except found-in-nature collecting (shells, sea glass, rocks), which goes to Outdoors and adventure; performing arts, circus and spinning arts go to Dance and stage; tarot, astrology and body practices of stillness go to Rest and ritual.


## Yarn and fabric (`yarn-fabric`), 10

| Corner | Slug | Old Space | |
|---|---|---|---|
| Clothesmaking | `clothesmaking` | `fashion-beauty` |  |
| Cosplay | `cosplay` | `fashion-beauty` |  |
| Cross-stitch | `cross-stitch` | `crafts-making` |  |
| Lace making | `lace-making` | `crafts-making` |  |
| Macrame | `macrame` | `crafts-making` |  |
| Needlepoint | `needlepoint` | `crafts-making` |  |
| Quilting | `quilting` | `crafts-making` |  |
| Rug hooking | `rug-hooking` | `crafts-making` |  |
| Tapestry | `tapestry` | `crafts-making` |  |
| Weaving | `weaving` | `crafts-making` |  |

## Crafts and DIY (`crafts-diy`), 27

| Corner | Slug | Old Space | |
|---|---|---|---|
| Blacksmithing | `blacksmithing` | `crafts-making` |  |
| Book folding | `book-folding` | `crafts-making` |  |
| Book restoration | `book-restoration` | `crafts-making` |  |
| Diamond painting | `diamond-painting` | `crafts-making` |  |
| Diorama making | `diorama-making` | `crafts-making` |  |
| Engraving | `engraving` | `crafts-making` |  |
| Fly tying | `fly-tying` | `crafts-making` |  |
| Furniture building | `furniture-building` | `crafts-making` |  |
| Furniture refinishing | `furniture-refinishing` | `crafts-making` |  |
| Glassblowing | `glassblowing` | `crafts-making` |  |
| Hydro dipping | `hydro-dipping` | `crafts-making` |  |
| Knot tying | `knot-tying` | `crafts-making` |  |
| Lapidary | `lapidary` | `crafts-making` |  |
| Leathercraft | `leathercraft` | `crafts-making` |  |
| Metalworking | `metalworking` | `crafts-making` |  |
| Origami | `origami` | `crafts-making` |  |
| Pressed flower craft | `pressed-flower-craft` | `crafts-making` |  |
| Pyrography | `pyrography` | `crafts-making` |  |
| Quilling | `quilling` | `crafts-making` |  |
| Rock painting | `rock-painting` | `art-creative` | review |
| Shoemaking | `shoemaking` | `crafts-making` |  |
| Soapmaking | `soapmaking` | `crafts-making` |  |
| Watchmaking | `watchmaking` | `crafts-making` |  |
| Wax sealing | `wax-sealing` | `crafts-making` |  |
| Welding | `welding` | `crafts-making` |  |
| Whittling | `whittling` | `crafts-making` |  |
| Wood carving | `wood-carving` | `crafts-making` |  |

## Art and design (`art-design`), 6

| Corner | Slug | Old Space | |
|---|---|---|---|
| Animation | `animation` | `art-creative` | review |
| Coloring | `coloring` | `art-creative` |  |
| Miniature painting | `miniature-painting` | `art-creative` | review |
| Sand art | `sand-art` | `art-creative` |  |
| Sculpting | `sculpting` | `art-creative` |  |
| Sketching | `sketching` | `art-creative` |  |

## Tech and tinkering (`tech-tinkering`), 14

| Corner | Slug | Old Space | |
|---|---|---|---|
| Auto detailing | `auto-detailing` | `tech-building` | review |
| Car restoration | `car-restoration` | `tech-building` | review |
| Car tuning | `car-tuning` | `tech-building` | review |
| Distro hopping | `distro-hopping` | `tech-building` |  |
| Flying model planes | `flying-model-planes` | `tech-building` |  |
| Gadget reviewing | `gadget-reviewing` | `tech-building` | review |
| Ham radio | `ham-radio` | `tech-building` |  |
| Inventing | `inventing` | `tech-building` |  |
| Lego building | `lego-building` | `crafts-making` | review |
| Machining | `machining` | `tech-building` |  |
| Microscopy | `microscopy` | `tech-building` | review |
| PC benchmarking & overclocking | `pc-benchmarking-and-overclocking` | `tech-building` |  |
| RC models | `rc-models` | `tech-building` |  |
| Shortwave listening | `shortwave-listening` | `tech-building` |  |

## Food and drink (`food-drink`), 10

| Corner | Slug | Old Space | |
|---|---|---|---|
| Beer tasting | `beer-tasting` | `food-cooking` |  |
| Breadmaking | `breadmaking` | `food-cooking` |  |
| Candy making | `candy-making` | `food-cooking` |  |
| Cheesemaking | `cheesemaking` | `food-cooking` |  |
| Coffee roasting | `coffee-roasting` | `food-cooking` |  |
| Gingerbread house making | `gingerbread-house-making` | `food-cooking` |  |
| Gongfu tea | `gongfu-tea` | `food-cooking` |  |
| Kombucha brewing | `kombucha-brewing` | `food-cooking` |  |
| Recipe creation | `recipe-creation` | `food-cooking` | review |
| Wine tasting & making | `wine-tasting-and-making` | `food-cooking` |  |

## Running and fitness (`running-fitness`), 13

| Corner | Slug | Old Space | |
|---|---|---|---|
| Acroyoga | `acroyoga` | `sports-fitness` | review |
| Bodybuilding | `bodybuilding` | `sports-fitness` |  |
| Calisthenics | `calisthenics` | `sports-fitness` |  |
| Fitness | `fitness` | `sports-fitness` |  |
| Jogging | `jogging` | `sports-fitness` |  |
| Jumping rope | `jumping-rope` | `sports-fitness` |  |
| Powerlifting | `powerlifting` | `sports-fitness` |  |
| Race walking | `race-walking` | `sports-fitness` |  |
| Stretching | `stretching` | `health-wellness` | review |
| Triathlon | `triathlon` | `sports-fitness` |  |
| Walking | `walking` | `sports-fitness` |  |
| Weightlifting | `weightlifting` | `sports-fitness` |  |
| Zumba | `zumba` | `sports-fitness` | review |

## Sports and martial arts (`sports-martial-arts`), 54

| Corner | Slug | Old Space | |
|---|---|---|---|
| Archery | `archery` | `sports-fitness` |  |
| Auto racing | `auto-racing` | `sports-fitness` | review |
| Axe throwing | `axe-throwing` | `sports-fitness` |  |
| BMX | `bmx` | `sports-fitness` |  |
| Baseball | `baseball` | `sports-fitness` |  |
| Beach volleyball | `beach-volleyball` | `sports-fitness` |  |
| Bowling | `bowling` | `sports-fitness` |  |
| Brazilian jiu-jitsu | `brazilian-jiu-jitsu` | `sports-fitness` |  |
| Croquet | `croquet` | `sports-fitness` |  |
| Curling | `curling` | `sports-fitness` |  |
| Disc golf | `disc-golf` | `sports-fitness` |  |
| Fencing | `fencing` | `sports-fitness` |  |
| Field hockey | `field-hockey` | `sports-fitness` |  |
| Figure skating | `figure-skating` | `sports-fitness` |  |
| Flag football | `flag-football` | `sports-fitness` |  |
| Footbag | `footbag` | `sports-fitness` |  |
| Freestyle football | `freestyle-football` | `sports-fitness` |  |
| Frisbee | `frisbee` | `sports-fitness` |  |
| Golf | `golf` | `sports-fitness` |  |
| Groundhopping | `groundhopping` | `sports-fitness` |  |
| Gymnastics | `gymnastics` | `sports-fitness` |  |
| Handball | `handball` | `sports-fitness` |  |
| Horseback riding | `horseback-riding` | `sports-fitness` |  |
| Hurling | `hurling` | `sports-fitness` |  |
| Ice hockey | `ice-hockey` | `sports-fitness` |  |
| Iceboating | `iceboating` | `sports-fitness` | review |
| Inline skating | `inline-skating` | `sports-fitness` |  |
| Judo | `judo` | `sports-fitness` |  |
| Jujitsu | `jujitsu` | `sports-fitness` |  |
| Kabaddi | `kabaddi` | `sports-fitness` |  |
| Kart racing | `kart-racing` | `sports-fitness` | review |
| Kendo | `kendo` | `sports-fitness` |  |
| Lacrosse | `lacrosse` | `sports-fitness` |  |
| Longboarding | `longboarding` | `sports-fitness` |  |
| Netball | `netball` | `sports-fitness` |  |
| Nordic skating | `nordic-skating` | `sports-fitness` |  |
| Paintball | `paintball` | `sports-fitness` |  |
| Parkour | `parkour` | `sports-fitness` |  |
| Polo | `polo` | `sports-fitness` |  |
| Powerboat racing | `powerboat-racing` | `sports-fitness` | review |
| Quadball | `quadball` | `sports-fitness` |  |
| Racquetball | `racquetball` | `sports-fitness` |  |
| Roller derby | `roller-derby` | `sports-fitness` |  |
| Roller skating | `roller-skating` | `sports-fitness` |  |
| Rugby | `rugby` | `sports-fitness` |  |
| Skimboarding | `skimboarding` | `sports-fitness` |  |
| Slacklining | `slacklining` | `sports-fitness` |  |
| Softball | `softball` | `sports-fitness` |  |
| Speed skating | `speed-skating` | `sports-fitness` |  |
| Squash | `squash` | `sports-fitness` |  |
| Taekwondo | `taekwondo` | `sports-fitness` |  |
| Unicycling | `unicycling` | `sports-fitness` |  |
| Water polo | `water-polo` | `sports-fitness` |  |
| Wrestling | `wrestling` | `sports-fitness` |  |

## Dance and stage (`dance-stage`), 18

| Corner | Slug | Old Space | |
|---|---|---|---|
| Acting | `acting` | `art-creative` |  |
| Ballet | `ballet` | `sports-fitness` |  |
| Ballroom dancing | `ballroom-dancing` | `sports-fitness` |  |
| Baton twirling | `baton-twirling` | `sports-fitness` |  |
| Breakdancing | `breakdancing` | `sports-fitness` |  |
| Cheerleading | `cheerleading` | `sports-fitness` |  |
| Color guard | `color-guard` | `sports-fitness` |  |
| Exhibition drill | `exhibition-drill` | `sports-fitness` | review |
| Hula hooping | `hula-hooping` | `sports-fitness` | review |
| Juggling | `juggling` | `sports-fitness` | review |
| Performance art | `performance-art` | `art-creative` |  |
| Poi spinning | `poi-spinning` | `sports-fitness` | review |
| Pole dancing | `pole-dancing` | `sports-fitness` |  |
| Puppetry | `puppetry` | `art-creative` |  |
| Social dancing | `social-dancing` | `sports-fitness` |  |
| Stage magic | `stage-magic` | `art-creative` |  |
| Stand-up comedy | `stand-up-comedy` | `art-creative` |  |
| Voice acting | `voice-acting` | `art-creative` |  |

## Outdoors and adventure (`outdoors-adventure`), 44

| Corner | Slug | Old Space | |
|---|---|---|---|
| Aircraft spotting | `aircraft-spotting` | `travel-adventure` | review |
| Astronomy | `astronomy` | `nature-outdoors` | review |
| Beachcombing | `beachcombing` | `nature-outdoors` |  |
| Botany | `botany` | `nature-outdoors` | review |
| Butterfly watching | `butterfly-watching` | `nature-outdoors` |  |
| Canoeing | `canoeing` | `nature-outdoors` |  |
| Canyoneering | `canyoneering` | `travel-adventure` |  |
| Car spotting | `car-spotting` | `collecting-fandom` | review |
| Caving | `caving` | `travel-adventure` |  |
| Diving | `diving` | `travel-adventure` |  |
| Fossil hunting | `fossil-hunting` | `nature-outdoors` |  |
| Fruit picking | `fruit-picking` | `nature-outdoors` |  |
| Geocaching | `geocaching` | `nature-outdoors` |  |
| Gold prospecting | `gold-prospecting` | `nature-outdoors` |  |
| Herping | `herping` | `nature-outdoors` |  |
| Kite flying | `kite-flying` | `nature-outdoors` |  |
| Kitesurfing | `kitesurfing` | `travel-adventure` |  |
| Letterboxing | `letterboxing` | `nature-outdoors` |  |
| Magnet fishing | `magnet-fishing` | `nature-outdoors` |  |
| Metal detecting | `metal-detecting` | `nature-outdoors` |  |
| Motorcycling | `motorcycling` | `travel-adventure` | review |
| Mountain biking | `mountain-biking` | `sports-fitness` | review |
| Mountaineering | `mountaineering` | `travel-adventure` |  |
| Orienteering | `orienteering` | `nature-outdoors` |  |
| Paragliding | `paragliding` | `travel-adventure` |  |
| Picnicking | `picnicking` | `nature-outdoors` |  |
| Rappelling | `rappelling` | `travel-adventure` |  |
| Rock balancing | `rock-balancing` | `nature-outdoors` |  |
| Rock collecting | `rock-collecting` | `nature-outdoors` | review |
| Rowing | `rowing` | `sports-fitness` | review |
| Sailing | `sailing` | `travel-adventure` |  |
| Sea glass collecting | `sea-glass-collecting` | `nature-outdoors` | review |
| Shell collecting | `shell-collecting` | `nature-outdoors` | review |
| Skydiving | `skydiving` | `travel-adventure` |  |
| Sledding | `sledding` | `nature-outdoors` |  |
| Snorkeling | `snorkeling` | `travel-adventure` |  |
| Snowboarding | `snowboarding` | `sports-fitness` |  |
| Snowmobiling | `snowmobiling` | `travel-adventure` |  |
| Snowshoeing | `snowshoeing` | `nature-outdoors` |  |
| Spearfishing | `spearfishing` | `nature-outdoors` |  |
| Stone skipping | `stone-skipping` | `nature-outdoors` |  |
| Thru-hiking | `thru-hiking` | `travel-adventure` |  |
| Trainspotting | `trainspotting` | `travel-adventure` | review |
| Weather watching | `weather-watching` | `nature-outdoors` |  |

## Home and garden (`home-garden`), 18

| Corner | Slug | Old Space | |
|---|---|---|---|
| Ant keeping | `ant-keeping` | `home-garden` |  |
| Aquaponics | `aquaponics` | `home-garden` |  |
| Aquascaping | `aquascaping` | `home-garden` |  |
| Beekeeping | `beekeeping` | `home-garden` |  |
| Bonsai | `bonsai` | `home-garden` |  |
| Decorating | `decorating` | `home-garden` |  |
| Dog training | `dog-training` | `home-garden` | review |
| Feng shui decorating | `feng-shui-decorating` | `home-garden` |  |
| Fishkeeping | `fishkeeping` | `home-garden` |  |
| Flower arranging | `flower-arranging` | `home-garden` |  |
| Flower growing | `flower-growing` | `home-garden` |  |
| Home improvement | `home-improvement` | `home-garden` |  |
| Hydroponics | `hydroponics` | `home-garden` |  |
| Pet sitting | `pet-sitting` | `home-garden` | review |
| Terrariums | `terrariums` | `home-garden` |  |
| Topiary | `topiary` | `home-garden` |  |
| Urban farming | `urban-farming` | `home-garden` |  |
| Vegetable gardening | `vegetable-gardening` | `home-garden` |  |

## Games and puzzles (`games-puzzles`), 37

| Corner | Slug | Old Space | |
|---|---|---|---|
| Air hockey | `air-hockey` | `gaming-tabletop` |  |
| Backgammon | `backgammon` | `gaming-tabletop` |  |
| Billiards | `billiards` | `gaming-tabletop` |  |
| Bridge | `bridge` | `gaming-tabletop` |  |
| Card games | `card-games` | `gaming-tabletop` |  |
| Cardistry | `cardistry` | `gaming-tabletop` |  |
| Checkers | `checkers` | `gaming-tabletop` |  |
| Cornhole | `cornhole` | `gaming-tabletop` |  |
| Cribbage | `cribbage` | `gaming-tabletop` |  |
| Crossword puzzles | `crossword-puzzles` | `gaming-tabletop` |  |
| Cryptography & ciphers | `cryptography-and-ciphers` | `tech-building` | review |
| Darts | `darts` | `gaming-tabletop` |  |
| Dominoes | `dominoes` | `gaming-tabletop` |  |
| Esports | `esports` | `gaming-tabletop` |  |
| Fantasy sports | `fantasy-sports` | `gaming-tabletop` |  |
| Foosball | `foosball` | `gaming-tabletop` |  |
| Go | `go` | `gaming-tabletop` |  |
| Horseshoes | `horseshoes` | `gaming-tabletop` |  |
| Jigsaw puzzles | `jigsaw-puzzles` | `gaming-tabletop` |  |
| Kendama | `kendama` | `gaming-tabletop` |  |
| LARPing | `larping` | `gaming-tabletop` |  |
| Laser tag | `laser-tag` | `gaming-tabletop` |  |
| Marbles | `marbles` | `gaming-tabletop` |  |
| Mazes | `mazes` | `gaming-tabletop` |  |
| Memory training | `memory-training` | `gaming-tabletop` | review |
| Mini golf | `mini-golf` | `gaming-tabletop` |  |
| Pen spinning | `pen-spinning` | `gaming-tabletop` |  |
| Recreational math | `recreational-math` | `gaming-tabletop` |  |
| Shogi | `shogi` | `gaming-tabletop` |  |
| Shuffleboard | `shuffleboard` | `gaming-tabletop` |  |
| Slot cars | `slot-cars` | `gaming-tabletop` |  |
| Speedcubing | `speedcubing` | `gaming-tabletop` |  |
| Sport stacking | `sport-stacking` | `gaming-tabletop` |  |
| Sudoku | `sudoku` | `gaming-tabletop` |  |
| VR gaming | `vr-gaming` | `gaming-tabletop` |  |
| Wargaming | `wargaming` | `gaming-tabletop` |  |
| Yo-yoing | `yo-yoing` | `gaming-tabletop` |  |

## Music and sound (`music-sound`), 8

| Corner | Slug | Old Space | |
|---|---|---|---|
| Audiophile listening | `audiophile-listening` | `music` |  |
| Beatboxing | `beatboxing` | `music` |  |
| Bell ringing | `bell-ringing` | `music` |  |
| Djembe | `djembe` | `music` |  |
| Marching band | `marching-band` | `music` |  |
| Playing an instrument | `playing-an-instrument` | `music` |  |
| Podcasting | `podcasting` | `books-writing` | review |
| Rapping | `rapping` | `music` |  |

## Photo and film (`photo-film`), 2

| Corner | Slug | Old Space | |
|---|---|---|---|
| Lomography | `lomography` | `photography-film` |  |
| Video editing | `video-editing` | `photography-film` |  |

## Reading and writing (`reading-writing`), 7

| Corner | Slug | Old Space | |
|---|---|---|---|
| Blogging | `blogging` | `books-writing` |  |
| Bullet journaling | `bullet-journaling` | `books-writing` |  |
| Conlanging | `conlanging` | `books-writing` | review |
| Journaling | `journaling` | `books-writing` |  |
| Manga & manhwa | `manga-and-manhwa` | `books-writing` |  |
| Philosophy | `philosophy` | `books-writing` | review |
| Postcrossing | `postcrossing` | `books-writing` | review |

## Skills and side projects (`skills-side-projects`), 5

| Corner | Slug | Old Space | |
|---|---|---|---|
| Couponing | `couponing` | `home-garden` | review |
| Debate | `debate` | `books-writing` | review |
| Genealogy | `genealogy` | `books-writing` | review |
| Public speaking | `public-speaking` | `books-writing` | review |
| Spreadsheets | `spreadsheets` | `tech-building` | review |

## Collecting and style (`collecting-style`), 24

| Corner | Slug | Old Space | |
|---|---|---|---|
| Action figure collecting | `action-figure-collecting` | `collecting-fandom` |  |
| Antiquing | `antiquing` | `collecting-fandom` |  |
| Art collecting | `art-collecting` | `collecting-fandom` |  |
| Book collecting | `book-collecting` | `collecting-fandom` |  |
| Button collecting | `button-collecting` | `collecting-fandom` |  |
| Coin collecting | `coin-collecting` | `collecting-fandom` |  |
| Comic book collecting | `comic-book-collecting` | `collecting-fandom` |  |
| Crystal collecting | `crystal-collecting` | `health-wellness` | review |
| Ephemera collecting | `ephemera-collecting` | `collecting-fandom` |  |
| Grooming | `grooming` | `fashion-beauty` | review |
| Matchbox collecting | `matchbox-collecting` | `collecting-fandom` |  |
| Mineral collecting | `mineral-collecting` | `collecting-fandom` | review |
| Movie memorabilia collecting | `movie-memorabilia-collecting` | `collecting-fandom` |  |
| Patch collecting | `patch-collecting` | `collecting-fandom` |  |
| Perfume | `perfume` | `fashion-beauty` | review |
| Pin collecting | `pin-collecting` | `collecting-fandom` |  |
| Postcard collecting | `postcard-collecting` | `collecting-fandom` |  |
| Record collecting | `record-collecting` | `collecting-fandom` |  |
| Sports memorabilia | `sports-memorabilia` | `collecting-fandom` |  |
| Stamp collecting | `stamp-collecting` | `collecting-fandom` |  |
| Swapping & trading | `swapping-and-trading` | `collecting-fandom` |  |
| Ticket collecting | `ticket-collecting` | `collecting-fandom` |  |
| Video game collecting | `video-game-collecting` | `collecting-fandom` |  |
| Vintage clothing | `vintage-clothing` | `fashion-beauty` | review |

## Culture and community (`culture-community`), 5

| Corner | Slug | Old Space | |
|---|---|---|---|
| Ghost hunting | `ghost-hunting` | `travel-adventure` | review |
| Museum visiting | `museum-visiting` | `travel-adventure` |  |
| People-watching | `people-watching` | `travel-adventure` | review |
| Renaissance faires | `renaissance-faires` | `travel-adventure` |  |
| Zoo visiting | `zoo-visiting` | `travel-adventure` |  |

## Rest and ritual (`rest-ritual`), 5

| Corner | Slug | Old Space | |
|---|---|---|---|
| Astrology | `astrology` | `health-wellness` |  |
| Minimalism | `minimalism` | `health-wellness` | review |
| Qigong | `qigong` | `health-wellness` |  |
| Tai chi | `tai-chi` | `health-wellness` |  |
| Tarot | `tarot` | `health-wellness` |  |
