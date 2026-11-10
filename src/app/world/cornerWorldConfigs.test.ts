import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_NAMES, PIECE_KINDS, SETTING_NAMES, checkConfig, type CornerWorldConfig } from "./config";
import { CORNER_WORLDS } from "./corners";
import { ACTIONS } from "./characters/actions";
import { MADE_KINDS, pieceHeight } from "./pieces";
import { GLIDE_SECONDS, START_POSES, firstPose, glidePose, glides, settledPose } from "./core/poses";
import { THEMES } from "./core/themes";
import { pieceSpec } from "./layout";
import { SETTINGS } from "./settings";
import { cornerWorld } from "./cornerWorlds";
import { hobbies } from "../data/hobbies";
import { roomWallLabels } from "../lib/cornerWallLabels";

/**
 * The rules every Corner's room config keeps: the checks of the reference build script (build_corner.py),
 * plus the ones that keep prototype content out. Runs on every config in ./corners.
 */
/** A loose copy, so a test can break it in ways the type would not allow. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const clone = (c: CornerWorldConfig): Loose => JSON.parse(JSON.stringify(c));
const pottery = CORNER_WORLDS.find((c) => c.slug === "pottery")!;

describe("every Corner's room config", () => {
  it("passes every check", () => {
    for (const c of CORNER_WORLDS) expect(checkConfig(c), c.slug).toEqual([]);
  });

  it("is for a real Corner, once", () => {
    const keys = CORNER_WORLDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CORNER_WORLDS) {
      const [space, slug] = c.key.split("/");
      const corner = hobbies.find((h) => h.slug === space)?.subItems.find((s) => s.slug === slug);
      expect(corner, c.key).toBeDefined();
      expect(corner?.label).toBe(c.name);
      expect(cornerWorld(space, slug)).toBe(c);
    }
  });

  it("names its walls the way the founder decided", () => {
    for (const c of CORNER_WORLDS) {
      const decided = roomWallLabels(c.key);
      expect(decided, `${c.key} has no decided wall labels`).toBeDefined();
      expect({ making: c.copy.walls.still.label, made: c.copy.walls.made.label }).toEqual(decided);
    }
  });

  it("keeps only what ships: no example Walls, threads, chat or activities", () => {
    for (const c of CORNER_WORLDS) {
      for (const k of ["wall", "edges", "chat", "activities"]) expect(c).not.toHaveProperty(k);
      for (const k of ["pmeta", "chatHere"]) expect(c.copy).not.toHaveProperty(k);
    }
  });

  it("is a plain file: no 3D code, no engine import", () => {
    const dir = path.join(__dirname, "corners");
    for (const f of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      expect(text, f).not.toMatch(/from "three"/);
      expect(text.match(/^import .*$/gm)?.every((l) => /from "\.\.\/config"|from "\.\/[a-z-]+"/.test(l)) ?? true, f).toBe(true);
    }
  });
});

describe("the engine can build everything a config may ask for", () => {
  it("has a builder for every setting, an action for every action name and a maker for every piece kind", () => {
    expect(Object.keys(SETTINGS).sort()).toEqual([...SETTING_NAMES].sort());
    expect(Object.keys(ACTIONS).sort()).toEqual([...ACTION_NAMES].sort());
    expect([...MADE_KINDS].sort()).toEqual([...PIECE_KINDS].sort());
  });
});

describe("every setting", () => {
  it("has a theme and a camera start pose", () => {
    expect(Object.keys(THEMES).sort()).toEqual([...SETTING_NAMES].sort());
    expect(Object.keys(START_POSES).sort()).toEqual([...SETTING_NAMES].sort());
  });

  it("keeps the studio's look and start pose as they were", () => {
    expect(THEMES.studio).toMatchObject({ open: false, floor: "wood", floorTint: 0xffffff, wallLeft: 0xead8bf, trim: 0x5a3b26, frame: 0x3f5a4c, shelf: 0x9b7a62, win: [-1.7, 0.7, 1.2, 3.2], tall: false, bright: 1 });
    expect(THEMES.studio.wallBack).toEqual({ kind: "plaster", color: 0xe6d2b8 });
    expect(START_POSES.studio).toEqual({ look: [0.1, 1.0, -0.3], yaw: 0.42, pitch: 0.3, radius: 7.4, radiusPhone: 9.6 });
  });

  it("only the garden is open, and its camera starts further left and further back to take the garden in", () => {
    expect(SETTING_NAMES.filter((s) => THEMES[s].open)).toEqual(["garden"]);
    expect(START_POSES.garden.look[0]).toBeLessThan(START_POSES.studio.look[0]);
    expect(START_POSES.garden.radius).toBeGreaterThan(START_POSES.studio.radius);
    expect(START_POSES.nook).toEqual(START_POSES.studio);
    expect(START_POSES.cafe).toEqual(START_POSES.studio);
  });
});

describe("the garden on a phone", () => {
  const phone = { phone: true, reducedMotion: false };
  it("starts on the garden outside, and ends at the walls", () => {
    const first = firstPose("garden", phone);
    const end = settledPose("garden", true);
    expect(first).toEqual(START_POSES.garden.arrivePhone);
    // Outside is to the left of the room's left wall (x = -4.7).
    expect(first.look[0]).toBeLessThan(-4.7);
    expect(end.look[0]).toBeGreaterThan(-4.7);
    // It ends on the walls framed exactly as a phone frames them in every other room, so the rack and signs are in view.
    expect(end).toEqual(settledPose("studio", true));
    expect(glides("garden", phone)).toBe(true);
    expect(glidePose(first, end, 0)).toEqual(first);
    expect(glidePose(first, end, 1)).toEqual(end);
    expect(glidePose(first, end, 7)).toEqual(end);
    const mid = glidePose(first, end, 0.5);
    expect(mid.look[0]).toBeGreaterThan(first.look[0]);
    expect(mid.look[0]).toBeLessThan(end.look[0]);
    expect(GLIDE_SECONDS).toBe(2);
  });

  it("with reduced motion starts at the walls and does not glide", () => {
    const calm = { phone: true, reducedMotion: true };
    expect(firstPose("garden", calm)).toEqual(settledPose("garden", true));
    expect(glides("garden", calm)).toBe(false);
  });

  it("is the only glide: a wide screen, and every other setting, start where they stay", () => {
    expect(glides("garden", { phone: false, reducedMotion: false })).toBe(false);
    expect(firstPose("garden", { phone: false, reducedMotion: false })).toEqual(settledPose("garden", false));
    for (const s of SETTING_NAMES.filter((x) => x !== "garden")) {
      expect(glides(s, phone), s).toBe(false);
      expect(firstPose(s, phone), s).toEqual(settledPose(s, true));
    }
  });

  it("stops the glide the moment the screen is touched, and takes every pose from the one constants file", () => {
    const scene = fs.readFileSync(path.join(__dirname, "core/scene.ts"), "utf8");
    expect(scene).toMatch(/const onDown = \(e: PointerEvent\) => \{\n\s+gliding = false;/);
    // The engine has no camera numbers of its own: the start comes from firstPose and the end from settledPose.
    expect(scene).toContain("const first = firstPose(config.setting, { phone, reducedMotion });");
    expect(scene).toContain("const settled = settledPose(config.setting, phone);");
    expect(scene).not.toMatch(/let yaw = [0-9.]+;|let radius = [0-9.]+;|new T\.Vector3\(0\.1, 1\.0, -0\.3\)/);
  });
});

describe("every kind of piece", () => {
  it("stands taller finished than in progress, and under the shelf above it", () => {
    const spec = pieceSpec(4821);
    for (const kind of PIECE_KINDS) {
      const still = pieceHeight(kind, spec, false);
      const made = pieceHeight(kind, spec, true);
      expect(still, kind).toBeGreaterThan(0);
      expect(made, kind).toBeGreaterThanOrEqual(still);
      // The tallest piece at its largest (1.1) still fits the 0.6 of headroom on a shelf.
      expect(made * 1.1, kind).toBeLessThan(0.6);
    }
  });
});

describe("the checks", () => {
  const broken = (change: (c: Loose) => void) => {
    const c = clone(pottery);
    change(c);
    return checkConfig(c).join(" | ");
  };

  it("refuse a missing field", () => {
    expect(broken((c) => delete c.setting)).toContain('missing "setting"');
    expect(broken((c) => delete c.characters)).toContain('missing "characters"');
  });

  it("refuse an unknown setting, piece kind, action or pose", () => {
    expect(broken((c) => (c.setting = "spaceship"))).toContain("setting must be one of");
    expect(broken((c) => (c.pieceKind = "sock"))).toContain("pieceKind must be one of");
    expect(broken((c) => (c.characters[0].action = "juggle"))).toContain("action must be one of");
    expect(broken((c) => (c.characters[0].pose = "flying"))).toContain("pose must be seated, standing or kneel");
  });

  it("refuse an action in a setting that lacks what it needs", () => {
    expect(broken((c) => (c.characters[0].action = "dice"))).toContain('action "dice" only works in the cafe setting');
    expect(broken((c) => (c.characters[0].action = "move"))).toContain('action "move" only works in the cafe setting');
    expect(broken((c) => { c.setting = "garden"; })).toContain('action "wheel" only works in the studio setting');
  });

  it("refuse a station that points at nobody in the room", () => {
    expect(broken((c) => (c.stations = { wheel: { x: 0, z: 0, who: "Nobody", line: "Hi." } }))).toContain('station wheel: "Nobody" is not a character');
    expect(broken((c) => (c.stations = { wheel: { x: 0, z: 0, who: "Meera", line: "Sit in." } }))).toBe("");
  });

  it("refuse a colour that is not one", () => {
    expect(broken((c) => (c.characters[0].look.skin = "brown"))).toContain("look.skin must be a colour");
    expect(broken((c) => (c.pet.color = -1))).toContain("pet: color and dark must be colours");
  });

  it("refuse a greeting from someone who is not a character", () => {
    expect(broken((c) => (c.greeting = ["Nobody", "Hi."]))).toContain("greeting must be said by a character");
  });

  it("need both walls named", () => {
    expect(broken((c) => delete c.copy.walls.made)).toContain("copy.walls.made needs a label and a sub");
    expect(broken((c) => (c.copy.walls.still.sub = ""))).toContain("copy.walls.still needs a label and a sub");
  });

  it("refuse an em or en dash anywhere", () => {
    expect(broken((c) => (c.copy.intro = "Come in \u2014 sit down."))).toContain("em or en dash");
    expect(broken((c) => (c.characters[1].lines[0] = "Slow hands \u2013 fast wheel."))).toContain("em or en dash");
  });

  it("refuse the prototype's example people, Walls, threads, chat and activities", () => {
    expect(broken((c) => (c.wall = [{ slot: "still0", who: "Anyone" }]))).toContain('"wall" is prototype-only');
    expect(broken((c) => (c.edges = []))).toContain('"edges" is prototype-only');
    expect(broken((c) => (c.chat = { initial: [] }))).toContain('"chat" is prototype-only');
    expect(broken((c) => (c.activities = []))).toContain('"activities" is prototype-only');
    expect(broken((c) => (c.copy.chatHere = "Three people are here now"))).toContain("copy.chatHere is prototype-only");
    expect(broken((c) => (c.characters[0].lines[0] = "Maya showed me this."))).toContain("example person");
    expect(broken((c) => (c.extra = 1))).toContain('unknown key "extra"');
  });
});

describe("adding a Corner", () => {
  it("needs only a config: a made-up fifth Corner passes the checks using what the engine already has", () => {
    const { pet: _noPet, ...rest } = pottery;
    void _noPet;
    const fifth: CornerWorldConfig = {
      ...rest,
      key: "crafts-making/origami",
      slug: "origami",
      name: "Origami",
      copy: { ...pottery.copy, intro: "Paper everywhere. Come fold something, finished or not.", stageLabel: "The Origami Corner as a 3D room." },
      characters: [
        { name: "Tomo", pose: "standing", action: "press", at: [-1.6, -0.3], rot: 0, look: { skin: 0xc08a63, shirt: 0x6b7a3f, pants: 0x4a3b30, apron: 0xc9b79a, hair: 0x1c1310 }, lines: ["Crease it twice."] },
      ],
      greeting: ["Tomo", "Hello. Take a square."],
    };
    expect(checkConfig(fifth)).toEqual([]);
    // Nothing it asks for is missing from the engine.
    expect(Object.keys(SETTINGS)).toContain(fifth.setting);
    expect(MADE_KINDS).toContain(fifth.pieceKind);
    for (const c of fifth.characters) expect(Object.keys(ACTIONS)).toContain(c.action);
  });
});
