import { describe, expect, it } from "vitest";
import { closesLine, countLines, dropFace, dropFromRow, dropLink, dropLogPath, dropPhase, dropShareText, dropSignUpPath, goalLine, type Drop } from "./drops";
import { isRealRedirect } from "./onboardingProgress";

const NOW = Date.parse("2026-11-25T15:00:00Z"); // Wednesday 10 AM in New York
const row = {
  id: 7,
  slug: "make-one-give-one",
  title: "Make one, give one",
  blurb: "  Make one small gift by hand, with one other person.  ",
  corner_key: "crafts-making/paper-crafts",
  target_moments: 1,
  opens_at: "2026-11-25T00:00:00Z",
  closes_at: "2026-12-07T04:59:00Z", // Sunday Dec 6, 11:59 PM in New York
  max_editions: null,
  palette: ["#ff7ab6", "#ffd36e", 3],
  people_in: 12,
  finished: 4,
};
const drop: Drop = dropFromRow(row);

describe("dropFromRow", () => {
  it("reads a drop_summary row", () => {
    expect(drop).toMatchObject({ id: 7, slug: "make-one-give-one", cornerKey: "crafts-making/paper-crafts", targetMoments: 1, peopleIn: 12, finished: 4 });
    expect(drop.blurb).toBe("Make one small gift by hand, with one other person.");
    expect(drop.palette).toEqual(["#ff7ab6", "#ffd36e"]);
  });

  it("has no counts when the row comes from the table itself", () => {
    const { people_in: _p, finished: _f, ...bare } = row;
    expect(dropFromRow(bare)).toMatchObject({ peopleIn: null, finished: null });
  });
});

describe("a drop's window", () => {
  it("is open until the minute it closes", () => {
    expect(dropPhase(drop, NOW)).toBe("open");
    expect(dropPhase(drop, drop.closesAt - 1)).toBe("open");
    expect(dropPhase(drop, drop.closesAt)).toBe("closed");
  });

  it("says when it closes in New York time", () => {
    expect(closesLine(drop, NOW)).toBe("Closes Sun, Dec 6, 11:59 PM");
    expect(closesLine(drop, drop.closesAt + 1000)).toBe("Closed Sun, Dec 6");
  });
});

describe("what a drop says", () => {
  it("words the goal for one Moment and for several", () => {
    expect(goalLine(drop)).toBe("One Moment before it closes");
    expect(goalLine({ targetMoments: 5 })).toBe("5 Moments before it closes");
  });

  it("shows only real counts above zero, never a made-up one", () => {
    expect(countLines(drop)).toEqual(["12 people in", "4 Stubs kept"]);
    expect(countLines({ peopleIn: 1, finished: 1 })).toEqual(["1 person in", "1 Stub kept"]);
    expect(countLines({ peopleIn: 0, finished: 0 })).toEqual([]);
    expect(countLines({ peopleIn: null, finished: null })).toEqual([]);
  });

  it("writes the share text with no dashes", () => {
    const text = dropShareText(drop, NOW);
    expect(text).toBe("Make one, give one. Closes Sun, Dec 6, 11:59 PM. Do it with me.");
    expect(text).not.toMatch(/[—–]/);
  });
});

describe("a drop's links", () => {
  it("shares the drop's own page, with an invite when there is one", () => {
    expect(dropLink("make-one-give-one")).toBe("https://www.onsoosh.com/#/drop/make-one-give-one");
    expect(dropLink("make-one-give-one", "AB12")).toBe("https://www.onsoosh.com/#/drop/make-one-give-one?invite=AB12");
  });

  it("sends a signed-out visitor through sign-up and back to the drop", () => {
    const plain = new URL(`https://x${dropSignUpPath("make-one-give-one")}`);
    expect(plain.pathname).toBe("/onboarding");
    expect(plain.searchParams.get("redirect")).toBe("/drop/make-one-give-one");
    expect(plain.searchParams.has("invite")).toBe(false);
    expect(isRealRedirect(plain.searchParams.get("redirect"))).toBe(true);
    expect(new URL(`https://x${dropSignUpPath("make-one-give-one", "AB12")}`).searchParams.get("invite")).toBe("AB12");
  });

  it("logs into your own drop Pursuit", () => {
    expect(dropLogPath("abc-123")).toBe("/create?pursuit=abc-123");
  });
});

describe("dropFace", () => {
  it("is a blank Stub until you finish, and never prints a total while open", () => {
    const blank = dropFace(drop, NOW);
    expect(blank).toMatchObject({ kind: "drop", title: "Make one, give one", edition: undefined, editionsTotal: undefined });
    expect(dropFace(drop, NOW, 3)).toMatchObject({ edition: 3, editionsTotal: undefined });
  });

  it("prints the final total once it has closed", () => {
    expect(dropFace(drop, drop.closesAt + 1, 3)).toMatchObject({ edition: 3, editionsTotal: 4 });
  });

  it("drops a palette too short to draw", () => {
    expect(dropFace({ ...drop, palette: ["#ffffff"] }, NOW).palette).toBeUndefined();
  });
});
