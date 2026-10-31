# Landing page screens

The signed-out landing page shows real screens from the live app. **Only the hero (the current Discover) is committed.** The six other screens were removed because they showed the retired UI; their sections stay hidden until they are regenerated from the current app, which needs the example photos listed in `landing-preview/README.md` (maya-sourdough, maya-film, maya-bouldering, nick-bouldering and theo-wheel; maya-running is also on Maya's Shelf). Drop a file
in this folder and rebuild: no code change. Any section whose file is missing
is hidden, so nothing on the page is ever a stand-in.

Export each as WebP, **1170 x 2532 px** (an iPhone screen at 2x), phone screen
only, with no device frame. The page adds the frame. Use real accounts and real
posts. Keep each file under 300 KB.

| File | Screen to capture | Section it controls | If missing |
|---|---|---|---|
| `hero-discover@1x.webp`, `hero-discover@2x.webp` | The current Discover in light mode at 390px wide, 390 x 844 and 780 x 1688 (taken from the app build, not the generator below) | Hero phone | The hero still shows its text and button, without the phone |
| `step-save.webp` | A post with the Save button | Save it. Try it. Share it. (screen 1) | The whole section is hidden |
| `step-try.webp` | A Shelf item marked "In progress" | Save it. Try it. Share it. (screen 2) | The whole section is hidden |
| `step-share.webp` | The same item marked "Finished" | Save it. Try it. Share it. (screen 3) | The whole section is hidden |
| `come-along.webp` | A friend's post with "Count me in" visible | Your friends can come along. | Section hidden |
| `privacy-picker.webp` | The visibility picker on the post form | You choose who sees each post. | Section hidden |
| `reward-notification.webp` | The bell open, showing the save notification | The Reward section | Section hidden |

The save-it-try-it-share-it section needs all three of its files. It never shows
with one or two.

The screens are generated, not hand-captured: `npm run landing:screens` renders
the app's real components with example people (Maya, Nick, Theo) and example
posts from `src/landing-preview/fixtures.ts`, with no database. The hero and
the three steps carry an "Example Shelf" caption, so they are never presented
as real members. The "See who's on Soosh" section stays real-only.

## Photo credits

The example screens mix real photos with AI-generated ones, by the owner's
decision for these example screens only (the earlier "no AI images" rule does
not apply to the AI-generated ones). Photos are not committed; only the screens
are.

Real photos (Unsplash license), supplied by the owner:

| Photo | Screen | Source | Photographer |
|---|---|---|---|
| `nick-bouldering` | `step-save` | Unsplash | Name to be added by the owner (not recorded when supplied) |
| `theo-wheel` | `come-along` | Unsplash | Name to be added by the owner (not recorded when supplied) |

AI-generated with gpt-image-2.5-sunburst via ElevenLabs (portrait 3:4, 1536 x 2048):

| Photo | Credit |
|---|---|
| `maya-sourdough` | AI-generated with gpt-image-2.5-sunburst via ElevenLabs |
| `maya-running` | AI-generated with gpt-image-2.5-sunburst via ElevenLabs |
| `maya-film` | AI-generated with gpt-image-2.5-sunburst via ElevenLabs (printed 35mm photos) |
| `maya-bouldering` | AI-generated with gpt-image-2.5-sunburst via ElevenLabs |

Unused: these example photos do not appear on any landing screen (checked by
swapping each for a solid color and capturing all seven screens). They are not
needed and are not being replaced:

| Photo | Note |
|---|---|
| `nick-cutting-board` | Unused. Not on any screen |
| `nick-guitar` | Unused |
| `theo-ramen` | Unused |
| `theo-sketchbook` | Unused |

Screens that differ in size from 1170 x 2532 will be scaled to fit the frame.
