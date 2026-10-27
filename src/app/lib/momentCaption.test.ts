import { describe, expect, it } from "vitest";
import { isGeneratedCaption, momentAlt, momentCaption } from "./momentCaption";

const post = (caption: string, extra: Record<string, unknown> = {}) => ({ caption, hobbySlug: "food-cooking", subHobby: undefined, corner: undefined, creator: "Maya", ...extra });

describe("momentCaption", () => {
  it("drops the caption the app writes from a Space or Corner name", () => {
    expect(isGeneratedCaption(post("A food & cooking moment"))).toBe(true);
    expect(isGeneratedCaption(post("A food photography moment", { corner: "food-photography" }))).toBe(true);
    expect(isGeneratedCaption(post("A cooking moment", { corner: "cooking" }))).toBe(true);
  });
  it("keeps anything a person wrote, even in a similar shape", () => {
    expect(isGeneratedCaption(post("A good moment"))).toBe(false);
    expect(momentCaption(post("Ramen broth, day two."))).toBe("Ramen broth, day two.");
    expect(momentCaption(post("  "))).toBe("");
  });
  it("builds alt text from the caption, else the Corner and the person", () => {
    expect(momentAlt(post("Ramen broth, day two."), "Cooking")).toBe("Ramen broth, day two.");
    expect(momentAlt(post("A Food & Cooking moment"), "Cooking")).toBe("Cooking Moment by Maya");
  });
});
