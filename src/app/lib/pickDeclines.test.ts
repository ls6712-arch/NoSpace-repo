import { describe, expect, it } from "vitest";
import { DECLINES_KEY, loadDeclines, saveDeclines, withDecline } from "./pickDeclines";

const mem = (initial?: string) => {
  let v = initial ?? null;
  return { getItem: () => v, setItem: (_k: string, x: string) => void (v = x), get: () => v };
};

describe("pickDeclines", () => {
  it("adds an id once per stretch", () => {
    const a = withDecline({}, "2026-11-03:tue-eve", "event:1");
    expect(a).toEqual({ "2026-11-03:tue-eve": ["event:1"] });
    expect(withDecline(a, "2026-11-03:tue-eve", "event:1")).toBe(a);
    expect(withDecline(a, "2026-11-03:tue-eve", "event:2")["2026-11-03:tue-eve"]).toEqual(["event:1", "event:2"]);
  });

  it("saves and loads, and drops stretches from before today", () => {
    const s = mem();
    saveDeclines({ "2026-11-02:mon-eve": ["event:1"], "2026-11-03:tue-eve": ["event:2"] }, s);
    expect(loadDeclines("2026-11-03", s)).toEqual({ "2026-11-03:tue-eve": ["event:2"] });
  });

  it("survives a store that is empty, broken, the wrong shape, or blocked", () => {
    expect(loadDeclines("2026-11-03", mem())).toEqual({});
    expect(loadDeclines("2026-11-03", mem("{nope"))).toEqual({});
    expect(loadDeclines("2026-11-03", mem("[1]"))).toEqual({});
    expect(loadDeclines("2026-11-03", mem(JSON.stringify({ "2026-11-04:a": "x", "2026-11-04:b": [1, "event:3"] })))).toEqual({ "2026-11-04:b": ["event:3"] });
    expect(loadDeclines("2026-11-03", null)).toEqual({});
    expect(() => saveDeclines({}, { setItem: () => { throw new Error("blocked"); } })).not.toThrow();
    expect(DECLINES_KEY).toBe("soosh.calendar.notthis.v1");
  });
});
