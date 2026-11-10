import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GLAZES, POT_SHAPES, ROOM_LIMITS, moodForHour, pieceSpec, planRoom, type RoomMoment } from "./layout";
import { WORLD_COPY, cornerWorld, opensAsRoom, signLine } from "./cornerWorlds";
import { pottery } from "./corners/pottery";

const m = (postId: number, o: Partial<RoomMoment> = {}): RoomMoment => ({ postId, mine: false, ...o });

describe("a Moment's piece", () => {
  it("always looks the same for the same Moment", () => {
    expect(pieceSpec(4821)).toEqual(pieceSpec(4821));
    expect(pieceSpec(1)).toEqual(pieceSpec(1));
  });

  it("differs between Moments", () => {
    const looks = new Set(Array.from({ length: 200 }, (_, i) => JSON.stringify(pieceSpec(i + 1))));
    expect(looks.size).toBe(200);
    const shapes = new Set(Array.from({ length: 200 }, (_, i) => pieceSpec(i + 1).shape));
    expect(shapes.size).toBe(POT_SHAPES.length);
  });

  it("stays inside what the room can draw", () => {
    for (let id = 1; id < 500; id++) {
      const s = pieceSpec(id);
      expect(POT_SHAPES).toContain(s.shape);
      expect(GLAZES).toContain(s.glaze);
      expect(s.scale).toBeGreaterThanOrEqual(0.85);
      expect(s.scale).toBeLessThanOrEqual(1.1);
    }
  });
});

describe("the room plan", () => {
  it("puts Still making on the rack as bare clay and Made it on the shelves, glazed", () => {
    const plan = planRoom({ making: [m(1), m(2)], made: [m(3)], mine: [] });
    expect(plan.placements).toEqual([
      { postId: 1, spot: "rack", slot: 0, glazed: false },
      { postId: 2, spot: "rack", slot: 1, glazed: false },
      { postId: 3, spot: "shelf", slot: 0, glazed: true },
    ]);
  });

  it("puts the viewer's finished pieces on Your shelf and their pieces in progress on the rack, once each", () => {
    const plan = planRoom({
      making: [m(10, { mine: true, pursuitId: "mine-a" }), m(1)],
      made: [m(11, { mine: true, pursuitId: "mine-b" })],
      mine: [
        { postId: 10, pursuitId: "mine-a", mine: true, finished: false },
        { postId: 11, pursuitId: "mine-b", mine: true, finished: true },
        // A private Moment of the viewer's own: on no wall, still in their room.
        { postId: 12, mine: true, finished: false },
      ],
    });
    expect(plan.placements.filter((p) => p.postId === 10)).toEqual([{ postId: 10, spot: "rack", slot: 0, glazed: false }]);
    expect(plan.placements.filter((p) => p.postId === 11)).toEqual([{ postId: 11, spot: "yours", slot: 0, glazed: true }]);
    expect(plan.placements.find((p) => p.postId === 12)?.spot).toBe("rack");
    expect(new Set(plan.placements.map((p) => p.postId)).size).toBe(plan.placements.length);
  });

  it("shows the newest only: 8 on the rack, 10 on the shelves, 5 on Your shelf", () => {
    const many = (from: number, n: number) => Array.from({ length: n }, (_, i) => m(from + i));
    const plan = planRoom({
      making: many(100, 30),
      made: many(200, 30),
      mine: Array.from({ length: 9 }, (_, i) => ({ postId: 300 + i, pursuitId: `p${i}`, mine: true, finished: true })),
    });
    const count = (spot: string) => plan.placements.filter((p) => p.spot === spot).length;
    expect(count("rack")).toBe(ROOM_LIMITS.rack);
    expect(count("shelf")).toBe(ROOM_LIMITS.shelf);
    expect(count("yours")).toBe(ROOM_LIMITS.yours);
    expect(plan.placements.filter((p) => p.spot === "rack").map((p) => p.postId)).toEqual([100, 101, 102, 103, 104, 105, 106, 107]);
  });

  it("joins a piece to the one it started because of, when both are in the room", () => {
    const plan = planRoom({ making: [m(1, { pursuitId: "a", inspiredByPostId: 3 })], made: [m(3, { pursuitId: "b" })], mine: [] });
    expect(plan.threads).toEqual([[3, 1]]);
  });

  it("draws no thread to a source the viewer cannot see", () => {
    // corner_wall leaves inspiredByPostId out when the viewer may not read the source. Even if an id came
    // through, a source that is not in the room gets no thread.
    expect(planRoom({ making: [m(1, { pursuitId: "a" })], made: [], mine: [] }).threads).toEqual([]);
    expect(planRoom({ making: [m(1, { pursuitId: "a", inspiredByPostId: 999 })], made: [], mine: [] }).threads).toEqual([]);
  });

  it("follows Passed along chains by Pursuit, without doubling a thread", () => {
    const plan = planRoom({
      making: [m(1, { pursuitId: "a", inspiredByPostId: 3 }), m(2, { pursuitId: "c" })],
      made: [m(3, { pursuitId: "b" })],
      mine: [],
      chains: [["b", "a", "c"], ["b", "missing"]],
    });
    expect(plan.threads).toEqual([
      [3, 1],
      [1, 2],
    ]);
  });
});

