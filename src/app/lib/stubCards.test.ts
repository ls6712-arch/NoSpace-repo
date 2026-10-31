import { describe, expect, it } from "vitest";
import { buildStubCards, editionLabel, type PursuitInfo, type RawStub } from "./stubs";

const day = (ms: number) => `D${ms}`;
const month = (ymd: string) => `M${ymd}`;
const info = new Map<string, PursuitInfo>([
  ["p1", { title: "5 pastas", cornerName: "Pasta", total: 5, spaceSlug: "food-cooking", cornerSlug: "pasta" }],
  ["d1", { title: "Sunrise week", spaceSlug: "sports-fitness", cornerSlug: "running" }],
]);

describe("buildStubCards", () => {
  const raws: RawStub[] = [
    { id: 1, kind: "finish", serial: 1, issuedAt: 30, pursuitId: "p1", cornerKey: "food-cooking/pasta" },
    { id: 2, kind: "drop", serial: 2, issuedAt: 40, pursuitId: "d1", edition: 42, cornerKey: "sports-fitness/running" },
    { id: 3, kind: "regular", serial: 3, issuedAt: 20, cornerKey: "crafts-making/pottery", period: "2026-10-01" },
    { id: 4, kind: "event", serial: 4, issuedAt: 5, eventTitle: "Pasta night", spaceName: "Clay Hands" },
  ];
  const cards = buildStubCards(raws, info, day, month);

  it("lists newest first", () => expect(cards.map((c) => c.id)).toEqual([2, 1, 3, 4]));
  it("names a Finisher by its Pursuit", () => {
    expect(cards.find((c) => c.id === 1)?.title).toBe("5 pastas");
    expect(cards.find((c) => c.id === 1)?.corner).toEqual({ spaceSlug: "food-cooking", slug: "pasta" });
  });
  it("gives a drop its edition number", () => {
    expect(cards.find((c) => c.id === 2)?.title).toBe("Sunrise week");
    expect(cards.find((c) => c.id === 2)?.meta).toBe("D40 · No. 042");
  });
  it("names a Regular by its Corner and month", () => {
    expect(cards.find((c) => c.id === 3)?.meta).toBe("M2026-10-01");
    expect(cards.find((c) => c.id === 3)?.corner).toEqual({ spaceSlug: "crafts-making", slug: "pottery" });
  });
  it("names an event Stub by its event and Space", () => {
    expect(cards.find((c) => c.id === 4)?.title).toBe("Pasta night");
    expect(cards.find((c) => c.id === 4)?.meta).toBe("D5 · Clay Hands");
  });
  it("copes with a Pursuit it has no details for", () => {
    expect(buildStubCards([{ id: 9, kind: "finish", serial: 1, issuedAt: 1, pursuitId: "gone" }], new Map(), day)[0].title).toBe("Pursuit");
  });
  it("pads edition numbers to three digits", () => {
    expect(editionLabel(7)).toBe("No. 007");
    expect(editionLabel(1234)).toBe("No. 1234");
  });
});
