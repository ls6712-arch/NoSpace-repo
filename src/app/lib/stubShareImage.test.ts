import { describe, expect, it } from "vitest";
import { STORY } from "./recapImage";
import { sharePalette, stubShareLayout, stubShareLines, wrapLines } from "./stubShareImage";
import type { StubFace } from "./stubFace";

const dropStub: StubFace = { kind: "drop", title: "Make one, give one", color: "var(--cat-orange)", day: "Nov 25", edition: 7, palette: ["#ff7ab6", "#ffd36e"] };

describe("stubShareLayout", () => {
  it("keeps the ticket, the name and the mark inside the story frame", () => {
    const l = stubShareLayout();
    for (const r of [l.ticket, l.name, l.mark]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(STORY.width);
      expect(r.y + r.h).toBeLessThanOrEqual(STORY.height);
    }
    expect(l.tearY).toBeLessThan(l.ticket.h);
    expect(l.name.y).toBeGreaterThan(l.ticket.y + l.ticket.h);
    expect(l.mark.y).toBeGreaterThan(l.name.y + l.name.h);
  });
});

describe("stubShareLines", () => {
  it("prints a drop's real number, and Still open until there is a total", () => {
    expect(stubShareLines(dropStub, "Maya Chen")).toMatchObject({ kicker: "Soosh drop", title: "Make one, give one", big: "No. 007", detail: "Still open", owner: "Kept by Maya" });
  });

  it("prints the total only when the Stub has one", () => {
    expect(stubShareLines({ ...dropStub, editionsTotal: 31 }).detail).toBe("of 31");
  });

  it("leaves the owner line out when there is no name", () => {
    expect(stubShareLines(dropStub).owner).toBe("");
    expect(stubShareLines(dropStub, "   ").owner).toBe("");
  });

  it("words the other kinds from their own labels", () => {
    expect(stubShareLines({ kind: "finish", title: "Pasta from scratch", color: "", day: "Nov 3", cornerName: "Pasta" })).toMatchObject({ kicker: "Finisher", big: "Nov 3", detail: "Pasta" });
    expect(stubShareLines({ kind: "regular", title: "Pottery", color: "", day: "Oct 31", cornerName: "Pottery", monthLong: "October" })).toMatchObject({ kicker: "Regular", big: "October", detail: "" });
    expect(stubShareLines({ kind: "event", title: "Clay Space", color: "", day: "Nov 8", hostName: "Priya" }).detail).toBe("Confirmed by Priya");
  });

  it("uses no dashes", () => {
    expect(Object.values(stubShareLines(dropStub, "Maya")).join(" ")).not.toMatch(/[—–]/);
  });
});

describe("sharePalette", () => {
  it("keeps plain hex colours and refuses anything else", () => {
    expect(sharePalette(dropStub)).toEqual(["#ff7ab6", "#ffd36e"]);
    expect(sharePalette({ ...dropStub, palette: ["red", "url(x)"] })).toHaveLength(5);
    expect(sharePalette({ kind: "finish", title: "", color: "", day: "" })).toHaveLength(2);
  });
});

describe("wrapLines", () => {
  const measure = (s: string) => s.length * 10;
  it("wraps on words", () => {
    expect(wrapLines("make one give one", 80, measure)).toEqual(["make one", "give one"]);
  });
  it("ends the last line with an ellipsis when the title is too long", () => {
    const lines = wrapLines("one two three four five six seven", 50, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(50);
  });
  it("copes with nothing", () => {
    expect(wrapLines("   ", 100, measure)).toEqual([]);
  });
});
