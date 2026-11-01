// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_CORNERS } from "../data/curatedCorners";
import { cornerGuide } from "../data/cornerGuides";
import { allSubHobbies } from "../data/hobbies";
import type { Post } from "../data/posts";
import type { HomeItem } from "./homeItems";

const logged = vi.hoisted(() => ({ events: [] as { action: string }[], tracked: [] as { name: string }[] }));
vi.mock("./homeSuggestions", async (orig) => ({
  ...(await orig<typeof import("./homeSuggestions")>()),
  logSuggestionEvent: async (e: { action: string }) => void logged.events.push(e),
}));
vi.mock("./analytics", () => ({ track: (e: { name: string }) => void logged.tracked.push(e) }));

import { openStart, startPathFor } from "./homeActions";
import { hasStartGuide, isAtHomeCorner, startContent, startPath } from "./startContent";
import { addItem, draftKey, gotLine, inviteText, loadDraft, removeItem, saveDraft, seedDraft, toggleItem } from "./startList";
import { defaultPart, plannedLabel, whenToStartsAt } from "./startWhen";
import { inspirationPosts, inspiredPost } from "./startInspiration";

beforeEach(() => {
  logged.events.length = 0;
  logged.tracked.length = 0;
  localStorage.clear();
});

const cooking: HomeItem = {
  id: "at_home:food-cooking/cooking",
  kind: "at_home",
  refId: "food-cooking/cooking",
  title: "Cooking",
  corner: { key: "food-cooking/cooking", name: "Cooking", spaceSlug: "food-cooking", slug: "cooking" },
  spaceSlug: null,
  detail: "At home",
  reasons: ["picked"],
  why: null,
  startsAt: null,
  step: "Pick one recipe.",
  score: null,
};

describe("Start on a Home card", () => {
  it("opens the Start page, never the Log form", () => {
    expect(startPathFor(cooking)).toBe("/start/food-cooking/cooking?ref=home");
    const go = vi.fn();
    openStart(cooking, 2, go);
    expect(go).toHaveBeenCalledWith("/start/food-cooking/cooking?ref=home");
    expect(go.mock.calls[0][0]).not.toContain("/create");
  });

  it("records a start, and no going", () => {
    openStart(cooking, 0, vi.fn());
    expect(logged.tracked.map((t) => t.name)).toEqual(["home_suggestion_start"]);
    expect(logged.tracked.map((t) => t.name)).not.toContain("home_suggestion_going");
  });
});

describe("Start content", () => {
  it("builds the path with the extras", () => {
    expect(startPath("a", "b")).toBe("/start/a/b");
    expect(startPath("a", "b", { plan: "p1", inspired: 7 })).toBe("/start/a/b?plan=p1&inspired=7");
  });

  it("puts the guide step first, then the curated steps, and keeps the curated needs", () => {
    const c = CURATED_CORNERS.find((x) => cornerGuide(x.spaceSlug, x.slug))!;
    const content = startContent(c.spaceSlug, c.slug)!;
    expect(content.steps[0]).toBe(cornerGuide(c.spaceSlug, c.slug)!.step);
    expect(content.needs).toEqual(c.needs);
    expect(content.meta).toContain(`about`);
  });

  it("shows Cooking with its first step, then its prep steps and generic needs", () => {
    const content = startContent("food-cooking", "cooking")!;
    expect(content.steps[0]).toBe(cornerGuide("food-cooking", "cooking")!.step);
    expect(content.steps.length).toBeGreaterThan(1);
    expect(content.needs).toContain("The ingredients for one recipe");
    expect(content.kind).toBe("making");
  });

  it("still gives a page to a Corner with no guide and no steps", () => {
    const bare = allSubHobbies.find((s) => !cornerGuide(s.hobbySlug, s.slug) && !CURATED_CORNERS.some((c) => c.slug === s.slug && c.spaceSlug === s.hobbySlug))!;
    const content = startContent(bare.hobbySlug, bare.slug)!;
    expect(content.name).toBe(bare.label);
    expect(content.steps).toEqual([]);
    expect(content.needs).toEqual([]);
    expect(hasStartGuide(bare.hobbySlug, bare.slug)).toBe(false);
  });

  it("returns null for a Corner the app does not know", () => {
    expect(startContent("nope", "nothing")).toBeNull();
  });

  it("offers Do this and Open only where a guide gives a first step, and Open only at home", () => {
    expect(hasStartGuide("food-cooking", "cooking")).toBe(true);
    expect(isAtHomeCorner("food-cooking", "cooking")).toBe(true);
    expect(isAtHomeCorner("sports-fitness", "running")).toBe(false);
    expect(isAtHomeCorner("sports-fitness", "run-clubs")).toBe(false);
  });
});

