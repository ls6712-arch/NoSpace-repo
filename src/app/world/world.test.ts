import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GLAZES, POT_SHAPES, ROOM_LIMITS, moodForHour, pieceSpec, planRoom, type RoomMoment } from "./layout";
import { WORLD_COPY, cornerWorld, opensAsRoom, signLine } from "./cornerWorlds";

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
    expect(signLine("rack", 2)).toBe("2 in progress");
    expect(signLine("shelf", 3)).toBe("3 finished");
    expect(signLine("yours", 0)).toBe("Empty for now");
    expect(signLine("yours", 1)).toBe("1 piece");
    expect(signLine("yours", 4)).toBe("4 pieces");
  });

  it("show no number when the wall has more than was fetched", () => {
    expect(signLine("rack", 120, false)).toBe("");
    expect(signLine("shelf", 120, false)).toBe("");
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
    const shown = JSON.stringify([WORLD_COPY, cornerWorld("crafts-making", "pottery")]);
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
  const sources = [...fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(dir, f)), path.resolve(dir, "../pages/CornerWorld.tsx")];
  const code = sources.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  // The prototype's example people, their example Moments and the scripted chat. None of it may ship.
  it("has none of the prototype's example people, Moments or chat", () => {
    for (const name of ["Maya", "Alex", "Priya", "Jordan", "Ines", "Jun", "Sam"]) expect(code).not.toMatch(new RegExp(`\\b${name}\\b`));
    for (const text of ["lemon mug", "nesting bowls", "Example", "Wish me luck", "Welcome! Show us"]) expect(code).not.toContain(text);
  });

  it("keeps characters out of everything that holds real people", () => {
    // Characters live in the studio and nowhere else: the layout, the page's data and the registry never name them.
    for (const file of ["layout.ts", "cornerWorlds.ts"]) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      for (const name of ["Meera", "Arjun", "Lena", "Biscuit"]) expect(text).not.toContain(name);
    }
    const page = fs.readFileSync(path.resolve(dir, "../pages/CornerWorld.tsx"), "utf8");
    for (const name of ["Meera", "Arjun", "Lena", "Biscuit"]) expect(page).not.toContain(name);
    expect(page).toContain("WORLD_COPY.character");
    expect(WORLD_COPY.character).toBe("Character");
  });

  it("loads three.js only inside the world", () => {
    expect(fs.readFileSync(path.join(dir, "cornerWorlds.ts"), "utf8")).not.toMatch(/from "three"|from "\.\/scene"/);
    expect(fs.readFileSync(path.join(dir, "layout.ts"), "utf8")).not.toMatch(/from "three"/);
    const page = fs.readFileSync(path.resolve(dir, "../pages/CornerWorld.tsx"), "utf8");
    expect(page).toMatch(/import\("\.\.\/world\/scene"\)/);
    expect(page).not.toMatch(/^import (?!type).*from "\.\.\/world\/scene"/m);
    expect(page).not.toMatch(/from "three"/);
  });

  it("pins three to an exact version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "../../../package.json"), "utf8"));
    expect(pkg.dependencies.three).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
