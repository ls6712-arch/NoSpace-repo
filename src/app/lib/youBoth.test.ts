import { describe, expect, it } from "vitest";
import { joinNaturally, youBothSentence } from "./youBoth";

describe("youBothSentence", () => {
  it("is null with nothing shared", () => {
    expect(youBothSentence([])).toBeNull();
  });
  it("joins one, two and three names naturally", () => {
    expect(youBothSentence(["Climbing"])).toBe("Climbing.");
    expect(youBothSentence(["Climbing", "Pottery"])).toBe("Climbing and Pottery.");
    expect(joinNaturally(["A", "B", "C"])).toBe("A, B and C");
  });
  it("uses the names as given and skips blanks", () => {
    expect(youBothSentence([" Board games ", ""])).toBe("Board games.");
  });
});
