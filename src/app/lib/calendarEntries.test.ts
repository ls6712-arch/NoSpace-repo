import { describe, expect, it } from "vitest";
import { blockOccurrences, effectiveFreeTime, occurrences, subtractSpans, type CalendarEntry } from "./calendarEntries";
import { nyParts, nyTimeToMs } from "./homeWeek";
import type { WeekPlanDetail } from "./weekView";

const ny = (m: number, d: number, h: number, y = 2026) => nyTimeToMs(y, m, d, h);
const HOUR = 3_600_000;
let id = 0;
const entry = (over: Partial<CalendarEntry> & Pick<CalendarEntry, "kind" | "startsAt" | "endsAt">): CalendarEntry => ({ id: ++id, repeat: "none", ...over });
const plan = (startsAt: number, endsAt: number): WeekPlanDetail => ({ id: `event-${++id}`, kind: "event", title: "Plan", startsAt, endsAt, color: "blue", going: { friends: [], total: 1 } });
const free = (over: Partial<Parameters<typeof effectiveFreeTime>[0]> = {}) =>
  effectiveFreeTime({ windows: [], entries: [], plans: [], fromMs: ny(11, 2, 0), toMs: ny(11, 9, 0), ...over });
const hm = (s: { startMs: number; endMs: number }) => [s.startMs, s.endMs];

describe("subtractSpans", () => {
  it("cuts the middle, the ends and everything, and ignores what does not touch", () => {
    const from = [{ startMs: 10, endMs: 20 }];
    expect(subtractSpans(from, [{ startMs: 14, endMs: 16 }])).toEqual([{ startMs: 10, endMs: 14 }, { startMs: 16, endMs: 20 }]);
    expect(subtractSpans(from, [{ startMs: 5, endMs: 12 }])).toEqual([{ startMs: 12, endMs: 20 }]);
    expect(subtractSpans(from, [{ startMs: 18, endMs: 30 }])).toEqual([{ startMs: 10, endMs: 18 }]);
    expect(subtractSpans(from, [{ startMs: 0, endMs: 30 }])).toEqual([]);
    expect(subtractSpans(from, [{ startMs: 20, endMs: 30 }])).toEqual(from);
  });
});

