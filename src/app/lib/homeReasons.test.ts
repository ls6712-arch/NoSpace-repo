import { describe, expect, it } from "vitest";
import { reasonLine } from "./homeReasons";

// Thursday Nov 5, 2026, 7 PM in New York.
const THU_EVE = Date.parse("2026-11-06T00:00:00Z");

describe("the why line", () => {
  it("joins two reasons with a dot, in the approved wording", () => {
    expect(reasonLine({ reasons: ["fits_window", "friend_going"], startsAt: THU_EVE, friendName: "Priya", passKind: null })).toBe(
      "Fits your Thursday evening · Priya’s going",
    );
  });

  it("names a pick, a pass and the fallback", () => {
    expect(reasonLine({ reasons: ["picked"], startsAt: null, friendName: null, passKind: null })).toBe("One of your picks");
    expect(reasonLine({ reasons: ["pass"], startsAt: THU_EVE, friendName: null, passKind: "museum" })).toBe("Your museum pass");
    expect(reasonLine({ reasons: ["affinity"], startsAt: null, friendName: null, passKind: null })).toBe("You might like this");
  });

  it("says nothing it cannot back up", () => {
    // A friend with no name, a pass with an unknown kind, a window with no start time.
    expect(reasonLine({ reasons: ["friend_going"], startsAt: THU_EVE, friendName: null, passKind: null })).toBeNull();
    expect(reasonLine({ reasons: ["pass"], startsAt: THU_EVE, friendName: null, passKind: "jetpack" })).toBeNull();
    expect(reasonLine({ reasons: ["fits_window"], startsAt: null, friendName: null, passKind: null })).toBeNull();
  });

  it("says the three nearby, trending and soon reasons in the approved wording", () => {
    const one = (reasons: ("nearby" | "trending" | "soon")[]) => reasonLine({ reasons, startsAt: THU_EVE, friendName: null, passKind: null });
    expect(one(["nearby"])).toBe("Close to you");
    expect(one(["trending"])).toBe("People are joining");
    expect(one(["soon"])).toBe("Starting soon");
    expect(one(["nearby", "trending"])).toBe("Close to you · People are joining");
  });

  it("joins a pick with a nearby reason", () => {
    expect(reasonLine({ reasons: ["picked", "nearby"], startsAt: THU_EVE, friendName: null, passKind: null })).toBe("One of your picks · Close to you");
  });

  it("never shows a price or a number of people", () => {
    const line = reasonLine({ reasons: ["picked", "friend_going"], startsAt: THU_EVE, friendName: "Priya", passKind: null }) ?? "";
    expect(line).not.toMatch(/\$|free|\d/i);
  });
});
