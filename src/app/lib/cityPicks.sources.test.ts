import { describe, expect, it } from "vitest";
import { bareHost, sourceProblem } from "./cityPicks";

describe("scout sources", () => {
  it("turns a pasted link into a bare site", () => {
    expect(bareHost("https://www.queenslibrary.org/calendar")).toBe("queenslibrary.org");
    expect(bareHost("NYPL.org")).toBe("nypl.org");
    expect(bareHost("  ")).toBe("");
  });
  it("needs a name and what to look for, and real sites", () => {
    const ok = { name: "Queens Library", focus: "free classes", searchDomain: "queenslibrary.org", trustedHost: "" };
    expect(sourceProblem(ok)).toBeNull();
    expect(sourceProblem({ ...ok, name: " " })).toBe("Add a name.");
    expect(sourceProblem({ ...ok, focus: "" })).toBe("Say what to look for.");
    expect(sourceProblem({ ...ok, trustedHost: "not a site" })).toBe("A site is a web address like nypl.org.");
  });
});
