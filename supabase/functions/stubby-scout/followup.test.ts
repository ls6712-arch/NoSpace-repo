// Stubby plan PR 3: the one question's answers, follow-ups on the deck (the first after an ask is
// free, stubby-plan §10.1), and the bring-a-friend flag on the saved pick.
import { describe, expect, it, vi } from "vitest";
import { EMPTY_PROFILE, applyFollowUp, handleScout, type ScoutDeps } from "./handler.ts";
import { dayWindow, readIntent, searchWindow } from "./intent.ts";
import { linkKey, nyLocalToMs } from "./picks.ts";

const NOW = nyLocalToMs("2026-11-01T17:00");
const PAGE = (p: string) => `https://example.org/${p}`;
const pickJson = (title: string, url: string, over: Record<string, unknown> = {}) => ({ kind: "event", title, starts: "2026-11-01T20:00", ends: "2026-11-01T21:30", price: "Free", url, why: "Close by.", ...over });

function deps(o: { free?: boolean; claim?: number | null; text?: string; links?: string[] } = {}) {
  const asks: unknown[] = [];
  const personal: Record<string, unknown>[] = [];
  const searches: { prompt?: { user: string } }[] = [];
  const claimFreeFollowUp = vi.fn(async () => o.free ?? false);
  const claimAsk = vi.fn(async () => (o.claim === undefined ? 50 : o.claim));
  const d: ScoutDeps = {
    settings: { enabled: true, hasKey: true, runsPerDay: 3, maxSearches: 5, restockSearches: 3, asksPerPerson: 3, asksPerDay: 200 },
    now: () => NOW,
    userId: async () => "user-1",
    whoIs: async () => ({ guest: false, member: true }),
    ipHash: async () => null,
    db: { runsSince: async () => 0, startRun: async () => 1, finishRun: async () => undefined, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => true, profile: async () => ({ ...EMPTY_PROFILE, monthlyBudget: 80 }) },
    server: {
      claimSource: async () => null,
      claimAsk,
      claimFreeFollowUp,
      finishRun: async () => undefined,
      finishAsk: async (id, r) => void asks.push({ id, ...r }),
      asksSince: async () => 1,
      trustedHosts: async () => [],
      corners: async () => [],
      existingKeys: async () => new Set(),
      insertPick: async () => true,
      insertPersonal: async (row) => (personal.push(row as Record<string, unknown>), true),
    },
    search: async (r) => {
      searches.push(r as { prompt?: { user: string } });
      return { text: o.text ?? "<picks>[]</picks>", sourceLinks: new Set((o.links ?? []).map((l) => linkKey(l)!)), searches: 1 };
    },
  };
  return { d, asks, personal, searches, claimFreeFollowUp, claimAsk };
}
const post = (body: unknown) => new Request("https://fn.example.com/stubby-scout", { method: "POST", headers: { authorization: "Bearer x" }, body: JSON.stringify(body) });

