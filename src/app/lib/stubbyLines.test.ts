import { describe, expect, it } from "vitest";
import { nyTimeToMs } from "./homeWeek";
import { MAX_LINE_WORDS, STUBBY_LINES, cutTitle, greetingLine } from "./stubbyLines";

// Fixed clock: Sunday Nov 1, 2026, 5:00 pm New York.
const NOW = nyTimeToMs(2026, 11, 1, 17);
const at = (d: number, h: number) => nyTimeToMs(2026, 11, d, h);

describe("greetingLine", () => {
  it("a free evening later today: from when it starts", () => {
    expect(greetingLine({ now: NOW, windows: ["sun-eve"], plans: [], asksLeft: 3 })).toBe("You’re free tonight from 6. Want ideas?");
  });

  it("already in the free evening: from the next half hour", () => {
    expect(greetingLine({ now: at(1, 18) + 10 * 60_000, windows: ["sun-eve"], plans: [], asksLeft: 3 })).toBe("You’re free tonight from 6:30. Want ideas?");
  });

  it("a plan tonight: its title and time, and it wins over the free evening", () => {
    const plans = [{ title: "Pottery", startsAt: at(1, 19) }];
    expect(greetingLine({ now: NOW, windows: ["sun-eve"], plans, asksLeft: 3 })).toBe("Pottery at 7 tonight. Want something after?");
  });

  it("cuts a long plan title to fit", () => {
    const plans = [{ title: "Beginner wheel throwing for absolute beginners and friends", startsAt: at(1, 19) }];
    const line = greetingLine({ now: NOW, windows: [], plans, asksLeft: 3 });
    expect(line).toBe("Beginner wheel throwing for… at 7 tonight. Want something after?");
    expect(line.split(" ").length).toBeLessThanOrEqual(MAX_LINE_WORDS);
  });

  it("an open weekend with nothing planned", () => {
    expect(greetingLine({ now: NOW, windows: ["sun-day", "tue-eve"], plans: [], asksLeft: 3 })).toBe("Your weekend’s open. Want ideas?");
    // On a Friday, Saturday counts.
    expect(greetingLine({ now: nyTimeToMs(2026, 10, 30, 10), windows: ["sat-day"], plans: [], asksLeft: 3 })).toBe("Your weekend’s open. Want ideas?");
  });

  it("not an open weekend once something is planned on it", () => {
    const plans = [{ title: "Climbing", startsAt: nyTimeToMs(2026, 10, 31, 10) }];
    expect(greetingLine({ now: nyTimeToMs(2026, 10, 30, 10), windows: ["sat-day"], plans, asksLeft: 3 })).toBe("Busy week! Want something for next week?");
  });

  it("a busy week: every free window left has a plan in it", () => {
    const plans = [{ title: "Climbing", startsAt: at(2, 19) }];
    expect(greetingLine({ now: NOW, windows: ["mon-eve"], plans, asksLeft: 3 })).toBe("Busy week! Want something for next week?");
  });

  it("falls back when there is no free time to talk about", () => {
    expect(greetingLine({ now: NOW, windows: [], plans: [], asksLeft: 3 })).toBe("What are you in the mood for?");
    expect(greetingLine({ now: NOW, windows: ["mon-eve"], plans: [], asksLeft: null })).toBe("What are you in the mood for?");
  });

  it("at 0 asks left, says so before anything else", () => {
    expect(greetingLine({ now: NOW, windows: ["sun-eve"], plans: [{ title: "Pottery", startsAt: at(1, 19) }], asksLeft: 0 })).toBe("That’s 3 for today. I’ll look again tomorrow.");
  });
});

describe("Stubby's lines", () => {
  it("are 12 words at most, with no dashes", () => {
    const lines = Object.values(STUBBY_LINES).map((l) => (typeof l === "function" ? l("7", "7") : l));
    for (const l of lines) {
      expect(l.split(/\s+/).length).toBeLessThanOrEqual(MAX_LINE_WORDS);
      expect(l).not.toMatch(/[–—]/);
    }
  });

  it("cutTitle leaves a short title alone", () => {
    expect(cutTitle("  Pottery   night ")).toBe("Pottery night");
  });
});
