import { describe, expect, it } from "vitest";
import { nyTimeToMs } from "./homeWeek";
import { parseNyLocal, pickPill, pickProblem, toNyLocal, visiblePicks, type CityPick, type PickInput } from "./cityPicks";

const ny = (m: number, d: number, h: number, min = 0) => nyTimeToMs(2026, m, d, h) + min * 60_000;
const pick = (over: Partial<CityPick> = {}): CityPick => ({
  id: 1, title: "Halloween parade", place: "Sixth Avenue", startsAt: ny(10, 31, 19), endsAt: null, price: "free", url: null, cornerKey: null, color: "orange", published: true, ...over,
});

describe("visiblePicks", () => {
  const from = ny(10, 30, 12);
  const to = ny(11, 6, 12);

  it("keeps published picks that overlap the 7 days, soonest first", () => {
    const list = [pick({ id: 3, startsAt: ny(11, 3, 10) }), pick({ id: 1, startsAt: ny(10, 31, 19) }), pick({ id: 2, startsAt: ny(11, 1, 9) })];
    expect(visiblePicks(list, from, to).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("leaves out drafts, past picks and picks after the week", () => {
    const list = [
      pick({ id: 1, published: false }),
      pick({ id: 2, startsAt: ny(10, 29, 10) }),
      pick({ id: 3, startsAt: ny(11, 6, 13) }),
      pick({ id: 4, startsAt: ny(11, 2, 10) }),
    ];
    expect(visiblePicks(list, from, to).map((p) => p.id)).toEqual([4]);
  });

  it("keeps a pick that began before now but has not ended (the marathon)", () => {
    const marathon = pick({ id: 7, startsAt: ny(10, 30, 8), endsAt: ny(10, 30, 18) });
    expect(visiblePicks([marathon], from, to)).toHaveLength(1);
    expect(visiblePicks([pick({ id: 8, startsAt: ny(10, 30, 8), endsAt: ny(10, 30, 10) })], from, to)).toHaveLength(0);
  });

  it("treats a pick with no end as lasting 3 hours, so it stays up after it starts", () => {
    const evening = pick({ id: 5, startsAt: ny(10, 30, 19), endsAt: null });
    expect(visiblePicks([evening], ny(10, 30, 20), to)).toHaveLength(1);
    expect(visiblePicks([evening], ny(10, 30, 21, 59), to)).toHaveLength(1);
    expect(visiblePicks([evening], ny(10, 30, 22, 1), to)).toHaveLength(0);
    // A real end still wins over the default.
    expect(visiblePicks([pick({ id: 6, startsAt: ny(10, 30, 19), endsAt: ny(10, 30, 20) })], ny(10, 30, 21), to)).toHaveLength(0);
  });

  it("shows at most 6", () => {
    const many = Array.from({ length: 9 }, (_, i) => pick({ id: i + 1, startsAt: ny(11, 1, 9 + i) }));
    expect(visiblePicks(many, from, to).map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("is empty with no picks, so the row is hidden", () => {
    expect(visiblePicks([], from, to)).toEqual([]);
  });
});

describe("pickPill", () => {
  it("reads day, time and the editor's price", () => {
    expect(pickPill(pick())).toBe("Sat 31 · 7 PM · free");
    expect(pickPill(pick({ startsAt: ny(11, 1, 9), price: "$25" }))).toBe("Sun 1 · 9 AM · $25");
  });
  it("leaves the price part out when there is none", () => {
    expect(pickPill(pick({ price: null }))).toBe("Sat 31 · 7 PM");
    expect(pickPill(pick({ price: "  " }))).toBe("Sat 31 · 7 PM");
  });
});

describe("the editor's form", () => {
  const ok: PickInput = { title: "Marathon", place: "", starts: "2026-11-01T09:30", ends: "", price: "", url: "", cornerId: null, color: "lime" };

  it("reads a New York time and shows it back the same, across the Nov 1 clock change", () => {
    expect(parseNyLocal("2026-10-31T19:00")).toBe(ny(10, 31, 19));
    expect(parseNyLocal("2026-11-01T09:30")).toBe(ny(11, 1, 9) + 30 * 60_000);
    for (const t of ["2026-10-31T19:00", "2026-11-01T09:30", "2026-11-01T00:15", "2026-11-02T23:45"]) expect(toNyLocal(parseNyLocal(t))).toBe(t);
    expect(parseNyLocal("")).toBeNaN();
  });

  it("accepts a good pick and names what is wrong with a bad one", () => {
    expect(pickProblem(ok)).toBeNull();
    expect(pickProblem({ ...ok, title: "  " })).toBe("Add a title.");
    expect(pickProblem({ ...ok, title: "x".repeat(81) })).toMatch(/80/);
    expect(pickProblem({ ...ok, starts: "" })).toBe("Add a start time.");
    expect(pickProblem({ ...ok, ends: "2026-11-01T08:00" })).toMatch(/before the start/);
    expect(pickProblem({ ...ok, url: "http://example.com" })).toMatch(/https/);
    expect(pickProblem({ ...ok, url: "https://example.com/race" })).toBeNull();
  });
});