describe("effectiveFreeTime", () => {
  it("is the usual week when nothing changes it", () => {
    // Mon Nov 2: daytime 6 AM to 6 PM, and Tue evening 6 PM to midnight.
    const got = free({ windows: ["mon-day", "tue-eve"] });
    expect(got.map(hm)).toEqual([[ny(11, 2, 6), ny(11, 2, 18)], [ny(11, 3, 18), ny(11, 4, 0)]]);
  });

  it("merges a usual daytime and the evening after it into one stretch", () => {
    expect(free({ windows: ["mon-day", "mon-eve"] }).map(hm)).toEqual([[ny(11, 2, 6), ny(11, 3, 0)]]);
  });

  it("adds a free entry, once, and does not repeat it", () => {
    const e = entry({ kind: "free", startsAt: ny(11, 4, 19), endsAt: ny(11, 4, 22) });
    expect(free({ entries: [e] }).map(hm)).toEqual([[ny(11, 4, 19), ny(11, 4, 22)]]);
    expect(free({ entries: [e], fromMs: ny(11, 5, 0), toMs: ny(11, 12, 0) })).toEqual([]);
  });

  it("repeats a weekly free entry on the same weekday", () => {
    const e = entry({ kind: "free", startsAt: ny(11, 4, 19), endsAt: ny(11, 4, 22), repeat: "weekly" });
    expect(free({ entries: [e], fromMs: ny(11, 9, 0), toMs: ny(11, 24, 0) }).map(hm)).toEqual([
      [ny(11, 11, 19), ny(11, 11, 22)],
      [ny(11, 18, 19), ny(11, 18, 22)],
    ]);
  });

  it("does not repeat a weekly entry backwards, before its first date", () => {
    const e = entry({ kind: "free", startsAt: ny(11, 11, 19), endsAt: ny(11, 11, 22), repeat: "weekly" });
    expect(free({ entries: [e], fromMs: ny(11, 2, 0), toMs: ny(11, 10, 0) })).toEqual([]);
  });

  it("takes a one-off busy entry out of the usual week and nothing else", () => {
    const busy = entry({ kind: "busy", startsAt: ny(11, 3, 18), endsAt: ny(11, 4, 0) });
    const got = free({ windows: ["tue-eve", "wed-eve"], entries: [busy] });
    expect(got.map(hm)).toEqual([[ny(11, 4, 18), ny(11, 5, 0)]]);
    // The week after is untouched.
    expect(free({ windows: ["tue-eve"], entries: [busy], fromMs: ny(11, 9, 0), toMs: ny(11, 16, 0) }).map(hm)).toEqual([[ny(11, 10, 18), ny(11, 11, 0)]]);
  });

  it("takes a block out of the middle of free time", () => {
    const block = entry({ kind: "block", startsAt: ny(11, 2, 12), endsAt: ny(11, 2, 14), note: "dentist" });
    expect(free({ windows: ["mon-day"], entries: [block] }).map(hm)).toEqual([[ny(11, 2, 6), ny(11, 2, 12)], [ny(11, 2, 14), ny(11, 2, 18)]]);
  });

  it("takes a plan out of free time, with its own end or 2 hours when it has none", () => {
    const p = plan(ny(11, 3, 19), ny(11, 3, 21));
    expect(free({ windows: ["tue-eve"], plans: [p] }).map(hm)).toEqual([[ny(11, 3, 18), ny(11, 3, 19)], [ny(11, 3, 21), ny(11, 4, 0)]]);
    const open = { ...plan(ny(11, 3, 19), 0), endsAt: null };
    expect(free({ windows: ["tue-eve"], plans: [open] }).map(hm)).toEqual([[ny(11, 3, 18), ny(11, 3, 19)], [ny(11, 3, 21), ny(11, 4, 0)]]);
  });

  it("takes busy times from elsewhere out, and never makes free time from them", () => {
    const got = free({ windows: ["mon-day"], busy: [{ startMs: ny(11, 2, 9), endMs: ny(11, 2, 17) }] });
    expect(got.map(hm)).toEqual([[ny(11, 2, 6), ny(11, 2, 9)], [ny(11, 2, 17), ny(11, 2, 18)]]);
    expect(free({ busy: [{ startMs: ny(11, 2, 9), endMs: ny(11, 2, 17) }] })).toEqual([]);
  });

  it("stays out of a block that covers all of it, even a weekly one", () => {
    const block = entry({ kind: "block", startsAt: ny(10, 26, 6), endsAt: ny(10, 26, 18), repeat: "weekly" });
    expect(free({ windows: ["mon-day"], entries: [block] })).toEqual([]);
  });

  it("clips to the range asked for", () => {
    expect(free({ windows: ["mon-day"], fromMs: ny(11, 2, 12), toMs: ny(11, 2, 15) }).map(hm)).toEqual([[ny(11, 2, 12), ny(11, 2, 15)]]);
  });

  it("lets a free entry cross midnight", () => {
    const e = entry({ kind: "free", startsAt: ny(11, 3, 22), endsAt: ny(11, 4, 2) });
    expect(free({ entries: [e] }).map(hm)).toEqual([[ny(11, 3, 22), ny(11, 4, 2)]]);
    // Asked about only the second day, the part after midnight is there.
    expect(free({ entries: [e], fromMs: ny(11, 4, 0), toMs: ny(11, 5, 0) }).map(hm)).toEqual([[ny(11, 4, 0), ny(11, 4, 2)]]);
  });

  it("lets a block cross midnight and cuts the next day's free time", () => {
    const block = entry({ kind: "block", startsAt: ny(11, 2, 23), endsAt: ny(11, 3, 7) });
    expect(free({ windows: ["mon-eve", "tue-day"], entries: [block] }).map(hm)).toEqual([[ny(11, 2, 18), ny(11, 2, 23)], [ny(11, 3, 7), ny(11, 3, 18)]]);
  });

  it("keeps the usual week's clock time across the change on Nov 1", () => {
    // Sunday Nov 1 is 25 hours long: the evening is still 6 PM to midnight New York time.
    const got = free({ windows: ["sun-eve"], fromMs: ny(10, 31, 0), toMs: ny(11, 2, 0) });
    expect(got.map(hm)).toEqual([[ny(11, 1, 18), ny(11, 2, 0)]]);
    expect(nyParts(got[0].startMs).hour).toBe(18);
  });
});

