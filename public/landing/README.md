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
| `reward-notification.webp` | Reserved. Not used yet | none | none |

The save-it-try-it-share-it section needs all three of its files. It never shows
with one or two.

`reward-notification.webp` is reserved for a section that is not built: the app
does not send a notification when someone saves a post, so there is no real
notification to show. The file is ignored until the app sends one.

Screens that differ in size from 1170 x 2532 will be scaled to fit the frame.
