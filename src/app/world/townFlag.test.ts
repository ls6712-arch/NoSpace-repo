import { describe, expect, it } from "vitest";
import { lowPowerDevice, townBackdropOn } from "./townFlag";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("town backdrop switch", () => {
  it("is on for everyone by default", () => {
    expect(townBackdropOn({ search: "" }, memory(), false)).toBe(true);
  });

  it("can be hidden in one browser, and brought back", () => {
    const store = memory();
    expect(townBackdropOn({ search: "?town=off" }, store, false)).toBe(false);
    expect(townBackdropOn({ search: "" }, store, false)).toBe(false);
    expect(townBackdropOn({ search: "?town=on" }, store, false)).toBe(true);
    expect(townBackdropOn({ search: "" }, store, false)).toBe(true);
  });

  it("is off under browser automation", () => {
    expect(townBackdropOn({ search: "" }, memory(), true)).toBe(false);
    expect(townBackdropOn({ search: "?town=on" }, memory(), true)).toBe(false);
  });

  it("still works when the browser blocks storage", () => {
    expect(townBackdropOn({ search: "" }, null, false)).toBe(true);
    expect(townBackdropOn({ search: "?town=off" }, null, false)).toBe(false);
  });
});

describe("low-power devices", () => {
  it("treats save-data, little memory or few cores as low power", () => {
    expect(lowPowerDevice({ connection: { saveData: true }, hardwareConcurrency: 8 })).toBe(true);
    expect(lowPowerDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(true);
    expect(lowPowerDevice({ hardwareConcurrency: 4 })).toBe(true);
  });

  it("lets capable devices move", () => {
    expect(lowPowerDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(lowPowerDevice({ hardwareConcurrency: 10 })).toBe(false);
  });
});