describe("weekly entries and the clock change", () => {
  it("repeats at the same New York clock time before and after Nov 1", () => {
    const sat = entry({ kind: "block", startsAt: ny(10, 31, 9), endsAt: ny(10, 31, 10), repeat: "weekly" });
    const o = occurrences(sat, ny(10, 30, 0), ny(11, 15, 0));
    expect(o.map((x) => [x.startMs, x.endMs])).toEqual([
      [ny(10, 31, 9), ny(10, 31, 10)],
      [ny(11, 7, 9), ny(11, 7, 10)],
      [ny(11, 14, 9), ny(11, 14, 10)],
    ]);
    expect(nyParts(o[1].startMs).hour).toBe(9);
    // An hour apart in real time: the second week is 7 days plus the extra hour of Nov 1.
    expect(o[1].startMs - o[0].startMs).toBe(7 * 24 * HOUR + HOUR);
  });

  it("keeps a half hour start", () => {
    const e = entry({ kind: "block", startsAt: ny(10, 31, 9) + 30 * 60_000, endsAt: ny(10, 31, 10) + 30 * 60_000, repeat: "weekly" });
    expect(occurrences(e, ny(11, 7, 0), ny(11, 8, 0)).map((x) => x.startMs)).toEqual([ny(11, 7, 9) + 30 * 60_000]);
  });

  it("keeps the length of an entry that crosses midnight", () => {
    const e = entry({ kind: "block", startsAt: ny(10, 30, 23), endsAt: ny(10, 31, 2), repeat: "weekly" });
    const o = occurrences(e, ny(11, 6, 0), ny(11, 8, 0));
    expect(o).toHaveLength(1);
    expect(o[0].endMs - o[0].startMs).toBe(3 * HOUR);
    expect(o[0].startMs).toBe(ny(11, 6, 23));
  });

  it("finds an occurrence that began before the range and runs into it", () => {
    const e = entry({ kind: "block", startsAt: ny(10, 30, 23), endsAt: ny(10, 31, 2), repeat: "weekly" });
    expect(occurrences(e, ny(11, 7, 0), ny(11, 7, 1))).toHaveLength(1);
  });

  it("returns nothing for a one-off outside the range and for a broken entry", () => {
    expect(occurrences(entry({ kind: "block", startsAt: ny(11, 2, 9), endsAt: ny(11, 2, 10) }), ny(11, 3, 0), ny(11, 4, 0))).toEqual([]);
    expect(occurrences(entry({ kind: "block", startsAt: ny(11, 2, 10), endsAt: ny(11, 2, 9) }), ny(11, 1, 0), ny(11, 4, 0))).toEqual([]);
  });

  it("lists only blocks, soonest first", () => {
    const a = entry({ kind: "block", startsAt: ny(11, 4, 9), endsAt: ny(11, 4, 10) });
    const b = entry({ kind: "block", startsAt: ny(11, 2, 9), endsAt: ny(11, 2, 10) });
    const c = entry({ kind: "free", startsAt: ny(11, 3, 9), endsAt: ny(11, 3, 10) });
    expect(blockOccurrences([a, b, c], ny(11, 1, 0), ny(11, 9, 0)).map((o) => o.entry.id)).toEqual([b.id, a.id]);
  });
});
