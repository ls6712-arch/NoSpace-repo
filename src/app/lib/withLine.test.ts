import { describe, expect, it } from "vitest";
import { withLine } from "./withLine";

describe("withLine", () => {
  it("reads as a list", () => {
    expect(withLine([])).toBe("");
    expect(withLine(["Priya"])).toBe("With Priya");
    expect(withLine(["Priya", "Sneha"])).toBe("With Priya and Sneha");
    expect(withLine(["Priya", "Sneha", "Arjun"])).toBe("With Priya, Sneha and Arjun");
    expect(withLine(["Priya", "Sneha", "Arjun", "Dev"])).toBe("With Priya, Sneha and others");
  });
});
