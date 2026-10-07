import { describe, expect, it } from "vitest";
import { withoutDashes } from "./text";

describe("withoutDashes", () => {
  it("turns a spaced dash into a sentence break", () => {
    expect(withoutDashes("A Space needs at least one host — promote someone else first.")).toBe(
      "A Space needs at least one host. Promote someone else first.",
    );
  });
  it("uses 'to' between numbers", () => {
    expect(withoutDashes("Pick 1–3 Corners.")).toBe("Pick 1 to 3 Corners.");
  });
  it("leaves text without dashes alone", () => {
    expect(withoutDashes("Nani loved your Moment.")).toBe("Nani loved your Moment.");
  });
});
