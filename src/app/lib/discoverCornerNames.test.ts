import { describe, expect, it } from "vitest";
import { nearestSpaceName, soonestPursuitName } from "./discoverCornerNames";
import type { OpenPursuit } from "./openPursuits";

const NOW = Date.parse("2026-11-02T12:00:00Z");
const pursuit = (title: string, startsInHours?: number): OpenPursuit => ({
  pursuitId: title, title, ownerId: "o", ownerName: "O", capacity: 4, taken: 1, people: [],
  session: startsInHours === undefined ? undefined : { id: 1, startsAt: NOW + startsInHours * 3_600_000 },
});

describe("soonestPursuitName", () => {
  it("names the open Pursuit whose next session is soonest", () => {
    expect(soonestPursuitName([pursuit("Later", 48), pursuit("Soonest", 5), pursuit("Middle", 20)], NOW)).toBe("Soonest");
  });

  it("puts one with no upcoming session after any with one, and ignores a session already past", () => {
    expect(soonestPursuitName([pursuit("No session"), pursuit("Has one", 30)], NOW)).toBe("Has one");
    expect(soonestPursuitName([pursuit("Past", -5), pursuit("Next", 3)], NOW)).toBe("Next");
  });

  it("is null when there is none", () => {
    expect(soonestPursuitName([], NOW)).toBeNull();
    expect(soonestPursuitName([pursuit("  ")], NOW)).toBeNull();
  });
});

describe("nearestSpaceName", () => {
  const spaces = [
    { name: "Far Studio", neighborhood: "Harlem", city: "New York" },
    { name: "Kiln House", neighborhood: "Greenpoint", city: "New York" },
    { name: "Austin Clay", neighborhood: "Downtown", city: "Austin" },
  ];

  it("prefers the person's own neighborhood, then their city, then the first listed", () => {
    expect(nearestSpaceName(spaces, { area: "greenpoint", city: "New York" })).toBe("Kiln House");
    expect(nearestSpaceName(spaces, { area: "Astoria", city: "new york" })).toBe("Far Studio");
    expect(nearestSpaceName(spaces, { area: "", city: "Boston" })).toBe("Far Studio");
  });

  it("is null when there are no Spaces", () => {
    expect(nearestSpaceName([], { area: "Greenpoint", city: "New York" })).toBeNull();
  });
});
