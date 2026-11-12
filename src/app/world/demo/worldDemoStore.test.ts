import { describe, expect, it } from "vitest";
import {
  EMPTY_WORLD,
  STORAGE_KEY,
  TRAIL_LENGTH,
  addThings,
  bringHome,
  broughtHomeOn,
  currentStop,
  formFor,
  initials,
  loadWorld,
  packBag,
  saveWorld,
  stopsFor,
  thingsFrom,
  trailFinished,
  uncovered,
  type WorldState,
} from "./worldDemoStore";

const DAY = "2026-11-12";
const bring = (state: WorldState, thing: string, withName = "") =>
  bringHome(state, { thing, detail: "done", photo: null, withName, day: DAY });

describe("thingsFrom", () => {
  it("splits what someone said into separate things", () => {
    expect(thingsFrom("I want to learn ramen, start running and read more")).toEqual(["learn ramen", "start running", "read more"]);
  });

  it("drops repeats and empty parts", () => {
    expect(thingsFrom("chess, Chess,  , and chess")).toEqual(["chess"]);
  });
});

describe("trails", () => {
  it("gives any thing five stops, the first one small", () => {
    const stops = stopsFor("bake bread");
    expect(stops).toHaveLength(TRAIL_LENGTH);
    expect(stops[1]).toBe("Bake bread for 15 minutes");
  });

  it("adds new things once", () => {
    const once = addThings(EMPTY_WORLD, "chess and bake bread");
    const twice = addThings(once, "Chess");
    expect(twice.things.map((t) => t.name)).toEqual(["chess", "bake bread"]);
  });

  it("moves a trail on one stop for each keepsake and finishes after five", () => {
    let state = addThings(EMPTY_WORLD, "chess");
    for (let i = 0; i < TRAIL_LENGTH; i++) state = bring(state, "chess").state;
    expect(trailFinished(state.things[0])).toBe(true);
    expect(currentStop(state.things[0])).toBeNull();
  });
});

describe("the bag", () => {
  it("is emptied when its thing comes home", () => {
    const start = addThings(EMPTY_WORLD, "chess");
    const packed = packBag(start, start.things[0].id, "Tonight", " Priya ");
    expect(packed.bag?.withName).toBe("Priya");
    expect(bring(packed, "chess").state.bag).toBeNull();
  });

  it("ignores a thing that is not on the list", () => {
    expect(packBag(EMPTY_WORLD, "nope", "Tonight", "").bag).toBeNull();
  });
});

describe("keepsakes", () => {
  it("counts something done without a bag and starts its trail", () => {
    const { state, keepsake } = bring(EMPTY_WORLD, "went swimming");
    expect(keepsake.stop).toBeNull();
    expect(state.things[0]).toMatchObject({ name: "went swimming", stopsDone: 1 });
  });

  it("changes form at the 3rd, 10th and 25th of the same thing", () => {
    expect([1, 2, 3, 9, 10, 24, 25].map(formFor)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    let state = EMPTY_WORLD;
    state = bring(state, "run").state;
    state = bring(state, "run").state;
    expect(bring(state, "Run").keepsake.form).toBe(1);
  });

  it("lights the lamp on the day something came home", () => {
    const { state } = bring(EMPTY_WORLD, "run");
    expect(broughtHomeOn(state, DAY)).toBe(1);
    expect(broughtHomeOn(state, "2026-11-13")).toBe(0);
  });

  it("lists each different thing once, in the order it was first done", () => {
    let state = bring(EMPTY_WORLD, "run").state;
    state = bring(state, "read").state;
    state = bring(state, "run").state;
    expect(uncovered(state)).toEqual(["run", "read"]);
  });

  it("makes initials for a joined keepsake", () => {
    expect(initials(" priya ")).toBe("P.");
    expect(initials("")).toBe("");
  });
});

describe("storage", () => {
  it("round-trips through storage and survives bad data", () => {
    const box = new Map<string, string>();
    const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
    const { state } = bring(EMPTY_WORLD, "run");
    saveWorld(storage, state);
    expect(loadWorld(storage)).toEqual(state);
    box.set(STORAGE_KEY, "{not json");
    expect(loadWorld(storage)).toEqual(EMPTY_WORLD);
    expect(loadWorld(null)).toEqual(EMPTY_WORLD);
  });

  it("drops the oldest pictures, not the keepsakes, when storage is full", () => {
    let state = EMPTY_WORLD;
    state = bringHome(state, { thing: "run", detail: "a", photo: "x".repeat(50), withName: "", day: DAY }).state;
    state = bringHome(state, { thing: "read", detail: "b", photo: "y".repeat(50), withName: "", day: DAY }).state;
    let saved = "";
    const storage = {
      setItem: (_k: string, v: string) => {
        if (v.includes("x".repeat(50))) throw new Error("full");
        saved = v;
      },
    };
    const kept = saveWorld(storage, state);
    expect(kept.keepsakes).toHaveLength(2);
    expect(kept.keepsakes.find((k) => k.thing === "run")?.photo).toBeNull();
    expect(kept.keepsakes.find((k) => k.thing === "read")?.photo).toBe("y".repeat(50));
    expect(saved).not.toBe("");
  });
});

describe("worldDemoEnabled", () => {
  it("is off on the live site and on everywhere else", async () => {
    const { worldDemoEnabled } = await import("../../config");
    expect(worldDemoEnabled("www.onsoosh.com")).toBe(false);
    expect(worldDemoEnabled("onsoosh.com")).toBe(false);
    expect(worldDemoEnabled("www.trynospace.com")).toBe(true);
    expect(worldDemoEnabled("localhost")).toBe(true);
  });
});
