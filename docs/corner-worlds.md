# Corner rooms

A Corner can have a room: a 3D place that is what the Corner looks like. It is the Corner, not a separate thing with its own name (the Pottery room is "the Pottery Corner", never "the studio"). It draws what the list already shows (the Still making and Made it walls, Passed along, the Corner chat) and adds nothing of its own to the database. Pottery is the only Corner with one.

**One Corner, two ways to see it.** At `/corners/:slug`, a Corner with a room opens as the room for an approved member. The list (the page every other Corner has) is one tap away through **List**, and **Room** on the list goes back; the choice is remembered. Visitors, and devices that cannot draw the room, get the list. `CornerFace` in `src/app/pages/CornerDetail.tsx` decides, using `opensAsRoom` in `src/app/world/cornerWorlds.ts`.

Code: `src/app/world/` and `src/app/pages/CornerWorld.tsx` (the `CornerRoom` component). The folder and file names still say "world"; that is the code's word only.

## The rules a world keeps

- **Every piece is a real Moment.** A piece's shape and colour come from the Moment's id, so the same Moment always looks the same. No example people, Moments or messages, ever. An empty wall is an empty rack.
- **Characters are not people.** The potters and the cat are built by the setting, tagged "Character" whenever they speak, and never enter the lists that hold Moments. They cannot be counted, shown on a wall, or appear in chat.
- **No counts of people.** A sign counts pieces.
- **The room draws only what the viewer may see.** The walls come from `corner_wall` and `corner_passed_along`, which already apply audience, blocks and reports. A thread is drawn only between two pieces that are both in the room.
- **Everything in the room is also in the panel**, reachable with a keyboard and a screen reader. The canvas is decoration over the same data.
- **Never a blank screen.** No WebGL, a lost graphics context, a failed download, or a first frame slower than 4 seconds all show the list with a short note, and the room is not tried again by itself until the tab is closed.

## How it is put together

| File | What it is | Reusable? |
|---|---|---|
| `layout.ts` | Plain data, no 3D: which Moment goes where (`planRoom`), what its piece looks like (`pieceSpec`), which pairs get a thread | Yes, as is |
| `cornerWorlds.ts` | Which Corners have a world, the words, and the remembered settings. Small, so the Corner page can import it | Add a row |
| `kit.ts` | Materials, boxes, textures, a glow | Yes |
| `room.ts` | The room: floor, walls, window, the view, sun, dust, rain | Yes, for any indoor setting |
| `moods.ts` | Morning, Golden hour, Night rain | Yes |
| `sound.ts` | All sound, made in the browser. No audio files | Mostly (the wheel hum is the studio's) |
| `characters.ts` | A figure and a cat, as rigs to animate | Yes |
| `pots.ts` | Pottery pieces | Pottery only |
| `studio.ts` | The pottery studio: shelves, rack, wheel, bench, kiln, three potters, the cat, and what they say | Pottery only |
| `scene.ts` | Ties it together: camera, frame loop, pieces, threads. Loaded only when a world opens | Yes, once it picks its setting from the registry |

`scene.ts` and everything it imports (three.js) are one separately downloaded file. Nothing outside the world page may import them. `world.test.ts` checks that.

## Giving another Corner a world

1. **Write its setting**, a file like `studio.ts`, that returns a `Setting`: where pieces sit (`slots`), how tall they may be (`headroom`), where the three signs float (`signs`), the characters and their lines, and an `update` that animates it. It builds on the shared `room.ts`, or on a new shell for an outdoor setting (court, garden).
2. **Write its pieces** if they are not pots: a function from a `PieceSpec` and "finished or not" to a mesh, like `pieceMesh` in `pots.ts`. `pieceSpec` already gives a seeded shape index, colour, size and turn.
3. **Let `scene.ts` choose.** Today it calls `buildStudio` and `pieceMesh` directly because there is one world. With a second, `CornerWorldDef` gains a `setting` name and `createWorld` takes the setting and piece builders as arguments.
4. **Add the Corner to `WORLDS`** in `cornerWorlds.ts` with its entry screen line. It then opens as its room; nothing else needs wiring.
5. **Words.** Every new string goes in `docs/glossary.md` for approval first, characters' lines included.

Settings imagined so far: studio (Pottery), court, kitchen, garden, nook, outdoors. Only the studio exists.

## Checking it

- `npm test` runs `src/app/world/world.test.ts`: placement, threads, determinism, no prototype examples, characters kept apart, three.js kept out of the main bundle.
- `node scripts/e2e/corner-world.ts` opens the production build in a real browser with fixture data: the Corner opening as its room, the scene arriving as its own file, signs, the panel, the chat tab, List and Room, and the no-WebGL fallback. It saves screenshots.
