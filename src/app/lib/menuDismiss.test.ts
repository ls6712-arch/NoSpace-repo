import { describe, expect, it } from "vitest";
import { isDismissKey } from "./menuDismiss";

describe("isDismissKey", () => {
  it("treats Escape as a dismiss", () => {
    expect(isDismissKey("Escape")).toBe(true);
  });

  it("leaves every other key alone, including navigation keys", () => {
    expect(isDismissKey("Enter")).toBe(false);
    expect(isDismissKey("ArrowDown")).toBe(false);
    expect(isDismissKey("Tab")).toBe(false);
    expect(isDismissKey("a")).toBe(false);
    expect(isDismissKey("")).toBe(false);
  });
});