describe("signs", () => {
  it("count pieces, never people", () => {
    expect(signLine(pottery, "rack", 2)).toBe("2 in progress");
    expect(signLine(pottery, "shelf", 3)).toBe("3 finished");
    expect(signLine(pottery, "yours", 0)).toBe("Empty for now");
    expect(signLine(pottery, "yours", 1)).toBe("1 piece");
    expect(signLine(pottery, "yours", 4)).toBe("4 pieces");
  });

  it("show no number when the wall has more than was fetched", () => {
    expect(signLine(pottery, "rack", 120, false)).toBe("");
    expect(signLine(pottery, "shelf", 120, false)).toBe("");
  });
});

describe("which Corners have a room", () => {
  it("is Pottery only, and Ceramics because it was merged into Pottery", () => {
    expect(cornerWorld("crafts-making", "pottery")?.key).toBe("crafts-making/pottery");
    expect(cornerWorld("art-creative", "ceramics")?.key).toBe("crafts-making/pottery");
    expect(cornerWorld("art-creative", "drawing")).toBeUndefined();
    expect(cornerWorld("food-cooking", "coffee")).toBeUndefined();
  });
});

describe("how a Corner opens", () => {
  const yes = { hasRoom: true, member: true, view: "room" as const, unavailable: false };
  it("is the room for a member, when the Corner has one", () => {
    expect(opensAsRoom(yes)).toBe(true);
  });
  it("is the list for a Corner without a room, a visitor, someone who chose the list, or a device that cannot draw it", () => {
    expect(opensAsRoom({ ...yes, hasRoom: false })).toBe(false);
    expect(opensAsRoom({ ...yes, member: false })).toBe(false);
    expect(opensAsRoom({ ...yes, view: "list" })).toBe(false);
    expect(opensAsRoom({ ...yes, unavailable: true })).toBe(false);
  });
  it("is never called a studio in anything a person reads", () => {
    // Everything a person reads or hears read out. (`setting: "studio"` is the engine's name for the furniture and is never shown.)
    const shown = JSON.stringify([WORLD_COPY, pottery.name, pottery.copy, pottery.characters.map((c) => [c.name, c.lines, c.collapseLine]), pottery.pet?.line, pottery.greeting]);
    expect(shown).not.toMatch(/studio/i);
  });
});

describe("My clock", () => {
  it("picks the mood from the hour", () => {
    expect(moodForHour(7)).toBe("morning");
    expect(moodForHour(15)).toBe("morning");
    expect(moodForHour(17)).toBe("golden");
    expect(moodForHour(21)).toBe("night");
    expect(moodForHour(3)).toBe("night");
  });
});

