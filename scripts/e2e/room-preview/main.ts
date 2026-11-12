// A test harness, never shipped: draws one setting with the engine alone, so a setting can be looked at before
// any Corner uses it. Built and opened by scripts/e2e/room-preview.ts. No app, no database, no network.
//
// The configs below are fixtures for this harness only. Their characters stand where each setting expects
// someone and say one neutral line; the Moments are numbers, not people. Nothing here comes from the reference
// prototype's example Walls, threads or chat.
import { checkConfig, type CharacterConfig, type CornerWorldConfig, type PieceKind, type SettingName } from "../../../src/app/world/config";
import { createWorld } from "../../../src/app/world/core/scene";
import type { MoodName } from "../../../src/app/world/core/moods";
import { planRoom } from "../../../src/app/world/layout";
import { pottery } from "../../../src/app/world/corners/pottery";
import { CORNER_WORLDS } from "../../../src/app/world/corners";
import { firstPose } from "../../../src/app/world/core/poses";

const who = (name: string, pose: CharacterConfig["pose"], action: CharacterConfig["action"], at: [number, number], rot: number, look: CharacterConfig["look"], extra: Partial<CharacterConfig> = {}): CharacterConfig => ({
  name, pose, action, at, rot, look, lines: ["Hello."], ...extra,
});

const fixture = (setting: SettingName, pieceKind: PieceKind, characters: CharacterConfig[], pet: CornerWorldConfig["pet"], bed: CornerWorldConfig["sounds"]["bed"]): CornerWorldConfig => ({
  key: `fixture/${setting}`,
  slug: setting,
  name: "Fixture",
  setting,
  pieceKind,
  copy: {
    intro: "A fixture room.",
    stageLabel: "A fixture room.",
    walls: { still: { label: "In progress", sub: "in progress" }, made: { label: "Finished", sub: "finished" } },
    yoursEmpty: "Nothing yet.",
    yoursNote: "Yours.",
    hint: "A hint.",
  },
  characters,
  pet,
  greeting: [characters[0].name, "Hello."],
  sounds: { bed },
});

const HALF = Math.PI / 2;
const ROOMS: Record<string, CornerWorldConfig> = {
  studio: pottery,
  garden: fixture(
    "garden",
    "plant",
    [
      who("Rosa", "standing", "water", [2.75, -1.55], -HALF, { skin: 0xb07a55, shirt: 0xe0b24a, pants: 0x3f5a4c, apron: 0x7a8a5a, hair: 0x2a1d18, bun: true }),
      who("Kofi", "standing", "press", [-1.6, -0.3], 0, { skin: 0x5a3a28, shirt: 0x3f6b8a, pants: 0x4a3b30, apron: 0xa58a6a, hair: 0x141010 }),
      who("Noor", "kneel", "dig", [0.15, 0.75], HALF, { skin: 0xd9a882, shirt: 0xc0453a, pants: 0x4a5a6a, hair: 0x3a2418 }),
      who("Ade", "kneel", "dig", [-5.55, 1.9], -HALF, { skin: 0x6b4430, shirt: 0xe0b24a, pants: 0x3f5a4c, hair: 0x141010 }),
    ],
    { name: "Pip", at: [-0.7, 2.1], rot: -0.4, color: 0x3a3a3a, dark: 0x1f1f1f, line: "Asleep." },
    ["birds", "wind"],
  ),
  nook: fixture(
    "nook",
    "book",
    [
      who("Hana", "seated", "read", [1.35, 0.85], 0.55, { skin: 0xe3b896, shirt: 0xb5643f, pants: 0x2f3a4a, hair: 0x1c1310, bun: true, glasses: true }, { bookColor: 0x7a3b3b }),
      who("Ellie", "seated", "read", [-3.95, -0.5], HALF, { skin: 0xf0c9a8, shirt: 0xc9a24a, pants: 0x4a3b30, hair: 0xa0522d }, { bookColor: 0x2f4f6e }),
      who("Omar", "seated", "write", [-1.6, -0.15], 0, { skin: 0xa8774f, shirt: 0x7a3b3b, pants: 0x3a3a44, hair: 0x141010, glasses: true }),
    ],
    { name: "Moth", at: [0.15, 1.05], rot: 0.4, color: 0x8a8a8a, dark: 0x5a5a5a, line: "Asleep." },
    ["fire", "clock"],
  ),
  cafe: fixture(
    "cafe",
    "game",
    [
      who("Theo", "seated", "dice", [0.95, -0.32], 0, { skin: 0xc08a63, shirt: 0x2f6e8f, pants: 0x3a3a44, hair: 0x2a1d18 }),
      who("Mira", "seated", "move", [0.02, 0.55], HALF, { skin: 0x8d5a3b, shirt: 0xe07a4a, pants: 0x2f3a4a, hair: 0x141010, bun: true }),
      who("Sol", "seated", "think", [1.88, 0.55], -HALF, { skin: 0xe3b896, shirt: 0x6b4a8a, pants: 0x4a3b30, hair: 0xd9b34a, glasses: true }),
    ],
    { name: "Meeple", at: [-0.6, 2.0], rot: -0.6, color: 0xd9a05a, dark: 0xa0642a, line: "Asleep." },
    ["cafe"],
  ),
};

const params = new URLSearchParams(location.search);
// `corner=<slug>` draws a Corner's own config (its own characters), as the still pictures need. Otherwise a setting's fixture.
const config = CORNER_WORLDS.find((w) => w.slug === params.get("corner")) ?? ROOMS[params.get("setting") ?? "garden"];
const problems = checkConfig({ ...config, key: config.key.replace("fixture/", "fixture-space/") });
// The harness page says so loudly if a fixture breaks the config rules.
(window as unknown as { __problems: string[] }).__problems = problems;
// For `--cards`: every Corner with a config, and the pose its still picture is framed from (a wide screen's start pose).
(window as unknown as { __cards: unknown }).__cards = CORNER_WORLDS.map((w) => ({ slug: w.slug, setting: w.setting, pose: firstPose(w.setting, { phone: false, reducedMotion: true }) }));

const stage = document.getElementById("stage")!;
const world = createWorld(stage, {
  config,
  small: Math.min(window.innerWidth, window.innerHeight) < 700,
  reducedMotion: params.get("motion") !== "full",
  labels: { rack: config.copy.walls.still.label, shelf: config.copy.walls.made.label, yours: "Your shelf" },
  mood: (params.get("mood") ?? "golden") as MoodName,
  sound: false,
  music: false,
  onFrame() {},
  onSay() {},
  onOpen() {},
  onHover() {},
  onLost() {},
});
// Real pieces come from Moments. Here they are just ids: three in progress, four finished, two of the viewer's own.
world.setPlan(
  planRoom({
    making: [{ postId: 9001, mine: false }, { postId: 9002, mine: false }, { postId: 9003, mine: false }, { postId: 9010, mine: true }],
    made: [{ postId: 9004, mine: false }, { postId: 9005, mine: false }, { postId: 9006, mine: false }, { postId: 9007, mine: false }, { postId: 9011, mine: true }],
    mine: [{ postId: 9010, mine: true, finished: false }, { postId: 9011, mine: true, finished: true }],
  }),
);
// `enter=0` leaves the room as it is before the person taps Enter.
if (params.get("enter") !== "0") world.enter();
(window as unknown as { __firstFrameMs: number }).__firstFrameMs = world.firstFrameMs;
