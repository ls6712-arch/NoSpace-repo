// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// Hoisted to the top either way; written here so it reads in the order it runs (vitest 5 requires it).
vi.mock("./draftMedia", () => ({ clearDraftMedia: () => undefined }));
import {
  EMPTY_DECK,
  addCards,
  bringBack,
  cardCount,
  dealDeck,
  dropCards,
  frontCard,
  keepFront,
  loadDeck,
  notNowFront,
  prune,
  saveDeck,
  seeSkipped,
  unselect,
  type DeckState,
} from "./stubbyDeck";

const [A, B, C, D, E, F, G] = [1, 2, 3, 4, 5, 6, 7];
const deal = (...ids: number[]) => dealDeck(EMPTY_DECK, ids);

describe("the deck (stubby-plan §6.5)", () => {
  it("the golden case: Not now on A then B, Bring it back, Keep B, C and D, plans from B and D", () => {
    let s = deal(A, B, C, D);
    s = notNowFront(s);
    s = notNowFront(s);
    expect(frontCard(s)).toBe(C);
    expect(s.order).toEqual([C, D, A, B]);
    s = bringBack(s);
    expect(frontCard(s)).toBe(B);
    s = keepFront(s);
    expect(s.selection).toEqual([B]);
    expect(frontCard(s)).toBe(C);
    s = keepFront(s);
    s = keepFront(s);
    expect(s.selection).toEqual([B, C, D]);
    s = dropCards(s, [B, D]);
    expect(s.selection).toEqual([C]);
  });

  it("passing twice in a row never swaps the same two forever: the third comes forward", () => {
    let s = deal(A, B, C);
    s = notNowFront(s);
    s = notNowFront(s);
    expect(frontCard(s)).toBe(C);
  });

  it("runs out when only Not now cards are left, until See the ones you skipped", () => {
    let s = deal(A, B);
    s = notNowFront(notNowFront(s));
    expect(frontCard(s)).toBeNull();
    expect(cardCount(s)).toBeNull();
    s = seeSkipped(s);
    expect(frontCard(s)).toBe(A);
    expect(s.order).toEqual([A, B]);
  });

  it("Bring it back works for the last 3, newest first", () => {
    let s = deal(A, B, C, D, E);
    for (let i = 0; i < 4; i++) s = notNowFront(s);
    expect(s.recent).toEqual([B, C, D]);
    s = bringBack(s);
    expect(frontCard(s)).toBe(D);
    s = bringBack(s);
    expect(frontCard(s)).toBe(C);
    s = bringBack(s);
    expect(frontCard(s)).toBe(B);
    const same = bringBack(s);
    expect(frontCard(same)).toBe(B);
  });

  it("Your selection holds 5 at most; Keep does nothing when it's full", () => {
    let s = deal(A, B, C, D, E, F, G);
    for (let i = 0; i < 6; i++) s = keepFront(s);
    expect(s.selection).toEqual([A, B, C, D, E]);
    expect(frontCard(s)).toBe(F);
  });

  it("removing one from Your selection puts it at the back of the deck", () => {
    let s = keepFront(deal(A, B, C));
    s = unselect(s, A);
    expect(s.selection).toEqual([]);
    expect(s.order).toEqual([B, C, A]);
  });

  it("counts the front card among every card this deck has held", () => {
    let s = deal(A, B, C, D, E);
    expect(cardCount(s)).toEqual({ n: 1, total: 5 });
    s = notNowFront(s);
    expect(cardCount(s)).toEqual({ n: 2, total: 5 });
  });

  it("a follow-up adds to the back; a new ask deals a new deck but keeps Your selection", () => {
    let s = keepFront(deal(A, B));
    s = addCards(s, [C, B, A, D]);
    expect(s.order).toEqual([B, C, D]);
    expect(cardCount(s)).toEqual({ n: 2, total: 4 });
    s = dealDeck(s, [A, E, F]);
    expect(s.selection).toEqual([A]);
    expect(s.order).toEqual([E, F]);
  });

  it("cards whose picks are gone leave the deck", () => {
    const s = prune(keepFront(deal(A, B, C)), new Set([B]));
    expect(s).toEqual({ order: [B], passed: [], recent: [], selection: [], all: [B] });
  });
});

describe("kept in this browser, per person", () => {
  it("saves and loads, and reads nonsense as an empty deck", () => {
    const s: DeckState = keepFront(deal(A, B));
    saveDeck("u1", s);
    expect(loadDeck("u1")).toEqual(s);
    expect(loadDeck("u2")).toEqual(EMPTY_DECK);
    window.localStorage.setItem("soosh.stubby.deck.v1:u3", "{not json");
    expect(loadDeck("u3")).toEqual(EMPTY_DECK);
    expect(loadDeck(undefined)).toEqual(EMPTY_DECK);
  });
});

describe("signing out", () => {
  it("clears every person's deck and this session's remembered answer", async () => {
    const { clearLocalData } = await import("./localData");
    saveDeck("u1", keepFront(deal(A, B)));
    saveDeck("u2", deal(C));
    window.localStorage.setItem("unrelated", "stays");
    window.sessionStorage.setItem("soosh.stubby.answers.v1", JSON.stringify({ who: "solo" }));
    clearLocalData();
    expect(loadDeck("u1")).toEqual(EMPTY_DECK);
    expect(loadDeck("u2")).toEqual(EMPTY_DECK);
    expect(window.localStorage.getItem("unrelated")).toBe("stays");
    expect(window.sessionStorage.getItem("soosh.stubby.answers.v1")).toBeNull();
  });
});
