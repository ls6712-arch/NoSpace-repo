import { describe, expect, it } from "vitest";
import { townBackdropOn } from "./townFlag";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("town backdrop flag", () => {
  it("is off on the live site for everyone", () => {
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "" }, memory())).toBe(false);
    expect(townBackdropOn({ hostname: "onsoosh.com", search: "" }, memory())).toBe(false);
  });

  it("is on for staging and local dev", () => {
    expect(townBackdropOn({ hostname: "www.trynospace.com", search: "" }, memory())).toBe(true);
    expect(townBackdropOn({ hostname: "localhost", search: "" }, memory())).toBe(true);
  });

  it("can be previewed on the live site in one browser, and turned back off", () => {
    const store = memory();
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "?town=on" }, store)).toBe(true);
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "" }, store)).toBe(true);
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "?town=off" }, store)).toBe(false);
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "" }, store)).toBe(false);
  });

  it("still works when the browser blocks storage", () => {
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "" }, null)).toBe(false);
    expect(townBackdropOn({ hostname: "www.onsoosh.com", search: "?town=on" }, null)).toBe(true);
  });
});
