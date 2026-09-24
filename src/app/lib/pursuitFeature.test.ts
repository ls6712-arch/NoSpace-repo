import { describe, expect, it } from "vitest";
import { Post } from "../data/posts";
import { Project, checkInDue, pursuitStatus } from "./journal";
import {
  activePursuits,
  collectPursuitMoments,
  firstAndLatestPhoto,
  groupByMonth,
  startedLabel,
} from "./pursuitTrail";

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 23, 12).getTime(); // Sep 23 2026, noon

const project = (o: Partial<Project> = {}): Project => ({ id: "p1", title: "Learn watercolor", startedAt: NOW, ...o });
const post = (o: Partial<Post> & { id: number; createdAt: number }): Post => ({
  hobbySlug: "art",
  type: "photo",
  media: `img-${o.id}`,
  creator: "Sush",
  caption: `caption ${o.id}`,
  likes: 0,
  visibility: "followers",
  ...o,
});

describe("startedLabel — one wording everywhere", () => {
  it("says today for a Pursuit started today", () => {
    expect(startedLabel(NOW - 60_000, NOW)).toBe("Started today");
  });
  it("says yesterday across midnight", () => {
    expect(startedLabel(new Date(2026, 8, 22, 23, 50).getTime(), NOW)).toBe("Started yesterday");
  });
  it("uses a short date after that, with the year only when it differs", () => {
    expect(startedLabel(new Date(2026, 8, 3).getTime(), NOW)).not.toMatch(/2026/);
    expect(startedLabel(new Date(2025, 8, 3).getTime(), NOW)).toMatch(/2025/);
  });
});

describe("activePursuits — the My Space bug", () => {
  it("includes a brand-new Pursuit with no Moments", () => {
    const list = activePursuits([project()], () => []);
    expect(list.map((p) => p.id)).toEqual(["p1"]);
  });
  it("leaves out resting and complete ones", () => {
    const list = activePursuits(
      [project(), project({ id: "rest", pausedAt: NOW }), project({ id: "done", finishedAt: NOW })],
      () => [],
    );
    expect(list.map((p) => p.id)).toEqual(["p1"]);
  });
  it("puts the most recently touched first", () => {
    const old = project({ id: "old", startedAt: NOW - 30 * DAY });
    const fresh = project({ id: "fresh", startedAt: NOW - 40 * DAY });
    const list = activePursuits([old, fresh], (p) => (p.id === "fresh" ? [{ createdAt: NOW - DAY }] : []));
    expect(list.map((p) => p.id)).toEqual(["fresh", "old"]);
  });
});

describe("pursuitStatus", () => {
  it("derives active / resting / complete", () => {
    expect(pursuitStatus({})).toBe("active");
    expect(pursuitStatus({ pausedAt: 1 })).toBe("resting");
    expect(pursuitStatus({ finishedAt: 1, pausedAt: 1 })).toBe("complete");
  });
});

describe("checkInDue — only on the maker's own cadence", () => {
  it("is not due before the interval", () => {
    expect(checkInDue(project({ startedAt: NOW - 10 * DAY }), undefined, NOW)).toBe(false);
  });
  it("is due after the default two weeks of quiet", () => {
    expect(checkInDue(project({ startedAt: NOW - 15 * DAY }), undefined, NOW)).toBe(true);
  });
  it("respects a weekly cadence", () => {
    expect(checkInDue(project({ startedAt: NOW - 8 * DAY, checkInDays: 7 }), undefined, NOW)).toBe(true);
  });
  it("never asks when set to never", () => {
    expect(checkInDue(project({ startedAt: NOW - 400 * DAY, checkInDays: 0 }), undefined, NOW)).toBe(false);
  });
  it("counts from the latest Moment", () => {
    expect(checkInDue(project({ startedAt: NOW - 30 * DAY }), NOW - 3 * DAY, NOW)).toBe(false);
  });
  it("stops after two unanswered check-ins", () => {
    expect(checkInDue(project({ startedAt: NOW - 90 * DAY, checkInsIgnored: 2 }), undefined, NOW)).toBe(false);
  });
  it("never asks a resting Pursuit", () => {
    expect(checkInDue(project({ startedAt: NOW - 90 * DAY, pausedAt: NOW - 60 * DAY }), undefined, NOW)).toBe(false);
  });
});

describe("Moments on a Pursuit", () => {
  const posts = [
    post({ id: 1, createdAt: new Date(2026, 7, 2).getTime(), pursuitId: "p1" }),
    post({ id: 2, createdAt: new Date(2026, 8, 5).getTime(), pursuitId: "p1", type: "written" }),
    post({ id: 3, createdAt: new Date(2026, 8, 20).getTime(), pursuitId: "p1" }),
    post({ id: 4, createdAt: new Date(2026, 8, 21).getTime(), pursuitId: "other" }),
  ];
  const logs = [{ id: 9, note: "private note", projectId: "p1", createdAt: new Date(2026, 8, 10).getTime() }];

  it("merges posts and the owner's private entries, oldest first", () => {
    const m = collectPursuitMoments("p1", posts, {}, logs);
    expect(m.map((x) => x.key)).toEqual(["post-1", "post-2", "log-9", "post-3"]);
    expect(m.find((x) => x.key === "log-9")!.private).toBe(true);
  });

  it("never treats a dead blob: URL as a kept photo", () => {
    const m = collectPursuitMoments("p1", [], {}, [{ ...logs[0], media: "blob:abc", mediaType: "image" as const }]);
    expect(m[0].image).toBeUndefined();
  });

  it("finds the first and latest photo, skipping written Moments", () => {
    const pair = firstAndLatestPhoto(collectPursuitMoments("p1", posts, {}, logs))!;
    expect(pair.first.key).toBe("post-1");
    expect(pair.latest!.key).toBe("post-3");
  });

  it("has no latest when there's only one photo", () => {
    const pair = firstAndLatestPhoto(collectPursuitMoments("p1", [posts[0]], {}))!;
    expect(pair.latest).toBeUndefined();
  });

  it("groups by month, newest month first", () => {
    const months = groupByMonth(collectPursuitMoments("p1", posts, {}, logs));
    expect(months.map((g) => g.key)).toEqual(["2026-09", "2026-08"]);
    expect(months[0].moments[0].key).toBe("post-3");
  });
});

import { guessSpace, localDateMs, toDateInput, unitFor } from "./pursuitProgress";

describe("fixes from the Sep 23 test pass", () => {
  it("keeps a picked deadline on the picked day (no time-zone shift)", () => {
    const ms = localDateMs("2026-12-31")!;
    const d = new Date(ms);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
    expect(toDateInput(ms)).toBe("2026-12-31");
  });
  it("guesses a sensible Space from the goal text", () => {
    expect(guessSpace("Learn watercolor")).toBe("art-creative");
    expect(guessSpace("Write 20,000 words")).toBe("books-writing");
    expect(guessSpace("Practice guitar 20 hours")).toBe("music");
    expect(guessSpace("Something else entirely")).toBeUndefined();
  });
  it("uses the singular unit for one", () => {
    const m = { kind: "count", target: 20, unit: "paintings", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 } as const;
    expect(unitFor(m, 1)).toBe("painting");
    expect(unitFor(m, 5)).toBe("paintings");
  });
});
