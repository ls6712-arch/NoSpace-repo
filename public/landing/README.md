# Landing page screens

The signed-out landing page shows real screens from the live app. Drop a file
in this folder and rebuild: no code change. Any section whose file is missing
is hidden, so nothing on the page is ever a stand-in.

Export each as WebP, **1170 x 2532 px** (an iPhone screen at 2x), phone screen
only, with no device frame. The page adds the frame. Use real accounts and real
posts. Keep each file under 300 KB.

| File | Screen to capture | Section it controls | If missing |
|---|---|---|---|
| `hero-shelf.webp` | The founder's Shelf, with one item marked "In progress" and one marked "Finished" visible | Hero phone | The hero still shows its text, gradient and button, without the phone |
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

The example screens use AI-generated images, by the owner's decision for these
example screens only (the earlier "no AI images" rule does not apply here).
The ten images arrived as one collage and were cropped to the file names
listed in `landing-preview/README.md`. They are not committed; only the
screens are. Source files are about 400 to 630 px wide, so photos look soft at
full size. Replace them with real photos when available.

| Photo | Credit |
|---|---|
| `maya-sourdough` | AI-generated with Figma |
| `maya-running` | AI-generated with Figma |
| `maya-film` | AI-generated with Figma. **Replace:** the camera and film canister carry garbled lettering |
| `maya-bouldering` | AI-generated with Figma |
| `nick-bouldering` | AI-generated with Figma |
| `nick-cutting-board` | AI-generated with Figma |
| `nick-guitar` | AI-generated with Figma |
| `theo-wheel` | AI-generated with Figma |
| `theo-ramen` | AI-generated with Figma |
| `theo-sketchbook` | AI-generated with Figma |

Screens that differ in size from 1170 x 2532 will be scaled to fit the frame.
