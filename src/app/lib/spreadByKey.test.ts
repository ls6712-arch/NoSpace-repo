import { describe, expect, it } from "vitest";
import { spreadByKey } from "./spreadByKey";

const key = (s: string) => s[0];

describe("spreadByKey", () => {
  it("keeps an order that already works", () => {
    expect(spreadByKey(["a1", "b1", "a2", "b2"], key)).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("separates neighbours that share a key", () => {
    const out = spreadByKey(["a1", "a2", "b1", "a3", "c1"], key);
    for (let i = 1; i < out.length; i++) expect(key(out[i])).not.toBe(key(out[i - 1]));
    expect([...out].sort()).toEqual(["a1", "a2", "a3", "b1", "c1"]);
  });

  it("puts the leftovers at the end when it cannot separate them", () => {
    expect(spreadByKey(["a1", "a2", "a3"], key)).toEqual(["a1", "a2", "a3"]);
  });
});
