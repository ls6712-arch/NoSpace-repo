import { describe, expect, it } from "vitest";
import { notificationText, withoutDashes } from "./text";

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

describe("notificationText", () => {
  it("capitalizes product nouns and drops dashes", () => {
    expect(notificationText("Ana loved your moment.")).toBe("Ana loved your Moment.");
    expect(notificationText("Nani added their first moments.")).toBe("Nani added their first Moments.");
    expect(notificationText("Request declined — try again.")).toBe("Request declined. Try again.");
  });
});
