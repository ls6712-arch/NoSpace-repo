# Corner rooms

A Corner can have a room: a 3D place that is what the Corner looks like. It is the Corner, not a separate thing with its own name (the Pottery room is "the Pottery Corner", never "the studio"). It draws what the list already shows (the Still making and Made it walls, Passed along, the Corner chat) and adds nothing of its own to the database. Pottery is the only Corner with one.

**One Corner, two ways to see it.** At `/corners/:slug`, a Corner with a room opens as the room for an approved member. The list (the page every other Corner has) is one tap away through **List**, and **Room** on the list goes back; the choice is remembered. Visitors, and devices that cannot draw the room, get the list. `CornerFace` in `src/app/pages/CornerDetail.tsx` decides, using `opensAsRoom` in `src/app/world/cornerWorlds.ts`.

Code: `src/app/world/` and `src/app/pages/CornerWorld.tsx` (the `CornerRoom` component). The folder and file names still say "world", and the engine calls the furniture of the Pottery room the "studio" setting; those are the code's words only.

## The rules a world keeps

- **Every piece is a real Moment.** A piece's shape and colour come from the Moment's id, so the same Moment always looks the same. No example people, Moments or messages, ever. An empty wall is an empty rack.
- **Characters are not people.** A room's characters come from its config, are tagged "Character" whenever they speak, and never enter the lists that hold Moments. They cannot be counted, shown on a wall, or appear in chat.
- **No counts of people.** A sign counts pieces.
- **The room draws only what the viewer may see.** The walls come from `corner_wall` and `corner_passed_along`, which already apply audience, blocks and reports. A thread is drawn only between two pieces that are both in the room.
- **Everything in the room is also in the panel**, reachable with a keyboard and a screen reader. The canvas is decoration over the same data.
- **Never a blank screen.** No WebGL, a lost graphics context, a failed download, or a first frame slower than 4 seconds all show the list with a short note, and the room is not tried again by itself until the tab is closed.

## In progress or finished

Nothing about this is stored on a Moment. A Moment is on a Corner's finished wall when its Pursuit is finished (`pursuits.finished_at`), and on the in-progress wall otherwise; `corner_wall` decides, as it does for every Corner.

- **Labels.** A Corner with a room may name its two walls itself (`src/app/lib/cornerWallLabels.ts`, listed in `docs/glossary.md`). A Corner without a room says Still making and Made it.
- **Log a Moment asks** on a Corner with a room, for a Moment other people will see: a two-way choice under the Corner row with that Corner's labels. The finished answer finishes the Pursuit the Moment counts toward. With no Pursuit it makes one that is finished in its first write (`startFinishedProject`, `mirrorFinishedPursuitWithMoment`), so it is never an open Pursuit anywhere and earns no Finisher Stub. It is shared only when the Moment is for everyone, and it is marked `pursuits.from_moment`, so `corner_wall` shows the Moment as finished to everyone who can see the Moment even when the Pursuit is not shared (a Pursuit someone made themselves and kept private is not affected).
- **Check:** `node scripts/e2e/corner-wall-question.ts`.

## How it is put together

**One engine, one config per Corner.** The engine draws any room. A Corner supplies a config: which setting (the furniture), which kind of piece a Moment becomes, its characters and its words. Pottery is the first config. Nothing in the engine names a Corner, a character or a line of copy; `world.test.ts` checks that.