describe("follow-ups", () => {
  it("the first after an ask is free: no new ask, its picks join that ask, ranked after its own", async () => {
    const { d, claimAsk, claimFreeFollowUp, personal, asks } = deps({ free: true, text: `<picks>${JSON.stringify([pickJson("Cheaper pottery", PAGE("cheap"))])}</picks>`, links: [PAGE("cheap")] });
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: 42, kind: "cheaper", titles: ["Wheel night"] } }), d)).json();
    expect(claimFreeFollowUp).toHaveBeenCalledWith("user-1", 42, NOW - 86_400_000);
    expect(claimAsk).not.toHaveBeenCalled();
    expect(body).toMatchObject({ askId: 42, free: true, outcome: "found" });
    expect(personal[0]).toMatchObject({ ask_id: 42, rank: 10 });
    // Its ask's counts stay as they were.
    expect(asks).toEqual([]);
  });

  it("later ones use an ask, and stop at 3 a day", async () => {
    const a = deps({ free: false });
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: 42, kind: "later", titles: [] } }), a.d)).json();
    expect(a.claimAsk).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({ askId: 50, free: false });
    const b = deps({ free: false, claim: null });
    expect((await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: 42, kind: "later", titles: [] } }), b.d)).status).toBe(429);
  });

  it("tells the search what to change and what was already shown, and never shows a title twice", async () => {
    const text = `<picks>${JSON.stringify([pickJson("Wheel night", PAGE("wheel")), pickJson("Glaze class", PAGE("glaze"))])}</picks>`;
    const { d, searches, personal } = deps({ free: true, text, links: [PAGE("wheel"), PAGE("glaze")] });
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: 42, kind: "different", titles: ["Wheel night"] } }), d)).json();
    const prompt = searches[0].prompt!.user;
    expect(prompt).toContain("They want something different from what they were shown");
    expect(prompt).toContain('Already shown (don\'t report these again): "Wheel night".');
    expect(personal.map((p) => p.title)).toEqual(["Glaze class"]);
    expect(body.dropped).toContainEqual({ title: "Wheel night", reason: "Already in the deck.", key: "other" });
  });

  it("never asks the one question on a follow-up", async () => {
    const { d, claimFreeFollowUp } = deps({ free: true });
    const body = await (await handleScout(post({ mode: "ask", ask: "something fun", questions: true, followUp: { of: 42, kind: "more", titles: [] } }), d)).json();
    expect(body.question).toBeUndefined();
    expect(claimFreeFollowUp).toHaveBeenCalled();
  });

  it("refuses a follow-up of the wrong shape, and treats an unknown kind as a new ask", async () => {
    const { d, claimFreeFollowUp, claimAsk } = deps();
    // The body schema is strict: a wrong type is a 400 before anything is claimed.
    expect((await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: "42", kind: "cheaper" } }), d)).status).toBe(400);
    await handleScout(post({ mode: "ask", ask: "pottery tonight", followUp: { of: 42, kind: "pricier" } }), d);
    expect(claimFreeFollowUp).not.toHaveBeenCalled();
    expect(claimAsk).toHaveBeenCalledTimes(1);
  });

  it("Cheaper halves the ceiling (or sets a cheap one); Later starts two hours on", () => {
    const intent = readIntent("pottery tonight", { now: NOW, monthlyBudget: 80 });
    const window = searchWindow(intent, NOW);
    expect(applyFollowUp(intent, window, "cheaper", NOW).intent.budget).toEqual({ max: 10, free: false, from: "ask" });
    const noBudget = readIntent("pottery tonight", { now: NOW });
    expect(applyFollowUp(noBudget, window, "cheaper", NOW).intent.budget).toEqual({ max: 20, free: false, from: "ask" });
    expect(applyFollowUp(intent, window, "later", NOW).window.startMs).toBe(NOW + 2 * 3_600_000);
    expect(applyFollowUp(intent, window, "closer", NOW)).toEqual({ intent, window });
  });
});

describe("the one question's answers", () => {
  it("Surprise me (or a typed answer) skips the question", () => {
    expect(readIntent("something fun", { now: NOW }).missing).toBe("setting");
    expect(readIntent("something fun", { now: NOW, answers: { skip: true } }).missing).toBeNull();
  });

  it("Pick a day: that whole day, from now if it's today; nonsense or a past day is ignored", () => {
    expect(dayWindow("2026-11-07", NOW)).toEqual({ startMs: nyLocalToMs("2026-11-07T00:00"), endMs: nyLocalToMs("2026-11-08T00:00"), label: "day", hard: true });
    expect(dayWindow("2026-11-01", NOW)!.startMs).toBe(NOW);
    expect(dayWindow("2026-10-30", NOW)).toBeNull();
    expect(dayWindow("2026-11-31", NOW)).toBeNull();
    expect(readIntent("something fun with friends", { now: NOW, answers: { when: "2026-11-07" } }).when).toMatchObject({ label: "day" });
  });

  it("the handler takes a picked day and Surprise me, and nothing else", async () => {
    const { d, searches } = deps();
    await handleScout(post({ mode: "ask", ask: "something fun with friends", answers: { when: "2026-11-07" } }), d);
    expect(searches[0].prompt!.user).toContain("only things that start between 2026-11-07T00:00 and 2026-11-08T00:00");
    const q = deps();
    const body = await (await handleScout(post({ mode: "ask", ask: "something fun", questions: true, answers: { skip: true } }), q.d)).json();
    expect(body.question).toBeUndefined();
    // An answer that isn't one of the choices is refused at the door (schema.ts), never read.
    const bad = deps();
    const res = await handleScout(post({ mode: "ask", ask: "something fun", questions: true, answers: { when: "next blue moon" } }), bad.d);
    expect(res.status).toBe(400);
  });
});

describe("the bring-a-friend flag", () => {
  it("is saved on the pick, solo only", async () => {
    const text = `<picks>${JSON.stringify([pickJson("Pottery for two", PAGE("two"), { better_with_friend: true })])}</picks>`;
    const solo = deps({ text, links: [PAGE("two")] });
    await handleScout(post({ mode: "ask", ask: "pottery tonight on my own" }), solo.d);
    expect(solo.personal[0]).toMatchObject({ better_with_friend: true });
    const partner = deps({ text, links: [PAGE("two")] });
    await handleScout(post({ mode: "ask", ask: "pottery tonight with my partner" }), partner.d);
    expect(partner.personal[0]).toMatchObject({ better_with_friend: false });
  });
});
