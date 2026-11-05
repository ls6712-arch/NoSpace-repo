import { describe, expect, it } from "vitest";
import {
  weeklyHours,
  matchingHours,
  parseWeeklyHours,
} from "../../../supabase/functions/_shared/weeklyHours";
import { copyHours, draftWindows, hourDrafts } from "./weeklyHours";
import { nyTimeToMs, windowsLeft, weekChips } from "./homeWeek";
import { calendarDays } from "./calendarView";
import { effectiveFreeTime } from "./calendarEntries";
import { weekDays, windowsAcross } from "./weekView";
const ny = (m: number, d: number, h: number, min = 0) =>
  nyTimeToMs(2026, m, d, h) + min * 60_000;
describe("exact usual hours", () => {
  it("reads old choices without pretending they were exact answers", () => {
    expect(parseWeeklyHours("mon-day")).toMatchObject({
      start: 360,
      end: 1080,
      legacy: true,
    });
    expect(hourDrafts(["mon-day"])[0]).toMatchObject({
      day: "mon",
      from: "06:00",
      to: "18:00",
    });
    expect(draftWindows(hourDrafts(["mon-day"]))).toEqual({
      windows: ["mon@360-1080"],
      error: null,
    });
  });
  it("retains split days and orders exact ranges", () => {
    expect(
      weeklyHours(["wed@1080-1200", "mon@1140-1260", "wed@720-780"]).map(
        (r) => r.key,
      ),
    ).toEqual(["mon@1140-1260", "wed@720-780", "wed@1080-1200"]);
    expect(
      weeklyHours([
        "mon@-1-20",
        "mon@0-1441",
        "mon@20-20",
        "bad",
        "mon@001-20",
      ]),
    ).toEqual([]);
  });
  it("validates overlaps and keeps adjacent hours and midnight", () => {
    const ranges = hourDrafts(["mon@1140-1260", "mon@1200-1320"]);
    expect(draftWindows(ranges).error).toMatch(/overlap/);
    expect(
      draftWindows(
        hourDrafts(["mon@1140-1200", "mon@1200-1260", "sun@1380-1440"]),
      ).error,
    ).toBeNull();
    expect(
      draftWindows([{ id: "a", day: "mon", from: "22:00", to: "02:00" }]).error,
    ).toMatch(/end time after/);
  });
  it("copies additively, merges overlap, and never touches other days", () => {
    const result = copyHours(
      hourDrafts([
        "mon@1140-1260",
        "tue@1200-1320",
        "tue@600-660",
        "fri@720-780",
      ]),
      "mon",
      ["tue"],
    );
    expect(draftWindows(result).windows).toEqual([
      "mon@1140-1260",
      "tue@600-660",
      "tue@1140-1320",
      "fri@720-780",
    ]);
  });
  it("matches the actual interval, including its exclusive end", () => {
    const hours = ["mon@1140-1260"];
    expect(matchingHours(hours, ny(11, 9, 19), ny(11, 9, 21))).toBe(hours[0]);
    expect(matchingHours(hours, ny(11, 9, 18, 59))).toBeNull();
    expect(matchingHours(hours, ny(11, 9, 21))).toBeNull();
    expect(matchingHours(hours, ny(11, 9, 20), ny(11, 9, 21, 1))).toBeNull();
    expect(matchingHours(hours, ny(11, 10, 19))).toBeNull();
  });
  it("keeps Calendar hours in its stated timezone when recommendation preferences differ", () => {
    const at = ny(11, 9, 19);
    expect(matchingHours(["mon@1140-1260"], at, at + 1, "Europe/London")).toBe(
      "mon@1140-1260",
    );
    expect(
      windowsLeft(["mon@1140-1260"], ny(11, 9, 0), "Europe/London")[0].startMs,
    ).toBe(at);
  });
  it("keeps wall times across DST and skips a nonexistent occurrence", () => {
    const from = ny(10, 31, 0);
    const got = windowsAcross(["sun@1140-1260"], weekDays(from, 10), 0);
    expect(got.map((r) => [r.startMs, r.endMs])).toEqual([
      [ny(11, 1, 19), ny(11, 1, 21)],
      [ny(11, 8, 19), ny(11, 8, 21)],
    ]);
    expect(windowsAcross(["sun@150-210"], weekDays(ny(3, 8, 0), 1), 0)).toEqual(
      [],
    );
    expect(windowsLeft(["sun@1140-1260"], ny(11, 1, 0))[0].startMs).toBe(
      ny(11, 1, 19),
    );
    expect(matchingHours(["sun@150-210"], ny(3, 8, 3))).toBeNull();
    expect(matchingHours(["sun@60-90"], ny(11, 1, 1, 15))).toBe("sun@60-90");
    expect(matchingHours(["sun@60-90"], ny(11, 1, 1, 15) + 3600000)).toBeNull();
  });
  it("subtracts plans and blocks without expanding the saved hours", () => {
    const spans = effectiveFreeTime({
      windows: ["mon@1140-1260"],
      entries: [
        {
          id: 1,
          kind: "block",
          repeat: "none",
          startsAt: ny(11, 9, 19, 30),
          endsAt: ny(11, 9, 20),
        },
      ],
      plans: [],
      fromMs: ny(11, 9, 0),
      toMs: ny(11, 10, 0),
    });
    expect(spans).toEqual([
      { startMs: ny(11, 9, 19), endMs: ny(11, 9, 19, 30) },
      { startMs: ny(11, 9, 20), endMs: ny(11, 9, 21) },
    ]);
    const days = calendarDays(
      weekDays(ny(11, 9, 0), 1),
      [],
      [],
      ["mon@1140-1170"],
      ny(11, 8, 0),
    );
    expect(days[0].free.map((s) => [s.startMs, s.endMs])).toEqual([
      [ny(11, 9, 19), ny(11, 9, 19, 30)],
    ]);
    const split = calendarDays(
      weekDays(ny(11, 9, 0), 1),
      [],
      [],
      ["mon@1080-1140", "mon@1200-1260"],
      ny(11, 8, 0),
    )[0].free;
    expect(new Set(split.map((s) => s.slotKey)).size).toBe(2);
  });
  it("does not call two short ranges free all day", () => {
    expect(
      weekChips(["mon@600-660", "mon@1140-1200"], [], ny(11, 9, 0))[0].line,
    ).toContain("10 AM to 11 AM");
    expect(
      weekChips(["mon@600-660", "mon@1140-1200"], [], ny(11, 9, 0))[0].line,
    ).not.toContain("all day");
  });
});