| Where | What it is |
|---|---|
| `corners/` | One config per Corner (`pottery.ts`) and the list of them (`index.ts`). Plain data |
| `config.ts` | What a config may contain, and `checkConfig`, the rules every config keeps. Plain data |
| `cornerWorlds.ts` | Which Corner has a room, the words every room shares, and the remembered settings. Small, so the Corner page can import it |
| `layout.ts` | No 3D: which Moment goes where (`planRoom`), what its piece looks like (`pieceSpec`), which pairs get a thread |
| `core/` | The engine: `scene.ts` (renderer, camera and drag, picking, pieces popping in, threads, the frame loop), `room.ts` (floor, walls, window, sun, dust, rain), `themes.ts` (each setting's colours, window, shelves and lamps), `poses.ts` (where the camera starts in each setting), `moods.ts` (Morning, Golden hour, Night rain), `kit.ts` (materials, boxes, textures) |
| `settings/` | The furniture of a room: `studio.ts` (pottery), `garden.ts` (a greenhouse open onto a garden), `nook.ts` (a reading room), `cafe.ts` (a game café), and `shared.ts` (the back wall and furniture the last three share). A setting says where pieces sit and where signs float, and hands the objects a character works on to the actions (`props`). It has no characters and no words |
| `pieces/` | `makePiece(kind, spec, finished)`: what a Moment looks like. Four kinds: `pot` (bare clay, then glazed), `plant` (a seedling, then in flower), `book` (lying open, then standing), `game` (an open box, then boxed) |
| `characters/` | `rig.ts` (a figure, seated, standing or kneeling, and a cat), `actions.ts` (one function per action: `wheel`, `press`, `glaze`, `water`, `dig`, `read`, `write`, `dice`, `move`, `think`), `index.ts` (builds a room's characters from its config) |
| `sound/` | All sound, made in the browser. No audio files. A config picks its background beds: `wheel`, `birds`, `wind`, `fire`, `clock`, `cafe`. Nothing plays until the person taps Enter, and nothing at all with Sound off |

`core/scene.ts` and everything it imports (three.js, every setting, piece and action) are one separately downloaded file shared by all rooms. Nothing outside the room page may import them, and a config may import nothing but its type. `world.test.ts` checks both.

## Giving another Corner a room

1. **Write its config** in `src/app/world/corners/<slug>.ts`, copying the shape of `pottery.ts`: `key`, `slug`, `name`, `setting`, `pieceKind`, `copy` (entry line, the canvas description, both walls' label and sign word, the two Your shelf notes, the hint), `characters` (each with a look, a pose, an action, where they are and what they say), an optional `pet`, the `greeting`, and `sounds.bed`.
2. **List it** in `corners/index.ts`. The Corner then opens as its room for members. Nothing else needs wiring.
3. **Words.** Its wall labels must be the ones decided in `src/app/lib/cornerWallLabels.ts`. Every other new string, characters' lines included, goes in `docs/glossary.md` for approval.
4. **Run `npm test`.** `cornerWorldConfigs.test.ts` runs `checkConfig` on every config: required fields, a known setting, piece kind and actions, an action only in a setting that has its prop, stations that point at real characters, a greeting said by a character, both walls named, no em or en dashes, and none of the prototype's example people, Walls, threads, chat or activities.
5. **Posters and loops** come with the loading work (a later PR).

Never put a Corner's words or data in the engine, and never add `wall`, `edges`, `chat` or `activities` to a config: those were the prototype's example people. Walls, Passed along and chat always come from the database.

## Extending the engine

Only when a Corner truly needs something the engine lacks. Each of these is one new file or function plus one name in `config.ts`, and the test that compares the two lists fails until both are there.

- **A setting:** a file in `settings/` exporting a `SettingBuilder`, added to `SETTINGS` in `settings/index.ts` and to `SETTING_NAMES`, with its look in `core/themes.ts` and its camera start in `core/poses.ts`. Build on `buildBackWall` in `settings/shared.ts` so the shelves, the rack and the signs stay where every other room has them.
- **An action:** a function in `characters/actions.ts`, added to `ACTIONS` and to `ACTION_NAMES`. If it needs an object only one setting has, add that object to `SettingProps` and the pairing to `ACTION_NEEDS_SETTING`.
- **A piece kind:** a maker in `pieces/`, added to `MAKERS` in `pieces/index.ts` and to `PIECE_KINDS`.
- **A sound bed:** in `sound/index.ts`, added to `SOUND_BEDS`.

After any engine change, look at every room again. `node scripts/e2e/corner-room-moods.ts` takes a Corner's room in each light, in the app. `node scripts/e2e/room-preview.ts` draws any setting with the engine alone, so a setting can be looked at before a Corner uses it.

**Light.** The rooms were tuned before three.js moved to physical light units. Every light's intensity therefore carries a factor of PI (the sun and sky in `core/room.ts`, lamps and fires in the settings). Keep that when adding a light. A theme's `bright` scales the sun and sky for that setting.

**The start pose.** `core/poses.ts` holds where the camera starts in each setting. Posters and loops are framed from it, so change a pose only together with that setting's posters and loops.

## Checking it

- `npm test` runs `src/app/world/world.test.ts` (placement, threads, determinism, no prototype examples, characters and Corner words kept out of the engine, three.js kept out of the main bundle) and `cornerWorldConfigs.test.ts` (every config against the rules above, and that a made-up fifth Corner needs only a config).
- `node scripts/e2e/room-preview.ts` screenshots the settings on their own (see above).
- `node scripts/e2e/corner-world.ts` opens the production build in a real browser with fixture data: the Corner opening as its room, the scene arriving as its own file, signs, the panel, the chat tab, List and Room, and the no-WebGL fallback. It saves screenshots.
