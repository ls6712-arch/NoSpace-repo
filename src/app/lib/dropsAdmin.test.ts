import { describe, expect, it } from "vitest";
import { BLANK_DROP, dropProblem, slugify, toLocalInput, type DropInput } from "./dropsAdmin";

const good: DropInput = { title: "Make one, give one", slug: "make-one-give-one", blurb: "", cornerKey: "crafts-making/paper-crafts", targetMoments: 1, opens: "2026-11-24T19:00", closes: "2026-12-06T23:59" };

describe("slugify", () => {
  it("makes a link name the table accepts", () => {
    expect(slugify("Make One, Give One")).toBe("make-one-give-one");
    expect(slugify("  Café crème!  ")).toBe("cafe-creme");
    expect(slugify("x".repeat(80))).toHaveLength(60);
    expect(slugify("Sunrise week: 5 runs")).toMatch(/^[a-z0-9][a-z0-9-]{1,59}$/);
  });
});

describe("dropProblem", () => {
  it("passes a complete drop", () => {
    expect(dropProblem(good)).toBeNull();
  });
  it("names the first thing missing", () => {
    expect(dropProblem(BLANK_DROP)).toBe("Give it a title.");
    expect(dropProblem({ ...good, slug: "Bad Slug" })).toMatch(/link name/);
    expect(dropProblem({ ...good, cornerKey: "" })).toBe("Choose a Corner from the list.");
    expect(dropProblem({ ...good, targetMoments: 0 })).toBe("The goal is 1 to 60 Moments.");
    expect(dropProblem({ ...good, opens: "" })).toBe("Choose when it opens.");
    expect(dropProblem({ ...good, closes: good.opens })).toBe("It has to close after it opens.");
  });
});

describe("toLocalInput", () => {
  it("round-trips a datetime-local value", () => {
    expect(toLocalInput(new Date("2026-11-24T19:00").getTime())).toBe("2026-11-24T19:00");
  });
});
