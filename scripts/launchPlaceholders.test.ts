import { describe, expect, it } from "vitest";
import { findPlaceholdersInSource } from "./launchPlaceholders";

describe("findPlaceholdersInSource", () => {
  it("finds the example.com address and PLACEHOLDER lines in shipped strings", () => {
    const src = 'const a = "mailto:hello@example.com";\nconst b = "[PLACEHOLDER: draft]";';
    expect(findPlaceholdersInSource("x.tsx", src).map((h) => h.line)).toEqual([1, 2]);
  });
  it("ignores comments", () => {
    const src = "// contact hello@example.com later\n/* [PLACEHOLDER */\nconst ok = 1;";
    expect(findPlaceholdersInSource("x.tsx", src)).toEqual([]);
  });
  it("does not treat a URL as a comment", () => {
    expect(findPlaceholdersInSource("x.tsx", 'const u = "https://example.com";')).toHaveLength(1);
  });
});
