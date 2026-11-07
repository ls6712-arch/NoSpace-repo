import { describe, expect, it } from "vitest";
import { shouldPrefetch } from "./prefetchTabs";

describe("shouldPrefetch", () => {
  it("goes ahead when the browser says nothing", () => expect(shouldPrefetch(undefined)).toBe(true));
  it("goes ahead on a normal connection", () => expect(shouldPrefetch({ effectiveType: "4g" })).toBe(true));
  it("holds back when the person saves data", () => expect(shouldPrefetch({ saveData: true, effectiveType: "4g" })).toBe(false));
  it("holds back on a very slow connection", () => {
    expect(shouldPrefetch({ effectiveType: "2g" })).toBe(false);
    expect(shouldPrefetch({ effectiveType: "slow-2g" })).toBe(false);
  });
});