describe("what ships", () => {
  const dir = __dirname;
  /** Every source file of the world, by its path under this folder. */
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : []));
  const files = walk(dir).map((f) => ({ rel: path.relative(dir, f).split(path.sep).join("/"), text: fs.readFileSync(f, "utf8") }));
  const page = fs.readFileSync(path.resolve(dir, "../pages/CornerWorld.tsx"), "utf8");
  const code = [...files.map((f) => f.text), page].join("\n");
  /** The engine: every file that is not a Corner's config. */
  const engine = files.filter((f) => !f.rel.startsWith("corners/"));
  /** The files with no 3D in them, which the Corner page may import without downloading the engine. */
  const plain = files.filter((f) => f.rel.startsWith("corners/") || ["config.ts", "cornerWorlds.ts", "layout.ts"].includes(f.rel));

  // The prototype's example people, their example Moments and the scripted chat. None of it may ship.
  it("has none of the prototype's example people, Moments or chat", () => {
    for (const name of ["Maya", "Alex", "Priya", "Jordan", "Ines", "Jun", "Sam"]) {
      // config.ts lists the names so it can refuse them; nowhere else may say them.
      for (const f of files) if (f.rel !== "config.ts") expect(f.text, `${name} in ${f.rel}`).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(page).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    for (const text of ["lemon mug", "nesting bowls", "Example", "Wish me luck", "Welcome! Show us"]) expect(code).not.toContain(text);
  });

  it("keeps characters out of everything that holds real people, and out of the engine", () => {
    // A character's name and words live in its Corner's config and nowhere else: not in the engine (which draws
    // any Corner), not in the layout, the registry or the page (which hold real Moments and people).
    const names = pottery.characters.map((c) => c.name).concat(pottery.pet ? [pottery.pet.name] : []);
    expect(names).toEqual(["Arjun", "Meera", "Lena", "Biscuit"]);
    for (const f of engine) for (const name of names) expect(f.text, `${name} in ${f.rel}`).not.toContain(name);
    for (const name of names) expect(page).not.toContain(name);
    expect(page).toContain("WORLD_COPY.character");
    expect(WORLD_COPY.character).toBe("Character");
  });

  it("has no Corner's words in the engine", () => {
    for (const f of engine) {
      for (const c of pottery.characters) for (const line of c.lines) expect(f.text, f.rel).not.toContain(line);
      expect(f.text, f.rel).not.toContain(pottery.copy.intro);
      expect(f.text, f.rel).not.toContain(pottery.greeting[1]);
    }
  });

  it("loads three.js only inside the engine, as one file fetched when a room opens", () => {
    // The plain files import nothing that draws: not three, and not any engine folder.
    for (const f of plain) {
      expect(f.text, f.rel).not.toMatch(/from "three"/);
      expect(f.text, f.rel).not.toMatch(/from "(\.\.?\/)+(core|settings|pieces|characters|sound)(\/|")/);
    }
    expect(page).toMatch(/import\("\.\.\/world\/core\/scene"\)/);
    expect(page).not.toMatch(/^import (?!type).*from "\.\.\/world\/(core|settings|pieces|characters|sound)/m);
    expect(page).not.toMatch(/from "three"/);
    // Every Corner goes through the same entry point: no Corner has engine code of its own.
    expect(files.filter((f) => /createWorld\(/.test(f.text)).map((f) => f.rel)).toEqual(["core/scene.ts"]);
  });

  it("pins three to an exact version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "../../../package.json"), "utf8"));
    expect(pkg.dependencies.three).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("the old paths", () => {
  // The page backdrop patch (built before the room became an engine) imports these four from the room's old paths.
  it("still export what the backdrop patch imports", async () => {
    const [kit, characters, moods, layout] = await Promise.all([import("./kit"), import("./characters"), import("./moods"), import("./layout")]);
    for (const name of ["PI", "at", "box", "cyl", "sph", "mat", "mesh", "glow", "canvasTex", "css", "disposeTree"]) expect(kit, name).toHaveProperty(name);
    expect(typeof characters.buildPerson).toBe("function");
    expect(typeof characters.buildCat).toBe("function");
    expect(typeof moods.moodState).toBe("function");
    expect(typeof moods.easeMood).toBe("function");
    expect(Object.keys(moods.MOODS).sort()).toEqual(["golden", "morning", "night"]);
    expect(typeof layout.rng).toBe("function");
    expect(layout.rng(42)()).toBe(layout.rng(42)());
  });
});
