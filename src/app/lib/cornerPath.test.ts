import { describe, expect, it } from "vitest";
import { cornerPath, curatedRedirectFor } from "./cornerPath";

describe("cornerPath", () => {
  it("sends a curated Corner to the Corners page", () => {
    expect(cornerPath("sports-fitness", "running")).toBe("/corners/running");
    expect(cornerPath(undefined, "running")).toBe("/corners/running");
  });
  it("keeps every other Corner on the older page", () => {
    expect(cornerPath("sports-fitness", "padel")).toBe("/corner/padel");
    expect(cornerPath("crafts-making", "running")).toBe("/corner/running");
  });
});

describe("curatedRedirectFor", () => {
  it("redirects a curated slug and leaves the rest alone", () => {
    expect(curatedRedirectFor("pottery")).toBe("/corners/pottery");
    expect(curatedRedirectFor("padel")).toBeNull();
    expect(curatedRedirectFor("nope")).toBeNull();
  });
});
