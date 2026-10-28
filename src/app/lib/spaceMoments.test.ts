import { describe, expect, it } from "vitest";
import { keepSpacesWithMemberMoments, orderSpaceMoments } from "./spaceMoments";

const m = (id: number, userId: string, createdAt: number) => ({ id, userId, createdAt });

describe("orderSpaceMoments", () => {
  const hosts = new Set(["host"]);
  it("puts members' Moments first, newest first, then the host's own, newest first", () => {
    const out = orderSpaceMoments([m(1, "host", 50), m(2, "ann", 10), m(3, "host", 60), m(4, "bo", 20)], hosts);
    expect(out.map((x) => x.id)).toEqual([4, 2, 3, 1]);
  });
  it("keeps everything when there are no hosts or no Moments", () => {
    expect(orderSpaceMoments([m(1, "ann", 1), m(2, "bo", 2)], new Set())).toHaveLength(2);
    expect(orderSpaceMoments([], hosts)).toEqual([]);
  });
  it("does not change its input", () => {
    const input = [m(1, "host", 5), m(2, "ann", 1)];
    orderSpaceMoments(input, hosts);
    expect(input.map((x) => x.id)).toEqual([1, 2]);
  });
});

describe("keepSpacesWithMemberMoments", () => {
  const spaces = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("drops a Space with no member Moments", () => {
    expect(keepSpacesWithMemberMoments(spaces, new Set(["a", "c"]))).toEqual([{ id: "a" }, { id: "c" }]);
  });
  it("hides every Space when none has any", () => {
    expect(keepSpacesWithMemberMoments(spaces, new Set())).toEqual([]);
  });
  it("shows every Space when the answer is unavailable", () => {
    expect(keepSpacesWithMemberMoments(spaces, null)).toHaveLength(3);
  });
});
