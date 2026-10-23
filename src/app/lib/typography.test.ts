import { describe, expect, it } from "vitest";
import { tieNumbers } from "./typography";

describe("tieNumbers", () => {
  it("joins a number and its unit with a non-breaking space", () => {
    expect(tieNumbers("Run-walk for 15 minutes: 1 minute running, 1 minute walking.")).toBe(
      "Run-walk for 15 minutes: 1 minute running, 1 minute walking.",
    );
    expect(tieNumbers("Draw your coffee mug for 10 minutes.")).toBe("Draw your coffee mug for 10 minutes.");
  });

  it("leaves other words and spaces alone", () => {
    expect(tieNumbers("Glue three saved receipts onto a page.")).toBe("Glue three saved receipts onto a page.");
    expect(tieNumbers("Mix 2 cups of flour")).toBe("Mix 2 cups of flour");
  });
});
