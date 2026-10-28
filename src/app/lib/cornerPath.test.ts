import { describe, expect, it } from "vitest";
import { cornerPath } from "./cornerPath";

describe("cornerPath", () => {
  it("sends every Corner to the Corners page", () => {
    expect(cornerPath("sports-fitness", "running")).toBe("/corners/running");
    expect(cornerPath(undefined, "running")).toBe("/corners/running");
    expect(cornerPath("sports-fitness", "padel")).toBe("/corners/padel");
    expect(cornerPath("food-cooking", "baking")).toBe("/corners/baking");
  });
});
