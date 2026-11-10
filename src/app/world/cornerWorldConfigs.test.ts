import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_NAMES, PIECE_KINDS, SETTING_NAMES, checkConfig, type CornerWorldConfig } from "./config";
import { CORNER_WORLDS } from "./corners";
import { ACTIONS } from "./characters/actions";
import { MADE_KINDS } from "./pieces";
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
