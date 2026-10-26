# The 18 categories and the Corner mapping

Source of truth for Step 4 of `claude-code-brief-discover-v2.md`. Approved by the founder on Oct 22, 2026. Built from the Soosh activity library (v6) and the project doc "Soosh trust rules and categories".

**Rules for the names (do not change without asking):** two plain nouns joined by "and", sentence case, no word repeated across names. In the UI a category's own name is its heading; the word "category" is never shown to members.

## The 18

| Order | Name | Proposed slug | What's in it (shown under the name) |
|---|---|---|---|
| 1 | Yarn and fabric | `yarn-fabric` | Knitting, crochet, sewing, embroidery, weaving, mending, cosplay |
| 2 | Crafts and DIY | `crafts-diy` | Clay, candles, jewelry, paper, wood, leather, glass |
| 3 | Art and design | `art-design` | Drawing, painting, printmaking, lettering, mehndi |
| 4 | Tech and tinkering | `tech-tinkering` | Electronics, 3D printing, keyboards, models, LEGO, drones |
| 5 | Food and drink | `food-drink` | Cooking, baking, brewing, coffee, tea, tasting |
| 6 | Running and fitness | `running-fitness` | Running, walking clubs, gym, yoga, Pilates, cycling, swimming |
| 7 | Sports and martial arts | `sports-martial-arts` | Racket and team sports, climbing, skating, combat sports |
| 8 | Dance and stage | `dance-stage` | Dance styles, improv, stand-up, theatre, karaoke |
| 9 | Outdoors and adventure | `outdoors-adventure` | Hiking, camping, water, snow, stargazing, travel |
| 10 | Home and garden | `home-garden` | Gardens, houseplants, flowers, aquariums, home projects |
| 11 | Games and puzzles | `games-puzzles` | Board games, cards, chess, puzzles, video games, trivia |
| 12 | Music and sound | `music-sound` | Instruments, singing, producing, DJing, podcasts |
| 13 | Photo and film | `photo-film` | Photography, video, short films, channels |
| 14 | Reading and writing | `reading-writing` | Books, book clubs, stories, poems, handwritten pages |
| 15 | Skills and side projects | `skills-side-projects` | Languages, money, speaking, coding, AI tools, freelancing |
| 16 | Collecting and style | `collecting-style` | Records, cards, sneakers, fragrance, thrifting, beauty |
| 17 | Culture and community | `culture-community` | Museums, live music, city walks, food tours, hosting, volunteering |
| 18 | Rest and ritual | `rest-ritual` | Meditation, breathwork, sauna, cold water, screen-free time, tarot, astrology |

`home-garden` is already a slug today and keeps its meaning, so it is reused as is. The other 17 are new slugs; the 14 old slugs stay resolvable (see below).

## Every built-in Corner (149 rows in `hobbies.ts`)

"Source" says where the category came from: the activity library entry it matched, or a judgement call where the library had no match. Judgement calls are the ones to double-check.

