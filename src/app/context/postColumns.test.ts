import { describe, expect, it } from "vitest";
import { BASE_POST_COLUMNS, POST_COLUMNS, POST_COLUMNS_WITH_AUDIENCE, POST_COLUMNS_WITH_COUNTS } from "./ContentContext";

describe("posts column tiers", () => {
  it("adds city above audience, so a database without city keeps audience", () => {
    expect(POST_COLUMNS).toBe(`${POST_COLUMNS_WITH_AUDIENCE}, city`);
    expect(POST_COLUMNS_WITH_AUDIENCE).toBe(`${POST_COLUMNS_WITH_COUNTS}, audience`);
    expect(POST_COLUMNS_WITH_AUDIENCE).not.toMatch(/\bcity\b/);
    expect(BASE_POST_COLUMNS).not.toMatch(/\bcity\b|\baudience\b/);
  });
});
