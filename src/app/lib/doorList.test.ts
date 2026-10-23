import { describe, expect, it } from "vitest";
import { doorFor, issueNumber } from "./doorList";

// Oct 2026: the 19th is a Monday.
const at = (day: number, hour: number) => new Date(2026, 9, day, hour);

describe("door list", () => {
  it("counts issues in whole weeks since Sept 1", () => {
    expect(issueNumber(new Date(2026, 8, 1).getTime())).toBe(1);
    expect(issueNumber(new Date(2026, 8, 8).getTime())).toBe(2);
    expect(issueNumber(new Date(2026, 9, 23).getTime())).toBe(8);
  });

  it("picks the greeting and door by local time", () => {
    expect(doorFor(at(19, 10), 5)).toEqual({ greeting: "Got a minute? Pick a door.", mood: "quick" });
    expect(doorFor(at(20, 18), 5)).toEqual({ greeting: "Evening. Pick a door.", mood: "make" });
    expect(doorFor(at(23, 18), 5)).toEqual({ greeting: "Friday night. Pick a door.", mood: "people" });
    expect(doorFor(at(24, 18), 5)).toEqual({ greeting: "Saturday night. Pick a door.", mood: "people" });
    expect(doorFor(at(24, 11), 5)).toEqual({ greeting: "Weekend. Pick a door.", mood: "outside" });
    expect(doorFor(at(25, 11), 5)).toEqual({ greeting: "Weekend. Pick a door.", mood: "outside" });
    expect(doorFor(at(25, 19), 5)).toEqual({ greeting: "Sunday night. Pick a door.", mood: "alone" });
  });

  it("welcomes a viewer with no Moments, whatever the time", () => {
    expect(doorFor(at(24, 18), 0)).toEqual({ greeting: "Welcome in. Pick a door.", mood: "quick" });
  });
});