| Old Space | Corner | Slug | New category | Source |
|---|---|---|---|---|
| Art & Creative (`art-creative`) | Calligraphy | `calligraphy` | Art and design (`art-design`) | library: Calligraphy and hand lettering |
| Art & Creative (`art-creative`) | Drawing | `drawing` | Art and design (`art-design`) | library: Drawing |
| Art & Creative (`art-creative`) | Illustration | `illustration` | Art and design (`art-design`) | judgement |
| Books & Writing (`books-writing`) | Nature journaling | `nature-journaling` | Art and design (`art-design`) | library: Nature sketching |
| Nature & Outdoors (`nature-outdoors`) | Nature journaling | `nature-journaling` | Art and design (`art-design`) | library: Nature sketching |
| Art & Creative (`art-creative`) | Painting | `painting` | Art and design (`art-design`) | library: Acrylic painting |
| Art & Creative (`art-creative`) | Sculpture | `sculpture` | Art and design (`art-design`) | judgement |
| Art & Creative (`art-creative`) | Watercolor | `watercolor` | Art and design (`art-design`) | library: Watercolor |
| Crafts & Making (`crafts-making`) | Zines | `zines` | Art and design (`art-design`) | judgement |
| Collecting & Fandom (`collecting-fandom`) | Anime | `anime` | Collecting and style (`collecting-style`) | judgement |
| Collecting & Fandom (`collecting-fandom`) | Antiques | `antiques` | Collecting and style (`collecting-style`) | judgement |
| Fashion & Beauty (`fashion-beauty`) | Fashion | `fashion` | Collecting and style (`collecting-style`) | judgement |
| Fashion & Beauty (`fashion-beauty`) | Fragrance | `fragrance` | Collecting and style (`collecting-style`) | judgement |
| Fashion & Beauty (`fashion-beauty`) | Makeup | `makeup` | Collecting and style (`collecting-style`) | judgement |
| Fashion & Beauty (`fashion-beauty`) | Nails | `nails` | Collecting and style (`collecting-style`) | library: Nail art |
| Fashion & Beauty (`fashion-beauty`) | Sneakers | `sneakers` | Collecting and style (`collecting-style`) | library: Sneaker collecting |
| Fashion & Beauty (`fashion-beauty`) | Thrifting | `thrifting` | Collecting and style (`collecting-style`) | judgement |
| Collecting & Fandom (`collecting-fandom`) | Toys | `toys` | Collecting and style (`collecting-style`) | judgement |
| Gaming & Tabletop (`gaming-tabletop`) | Trading cards | `trading-cards` | Collecting and style (`collecting-style`) | judgement |
| Collecting & Fandom (`collecting-fandom`) | Trading cards | `trading-cards` | Collecting and style (`collecting-style`) | judgement |
| Collecting & Fandom (`collecting-fandom`) | Vinyl | `vinyl` | Collecting and style (`collecting-style`) | library: Vinyl collecting |
| Crafts & Making (`crafts-making`) | Candle-making | `candle-making` | Crafts and DIY (`crafts-diy`) | library: Candle making |
| Art & Creative (`art-creative`) | Ceramics | `ceramics` | Crafts and DIY (`crafts-diy`) | library: Hand-building ceramics |
| Crafts & Making (`crafts-making`) | Jewelry-making | `jewelry-making` | Crafts and DIY (`crafts-diy`) | library: Jewelry making |
| Crafts & Making (`crafts-making`) | Paper crafts | `paper-crafts` | Crafts and DIY (`crafts-diy`) | judgement |
| Crafts & Making (`crafts-making`) | Pottery | `pottery` | Crafts and DIY (`crafts-diy`) | library: Pottery on the wheel |
| Crafts & Making (`crafts-making`) | Scrapbooking | `scrapbooking` | Crafts and DIY (`crafts-diy`) | library: Scrapbooking and collage books |
| Crafts & Making (`crafts-making`) | Soap-making | `soap-making` | Crafts and DIY (`crafts-diy`) | library: Soap making |
| Crafts & Making (`crafts-making`) | Upcycling | `upcycling` | Crafts and DIY (`crafts-diy`) | judgement |
| Crafts & Making (`crafts-making`) | Woodworking | `woodworking` | Crafts and DIY (`crafts-diy`) | library: Woodworking |
| Travel & Adventure (`travel-adventure`) | Exploration | `exploration` | Culture and community (`culture-community`) | library: City exploring |
| Food & Cooking (`food-cooking`) | Supper clubs | `supper-clubs` | Culture and community (`culture-community`) | judgement |
| Sports & Fitness (`sports-fitness`) | Dance | `dance` | Dance and stage (`dance-stage`) | judgement |
| Art & Creative (`art-creative`) | Theater | `theater` | Dance and stage (`dance-stage`) | library: Community theatre |
| Food & Cooking (`food-cooking`) | BBQ | `bbq` | Food and drink (`food-drink`) | judgement |
| Food & Cooking (`food-cooking`) | Baking | `baking` | Food and drink (`food-drink`) | library: Baking cakes, cookies and pastry |
| Food & Cooking (`food-cooking`) | Cocktail-making | `cocktail-making` | Food and drink (`food-drink`) | library: Cocktail making |
| Food & Cooking (`food-cooking`) | Coffee | `coffee` | Food and drink (`food-drink`) | library: Home coffee and espresso |
| Food & Cooking (`food-cooking`) | Cooking | `cooking` | Food and drink (`food-drink`) | library: Cooking new dishes |
| Food & Cooking (`food-cooking`) | Espresso | `espresso` | Food and drink (`food-drink`) | library: Home coffee and espresso |
| Food & Cooking (`food-cooking`) | Fermentation | `fermentation` | Food and drink (`food-drink`) | library: Fermentation (kimchi, pickles, hot sauce) |
| Food & Cooking (`food-cooking`) | Home brewing | `home-brewing` | Food and drink (`food-drink`) | library: Homebrewing beer |
| Food & Cooking (`food-cooking`) | Home coffee | `home-coffee` | Food and drink (`food-drink`) | library: Home coffee and espresso |
| Food & Cooking (`food-cooking`) | Kombucha | `kombucha` | Food and drink (`food-drink`) | library: Kombucha brewing |
| Food & Cooking (`food-cooking`) | Sourdough | `sourdough` | Food and drink (`food-drink`) | library: Sourdough |
| Food & Cooking (`food-cooking`) | Tea | `tea` | Food and drink (`food-drink`) | library: Tea tasting |
| Gaming & Tabletop (`gaming-tabletop`) | Board games | `board-games` | Games and puzzles (`games-puzzles`) | library: Board games |
| Gaming & Tabletop (`gaming-tabletop`) | Chess | `chess` | Games and puzzles (`games-puzzles`) | library: Chess |
| Gaming & Tabletop (`gaming-tabletop`) | D&D | `d-d` | Games and puzzles (`games-puzzles`) | library: Dungeons and Dragons |
| Gaming & Tabletop (`gaming-tabletop`) | Puzzles | `puzzles` | Games and puzzles (`games-puzzles`) | library: Jigsaw puzzles |
| Gaming & Tabletop (`gaming-tabletop`) | Tabletop RPGs | `tabletop-rpgs` | Games and puzzles (`games-puzzles`) | library: Dungeons and Dragons |
| Gaming & Tabletop (`gaming-tabletop`) | Video games | `video-games` | Games and puzzles (`games-puzzles`) | library: Video games with friends |
| Home & Garden (`home-garden`) | Composting | `composting` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | DIY | `diy` | Home and garden (`home-garden`) | library: DIY home projects |
| Home & Garden (`home-garden`) | Furniture flipping | `furniture-flipping` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | Gardening | `gardening` | Home and garden (`home-garden`) | library: Gardening |
| Home & Garden (`home-garden`) | Houseplants | `houseplants` | Home and garden (`home-garden`) | library: Houseplants |
| Home & Garden (`home-garden`) | Indoor growing | `indoor-growing` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | Interior design | `interior-design` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | Native plants | `native-plants` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | Restoration | `restoration` | Home and garden (`home-garden`) | judgement |
| Home & Garden (`home-garden`) | Vegetable gardens | `vegetable-gardens` | Home and garden (`home-garden`) | library: Vegetable gardening |
| Music (`music`) | DJing | `djing` | Music and sound (`music-sound`) | library: DJing |
| Music (`music`) | Guitar | `guitar` | Music and sound (`music-sound`) | library: Guitar |
| Music (`music`) | Music production | `music-production` | Music and sound (`music-sound`) | library: Music production |
| Music (`music`) | Singing | `singing` | Music and sound (`music-sound`) | library: Singing |
| Music (`music`) | Songwriting | `songwriting` | Music and sound (`music-sound`) | library: Songwriting |
| Travel & Adventure (`travel-adventure`) | Backpacking | `backpacking` | Outdoors and adventure (`outdoors-adventure`) | library: Backpacking |
| Nature & Outdoors (`nature-outdoors`) | Birdwatching | `birdwatching` | Outdoors and adventure (`outdoors-adventure`) | library: Birdwatching |
| Nature & Outdoors (`nature-outdoors`) | Camping | `camping` | Outdoors and adventure (`outdoors-adventure`) | library: Camping |
| Nature & Outdoors (`nature-outdoors`) | Fishing | `fishing` | Outdoors and adventure (`outdoors-adventure`) | library: Fishing |
| Nature & Outdoors (`nature-outdoors`) | Foraging | `foraging` | Outdoors and adventure (`outdoors-adventure`) | library: Foraging |
| Nature & Outdoors (`nature-outdoors`) | Hiking | `hiking` | Outdoors and adventure (`outdoors-adventure`) | library: Hiking |
| Travel & Adventure (`travel-adventure`) | Road trips | `road-trips` | Outdoors and adventure (`outdoors-adventure`) | library: Trip planning |
| Travel & Adventure (`travel-adventure`) | Skiing | `skiing` | Outdoors and adventure (`outdoors-adventure`) | library: Skiing |
| Travel & Adventure (`travel-adventure`) | Travel | `travel` | Outdoors and adventure (`outdoors-adventure`) | library: Trip planning |
| Photography & Film (`photography-film`) | Film photography | `film-photography` | Photo and film (`photo-film`) | library: Film photography |
| Photography & Film (`photography-film`) | Filmmaking | `filmmaking` | Photo and film (`photo-film`) | library: Short film-making |
| Nature & Outdoors (`nature-outdoors`) | Outdoor photography | `outdoor-photography` | Photo and film (`photo-film`) | library: Photo walks |
| Photography & Film (`photography-film`) | Outdoor photography | `outdoor-photography` | Photo and film (`photo-film`) | library: Photo walks |
| Photography & Film (`photography-film`) | Photography | `photography` | Photo and film (`photo-film`) | library: Photography |
| Photography & Film (`photography-film`) | Video | `video` | Photo and film (`photo-film`) | library: Videography |
| Books & Writing (`books-writing`) | Book clubs | `book-clubs` | Reading and writing (`reading-writing`) | library: Book clubs |
| Books & Writing (`books-writing`) | Books | `books` | Reading and writing (`reading-writing`) | library: Reading |
| Books & Writing (`books-writing`) | Creative writing | `creative-writing` | Reading and writing (`reading-writing`) | library: Creative writing |
| Books & Writing (`books-writing`) | Poetry | `poetry` | Reading and writing (`reading-writing`) | library: Poetry |
| Books & Writing (`books-writing`) | Reading | `reading` | Reading and writing (`reading-writing`) | library: Reading |
| Books & Writing (`books-writing`) | Writing | `writing` | Reading and writing (`reading-writing`) | library: Creative writing |
| Health & Wellness (`health-wellness`) | Breathwork | `breathwork` | Rest and ritual (`rest-ritual`) | library: Breathwork |
| Health & Wellness (`health-wellness`) | Meditation | `meditation` | Rest and ritual (`rest-ritual`) | library: Meditation |
| Health & Wellness (`health-wellness`) | Mindfulness | `mindfulness` | Rest and ritual (`rest-ritual`) | judgement |
| Sports & Fitness (`sports-fitness`) | Cycling | `cycling` | Running and fitness (`running-fitness`) | library: Cycling |
| Health & Wellness (`health-wellness`) | Pilates | `pilates` | Running and fitness (`running-fitness`) | library: Pilates |
| Sports & Fitness (`sports-fitness`) | Run clubs | `run-clubs` | Running and fitness (`running-fitness`) | judgement |
| Sports & Fitness (`sports-fitness`) | Running | `running` | Running and fitness (`running-fitness`) | library: Running |
| Sports & Fitness (`sports-fitness`) | Strength training | `strength-training` | Running and fitness (`running-fitness`) | library: Strength training |
| Sports & Fitness (`sports-fitness`) | Swimming | `swimming` | Running and fitness (`running-fitness`) | library: Swimming |
| Health & Wellness (`health-wellness`) | Yoga | `yoga` | Running and fitness (`running-fitness`) | library: Yoga |
| Food & Cooking (`food-cooking`) | Pasta | `pasta` | Food and drink (`food-drink`) | judgement (added with Corners home) |
| Sports & Fitness (`sports-fitness`) | Boxing | `boxing` | Sports and martial arts (`sports-martial-arts`) | judgement (added with Corners home) |
| Sports & Fitness (`sports-fitness`) | Skateboarding | `skateboarding` | Sports and martial arts (`sports-martial-arts`) | judgement (added with Corners home) |
| Nature & Outdoors (`nature-outdoors`) | Kayaking | `kayaking` | Outdoors and adventure (`outdoors-adventure`) | judgement (added with Corners home) |
| Nature & Outdoors (`nature-outdoors`) | Surfing | `surfing` | Outdoors and adventure (`outdoors-adventure`) | judgement (added with Corners home) |
| Nature & Outdoors (`nature-outdoors`) | Wild swimming | `wild-swimming` | Outdoors and adventure (`outdoors-adventure`) | judgement (added with Corners home) |
| Gaming & Tabletop (`gaming-tabletop`) | Trivia | `trivia` | Games and puzzles (`games-puzzles`) | judgement (added with Corners home) |
| Music (`music`) | Make a beat | `make-a-beat` | Music and sound (`music-sound`) | judgement (added with Corners home) |
| Music (`music`) | Karaoke | `karaoke` | Dance and stage (`dance-stage`) | judgement (added with Corners home) |
| Music (`music`) | Live music | `live-music` | Culture and community (`culture-community`) | judgement (added with Corners home) |
| Music (`music`) | Choir | `choir` | Music and sound (`music-sound`) | judgement (added with Corners home) |
| Health & Wellness (`health-wellness`) | Sauna & cold plunge | `sauna-cold-plunge` | Rest and ritual (`rest-ritual`) | judgement (added with Corners home) |
| Art & Creative (`art-creative`) | Improv | `improv` | Dance and stage (`dance-stage`) | judgement (added with Corners home) |
| Travel & Adventure (`travel-adventure`) | Volunteering | `volunteering` | Culture and community (`culture-community`) | judgement (added with Corners home) |
| Tech & Building (`tech-building`) | AI projects | `ai-projects` | Skills and side projects (`skills-side-projects`) | library: Learning AI tools |
| Tech & Building (`tech-building`) | Coding | `coding` | Skills and side projects (`skills-side-projects`) | library: Side projects and coding |
| Tech & Building (`tech-building`) | Creative coding | `creative-coding` | Skills and side projects (`skills-side-projects`) | judgement |
| Tech & Building (`tech-building`) | Cybersecurity learning | `cybersecurity-learning` | Skills and side projects (`skills-side-projects`) | judgement |
| Tech & Building (`tech-building`) | Data visualization | `data-visualization` | Skills and side projects (`skills-side-projects`) | judgement |
| Tech & Building (`tech-building`) | Game development | `game-development` | Skills and side projects (`skills-side-projects`) | judgement |
| Books & Writing (`books-writing`) | Language learning | `language-learning` | Skills and side projects (`skills-side-projects`) | library: Language learning |
| Tech & Building (`tech-building`) | No-code building | `no-code-building` | Skills and side projects (`skills-side-projects`) | judgement |
| Tech & Building (`tech-building`) | Web design | `web-design` | Skills and side projects (`skills-side-projects`) | judgement |
| Sports & Fitness (`sports-fitness`) | Basketball | `basketball` | Sports and martial arts (`sports-martial-arts`) | judgement |
| Sports & Fitness (`sports-fitness`) | Climbing | `climbing` | Sports and martial arts (`sports-martial-arts`) | library: Bouldering |
| Sports & Fitness (`sports-fitness`) | Martial arts | `martial-arts` | Sports and martial arts (`sports-martial-arts`) | library: Martial arts |
| Sports & Fitness (`sports-fitness`) | Padel | `padel` | Sports and martial arts (`sports-martial-arts`) | library: Padel |
| Sports & Fitness (`sports-fitness`) | Pickleball | `pickleball` | Sports and martial arts (`sports-martial-arts`) | library: Pickleball |
| Sports & Fitness (`sports-fitness`) | Soccer | `soccer` | Sports and martial arts (`sports-martial-arts`) | library: Rec leagues (kickball, soccer, ultimate) |
| Sports & Fitness (`sports-fitness`) | Tennis | `tennis` | Sports and martial arts (`sports-martial-arts`) | library: Tennis |
| Sports & Fitness (`sports-fitness`) | Volleyball | `volleyball` | Sports and martial arts (`sports-martial-arts`) | library: Volleyball |
| Tech & Building (`tech-building`) | 3D printing | `3d-printing` | Tech and tinkering (`tech-tinkering`) | library: 3D printing |
| Tech & Building (`tech-building`) | AR/VR projects | `ar-vr-projects` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | Arduino | `arduino` | Tech and tinkering (`tech-tinkering`) | library: Electronics and Arduino |
| Collecting & Fandom (`collecting-fandom`) | Brick building | `lego` | Tech and tinkering (`tech-tinkering`) | library: LEGO building |
| Tech & Building (`tech-building`) | CAD | `cad` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | CNC | `cnc` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | Drones | `drones` | Tech and tinkering (`tech-tinkering`) | library: Drone flying |
| Tech & Building (`tech-building`) | Electronics | `electronics` | Tech and tinkering (`tech-tinkering`) | library: Electronics and Arduino |
| Tech & Building (`tech-building`) | Laser cutting | `laser-cutting` | Tech and tinkering (`tech-tinkering`) | judgement |
| Crafts & Making (`crafts-making`) | Makerspaces | `makerspaces` | Tech and tinkering (`tech-tinkering`) | judgement |
| Crafts & Making (`crafts-making`) | Miniatures | `miniatures` | Tech and tinkering (`tech-tinkering`) | library: Miniatures |
| Crafts & Making (`crafts-making`) | Model-making | `model-making` | Tech and tinkering (`tech-tinkering`) | library: Model kits and Gunpla |
| Tech & Building (`tech-building`) | Product prototyping | `product-prototyping` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | Raspberry Pi | `raspberry-pi` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | Robotics | `robotics` | Tech and tinkering (`tech-tinkering`) | judgement |
| Tech & Building (`tech-building`) | Smart-home projects | `smart-home-projects` | Tech and tinkering (`tech-tinkering`) | judgement |
| Crafts & Making (`crafts-making`) | Crochet | `crochet` | Yarn and fabric (`yarn-fabric`) | library: Crochet |
| Crafts & Making (`crafts-making`) | Embroidery | `embroidery` | Yarn and fabric (`yarn-fabric`) | library: Embroidery |
| Crafts & Making (`crafts-making`) | Knitting | `knitting` | Yarn and fabric (`yarn-fabric`) | library: Knitting |
| Crafts & Making (`crafts-making`) | Sewing | `sewing` | Yarn and fabric (`yarn-fabric`) | library: Sewing |

