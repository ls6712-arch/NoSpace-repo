import { describe, expect, it } from "vitest";
import { buildStubCards, type PursuitInfo, type RawStub } from "./stubs";

const day = (ms: number) => `D${ms}`;
const info = new Map<string, PursuitInfo>([["p1", { title: "5 pastas", cornerName: "Pasta", total: 5, spaceSlug: "food-cooking", cornerSlug: "pasta" }]]);

describe("buildStubCards", () => {
  const raws: RawStub[] = [
    { id: 1, kind: "session", serial: 1, issuedAt: 10, pursuitId: "p1" },
    { id: 2, kind: "session", serial: 2, issuedAt: 20, pursuitId: "p1" },
    { id: 3, kind: "gold", serial: 3, issuedAt: 30, pursuitId: "p1" },
    { id: 4, kind: "event", serial: 4, issuedAt: 5, eventTitle: "Pasta night", spaceName: "Clay Hands" },
  ];
  const cards = buildStubCards(raws, info, day);

  it("lists newest first", () => expect(cards.map((c) => c.id)).toEqual([3, 2, 1, 4]));
  it("numbers session Stubs within their Pursuit, in the order issued", () => {
    expect(cards.find((c) => c.id === 1)?.title).toBe("Pasta #1");
    expect(cards.find((c) => c.id === 2)?.title).toBe("Pasta #2");
    expect(cards.find((c) => c.id === 2)?.count).toEqual({ done: 2, total: 5 });
  });
  it("names a gold Stub by its Pursuit and an event Stub by its event", () => {
    expect(cards.find((c) => c.id === 3)?.title).toBe("5 pastas");
    expect(cards.find((c) => c.id === 4)?.title).toBe("Pasta night");
    expect(cards.find((c) => c.id === 4)?.meta).toBe("D5 · Clay Hands");
  });
  it("copes with a Pursuit it has no details for", () => {
    expect(buildStubCards([{ id: 9, kind: "session", serial: 1, issuedAt: 1, pursuitId: "gone" }], new Map(), day)[0].title).toBe("Session #1");
  });
});