describe("The list", () => {
  it("starts from the Corner's needs, then is the person's own, and survives a reload", () => {
    const key = draftKey("u1", "a/b");
    let d = loadDraft(key, ["Pan", "Knife"]);
    expect(d.items.map((i) => i.text)).toEqual(["Pan", "Knife"]);
    d = toggleItem(d, d.items[0].id);
    d = addItem(d, "  Wine ");
    d = removeItem(d, d.items[1].id);
    saveDraft(key, { ...d, dish: "cacio e pepe" });
    const again = loadDraft(key, ["Pan", "Knife"]);
    expect(again.items.map((i) => [i.text, i.got])).toEqual([["Pan", true], ["Wine", false]]);
    expect(again.dish).toBe("cacio e pepe");
    expect(gotLine(again.items)).toBe("1 of 2 got");
  });

  it("does not break when storage throws", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(loadDraft("k", ["Pan"]).items).toHaveLength(1);
    expect(() => saveDraft("k", seedDraft(["Pan"]))).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it("ignores a damaged saved value", () => {
    localStorage.setItem("k", "{not json");
    expect(loadDraft("k", ["Pan"]).items).toHaveLength(1);
  });

  it("writes the invite with the list under it, and nothing under it when the list is empty", () => {
    const items = seedDraft(["Pan", "Knife"]).items;
    expect(inviteText({ name: "Priya", verb: "making", what: "cacio e pepe", when: "Thursday evening", items, needsHeading: "What you’ll need:" })).toBe(
      "Priya is making cacio e pepe Thursday evening. Want in?\n\nWhat you’ll need:\n- Pan\n- Knife",
    );
    expect(inviteText({ name: "", verb: "doing", what: "Drawing", when: null, items: [], needsHeading: "x" })).toBe("I’m doing Drawing. Want in?");
  });
});

describe("When", () => {
  const thursdayNoon = Date.parse("2026-11-05T17:00:00Z"); // Thursday 12 PM in New York
  it("has no time for Now or for nothing chosen", () => {
    expect(whenToStartsAt({ choice: "now", part: "day", now: thursdayNoon })).toBeNull();
    expect(whenToStartsAt({ choice: null, part: "day", now: thursdayNoon })).toBeNull();
  });
  it("puts Tonight at 7 PM, Tomorrow on the next day, and a picked day on that day", () => {
    expect(whenToStartsAt({ choice: "tonight", part: "day", now: thursdayNoon })).toBe(Date.parse("2026-11-06T00:00:00Z"));
    expect(plannedLabel(Date.parse("2026-11-06T00:00:00Z"))).toBe("Thu · Evening");
    expect(whenToStartsAt({ choice: "tomorrow", part: "eve", now: thursdayNoon })).toBe(Date.parse("2026-11-07T00:00:00Z"));
    expect(whenToStartsAt({ choice: "day", part: "day", dayMs: Date.parse("2026-11-09T17:00:00Z"), exact: "08:30", now: thursdayNoon })).toBe(Date.parse("2026-11-09T13:30:00Z"));
    expect(plannedLabel(Date.parse("2026-11-09T13:30:00Z"))).toBe("Mon · 8:30 AM");
  });
  it("pre-chooses Evening late in the day", () => {
    expect(defaultPart(thursdayNoon)).toBe("day");
    expect(defaultPart(Date.parse("2026-11-06T00:00:00Z"))).toBe("eve");
  });
});

const post = (id: number, over: Partial<Post> = {}): Post =>
  ({
    id,
    hobbySlug: "food-cooking",
    corner: "cooking",
    type: "photo",
    media: `https://example.invalid/${id}.jpg`,
    creator: "Sneha K",
    caption: "",
    likes: 0,
    createdAt: id * 1000,
    visibility: "public",
    userId: `u${id}`,
    ...over,
  }) as Post;
const inputs = { meId: "me", followingIds: ["u2"], spacePostIds: new Set<number>(), followedCorners: new Set<string>() };

describe("Made by others", () => {
  it("is empty with no Moments in the Corner", () => {
    expect(inspirationPosts({ posts: [post(1, { corner: "baking" })], cornerKey: "food-cooking/cooking", inputs })).toEqual([]);
    expect(inspirationPosts({ posts: [], cornerKey: "food-cooking/cooking", inputs })).toEqual([]);
  });

  it("puts friends first, then public Moments in the server's order, photos only, newest friend first", () => {
    const posts = [post(1), post(2), post(3), post(4, { type: "written", media: "" }), post(5, { userId: "u2" })];
    const out = inspirationPosts({ posts, cornerKey: "food-cooking/cooking", inputs, discover: [{ postId: 3, authorId: "u3", createdAt: "", cornerKey: "" }, { postId: 1, authorId: "u1", createdAt: "", cornerKey: "" }] });
    expect(out.map((p) => p.id)).toEqual([5, 2, 3, 1]);
  });

  it("never shows a private Moment, a blocked person's Moment, or your own", () => {
    const posts = [post(1, { visibility: "just_me" }), post(2, { visibility: "private" }), post(3, { isPrivateLog: true }), post(4), post(5, { userId: "me" }), post(6)];
    const out = inspirationPosts({ posts, cornerKey: "food-cooking/cooking", inputs, discover: [4, 6].map((postId) => ({ postId, authorId: "x", createdAt: "", cornerKey: "" })), blockedIds: ["u4"] });
    expect(out.map((p) => p.id)).toEqual([6]);
  });

  it("shows at most 12", () => {
    const posts = Array.from({ length: 20 }, (_, i) => post(i + 10, { userId: "u2" }));
    expect(inspirationPosts({ posts, cornerKey: "food-cooking/cooking", inputs })).toHaveLength(12);
  });

  it("ignores ?inspired= when it is unknown, not a number, private, blocked or yours", () => {
    const posts = [post(1), post(2, { visibility: "just_me" }), post(3), post(4, { userId: "me" })];
    expect(inspiredPost("1", posts)?.id).toBe(1);
    expect(inspiredPost("99", posts)).toBeNull();
    expect(inspiredPost("abc", posts)).toBeNull();
    expect(inspiredPost(null, posts)).toBeNull();
    expect(inspiredPost("2", posts)).toBeNull();
    expect(inspiredPost("3", posts, ["u3"])).toBeNull();
    expect(inspiredPost("4", posts, [], "me")).toBeNull();
  });
});
