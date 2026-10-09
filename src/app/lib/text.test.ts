import { describe, expect, it } from "vitest";
import { endSentence, notificationBodyText, notificationText, withoutDashes } from "./text";

describe("withoutDashes", () => {
  it("turns a spaced dash into a sentence break", () => {
    expect(withoutDashes("A Space needs at least one host — promote someone else first.")).toBe(
      "A Space needs at least one host. Promote someone else first.",
    );
  });
  it("uses 'to' between numbers", () => {
    expect(withoutDashes("Pick 1–3 Corners.")).toBe("Pick 1 to 3 Corners.");
  });
  it("leaves text without dashes alone", () => {
    expect(withoutDashes("Nani loved your Moment.")).toBe("Nani loved your Moment.");
  });
});

describe("notificationText", () => {
  it("capitalizes product nouns and drops dashes", () => {
    expect(notificationText("Ana loved your moment.")).toBe("Ana loved your Moment.");
    expect(notificationText("Nani added their first moments.")).toBe("Nani added their first Moments.");
    expect(notificationText("Request declined — try again.")).toBe("Request declined. Try again.");
  });
});

describe("endSentence", () => {
  it("adds a period only when the text has no closing punctuation", () => {
    expect(endSentence("No Moments yet")).toBe("No Moments yet.");
    expect(endSentence("Try again.")).toBe("Try again.");
    expect(endSentence("Ready?")).toBe("Ready?");
  });
});

describe("notificationBodyText", () => {
  it("runs the usual clean-up on other kinds", () => {
    expect(notificationBodyText("love", "Maya loved your moment.")).toBe("Maya loved your Moment.");
  });
  it("shows a save notification exactly as stored, grouped wording included", () => {
    expect(notificationBodyText("save", "3 people want to try your Moment.")).toBe("3 people want to try your Moment.");
    expect(notificationBodyText("save", "Someone wants to try \u201CSourdough\u201D.")).toBe("Someone wants to try \u201CSourdough\u201D.");
  });
  it("leaves the author's own caption alone: no re-capitalized nouns, no stripped dashes", () => {
    const caption = "2 people want to try \u201Cmy corner space \u2014 day 3\u2026\u201D.";
    expect(notificationBodyText("save", caption)).toBe(caption);
    expect(notificationBodyText("thought", caption)).not.toBe(caption);
  });
});