## The 6 Corners that are database rows

| Old Space | Corner slug | New category |
|---|---|---|
| `books-writing` | `reading` | Reading and writing |
| `food-cooking` | `cooking` | Food and drink |
| `food-cooking` | `storytelling` | Reading and writing (judgement: it was filed under food, but it is a writing Corner) |
| `photography-film` | `photography` | Photo and film |
| `tech-building` | `web-design` | Skills and side projects |
| `travel-adventure` | `travel` | Outdoors and adventure |

Re-check this list with a read-only query before writing SQL; members can create Corners at any time.

## Things the migration has to handle

1. **Same Corner in two old Spaces.** Trading cards (Gaming and Collecting), Nature journaling (Books and Nature) and Outdoor photography (Nature and Photography) each land in one new category twice. Merge each pair into one Corner and move their Moments onto it; check `20261019000000_merge_corners.sql` for the existing merge pattern.
2. **Old Space slugs keep working.** `posts.hobby_slug` and old links point at the 15 old slugs. A Moment's new category comes from its Corner, not its old Space, because one old Space splits across several categories (Tech and building goes to Tech and tinkering and to Skills and side projects).
3. **Categories with few Corners.** Culture and community (2), Dance and stage (2) and Rest and ritual (3) are thin. Do not hide them, but never show an empty one; the library has more Corners to add later.
4. **Fix forward.** A new migration, a rollback file and a verification script, per CLAUDE.md. Post this mapping in the PR before writing SQL.
