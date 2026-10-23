import { describe, expect, it } from "vitest";
import { pickCover } from "./pickCover";
import type { MoodCard } from "../../data/moodCards";
import type { Post } from "../../data/posts";

const card = (cornerSlug: string): MoodCard =>
  ({ spaceSlug: "s", cornerSlug, label: cornerSlug, guide: { step: "Do it." } }) as unknown as MoodCard;
const photo = (id: number, corner: string, createdAt: number): Post =>
  ({ id, hobbySlug: "s", corner, type: "photo", media: "https://x/y.jpg", visibility: "public", createdAt, creator: "A", caption: "" }) as unknown as Post;

describe("pickCover", () => {
  it("takes the highest-ranked ticket that has a public photo", () => {
    const got = pickCover([card("a"), card("b"), card("c")].map((c) => ({ card: c })), [photo(1, "c", 1), photo(2, "b", 2)], new Set());
    expect(got?.ticket.card.cornerSlug).toBe("b");
    expect(got?.photo?.id).toBe(2);
  });

  it("prefers a followed author's photo within the Corner", () => {
    const followed = { ...photo(3, "a", 1), userId: "u1" } as Post;
    const got = pickCover([{ card: card("a") }], [photo(4, "a", 9), followed], new Set(["u1"]));
    expect(got?.photo?.id).toBe(3);
  });

  it("falls back to the top ticket with no photo", () => {
    const got = pickCover([card("a"), card("b")].map((c) => ({ card: c })), [], new Set());
    expect(got?.ticket.card.cornerSlug).toBe("a");
    expect(got?.photo).toBeNull();
  });
});
