// Never a blank result (live test, Nov 2, 2026: ask 9 found 1 candidate, kept 0, and showed
// nothing). The model is asked for up to 10 candidates and the code keeps the best 3; fewer than 3
// that fit means one more search round within the same ask, aimed at the gaps; when nothing fits,
// the soonest after from any time asked (every rule but the time); and when still nothing, the
// reasons, counted, so the person sees why. Why each candidate was dropped is saved with the ask
// (titles and reasons only). And Stubby asks at most one question per ask.
import { describe, expect, it, vi } from "vitest";
import { ASK_BEST, checkAskPicks, gapLines, topReasons, type AskCheckContext } from "./ask.ts";
import { askUserPrompt } from "./askPrompt.ts";
import { EMPTY_PROFILE, handleScout, type ScoutDeps } from "./handler.ts";
import { readIntent, searchWindow } from "./intent.ts";
import { linkKey, nyLocalToMs, type RawPick } from "./picks.ts";

const NOW = nyLocalToMs("2026-11-01T17:00");
const page = (p: string) => `https://example.org${p}`;
const ev = (title: string, url: string, over: Partial<RawPick> = {}): RawPick => ({ kind: "event", title, place: "Brooklyn", starts: "2026-11-01T19:00", ends: "2026-11-01T21:00", price: "Free", url, why: "Close by.", ...over });
const reply = (picks: RawPick[]) => ({ text: `<picks>${JSON.stringify(picks)}</picks>`, sourceLinks: new Set(picks.map((p) => linkKey(p.url)).filter((k): k is string => !!k)), searches: 2 });

function deps(rounds: RawPick[][]) {
  const asks: Record<string, unknown>[] = [];
  const prompts: string[] = [];
  const search = vi.fn(async (r: { prompt?: { user: string } | null }) => {
    prompts.push(r.prompt?.user ?? "");
    return reply(rounds[prompts.length - 1] ?? []);
  });
  const d: ScoutDeps = {
    settings: { enabled: true, hasKey: true, runsPerDay: 3, maxSearches: 5, restockSearches: 3, asksPerPerson: 3, asksPerDay: 200 },
    now: () => NOW,
    userId: async () => "user-1",
    db: { runsSince: async () => 0, startRun: async () => 1, finishRun: async () => undefined, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => true, profile: async () => EMPTY_PROFILE },
    server: {
      claimSource: async () => null,
      claimAsk: async () => 9,
      claimFreeFollowUp: async () => false,
      finishRun: async () => undefined,
      finishAsk: async (id, r) => void asks.push({ id, ...r }),
      asksSince: async () => 1,
      trustedHosts: async () => [],
      corners: async () => [],
      existingKeys: async () => new Set(),
      insertPick: async () => true,
      insertPersonal: async () => true,
    },
    search: search as unknown as ScoutDeps["search"],
  };
  return { d, asks, prompts, search };
}
const post = (body: unknown) => new Request("https://fn.example.com/stubby-scout", { method: "POST", headers: { authorization: "Bearer x" }, body: JSON.stringify(body) });

describe("golden: the search returns 1 candidate, and it's dropped", () => {
  it("searches once more aimed at the gap, then still answers with why, never a blank", async () => {
    const { d, asks, prompts, search } = deps([[ev("50 things to do tonight", page("/things-to-do/tonight"))], []]);
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight" }), d)).json();
    expect(search).toHaveBeenCalledTimes(2);
    expect(prompts[1]).toContain("Your first search found nothing that fit. Search again, aimed at what's missing.");
    expect(prompts[1]).toContain("Dropped so far: 1 pages that list many things (find each event's own page instead). Avoid those.");
    expect(body).toMatchObject({ outcome: "nothing", picks: [], reasons: [{ key: "listing", count: 1 }] });
    // Saved with the ask for debugging: the title and reason, never what they typed.
    expect(asks[0]).toMatchObject({ id: 9, found: 1, added: 0, failed: false, dropped: [{ title: "50 things to do tonight", reason: "A page that lists many things, not its own page." }] });
    expect(JSON.stringify(asks[0])).not.toContain("pottery tonight");
  });

  it("the second round can fill the gap", async () => {
    const { d } = deps([[ev("50 things to do tonight", page("/things-to-do/tonight"))], [ev("Wheel night", page("/studio/wheel-night")), ev("Glaze class", page("/studio/glaze"))]]);
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight" }), d)).json();
    expect(body.outcome).toBe("found");
    expect(body.picks.map((p: { title: string }) => p.title)).toEqual(["Wheel night", "Glaze class"]);
  });
});

describe("finding more", () => {
  it("asks the model for up to 10 candidates; the code keeps the best 3", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ev(`Studio night ${i + 1}`, page(`/studio/night-${i + 1}`)));
    const { d, prompts, search } = deps([ten]);
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight" }), d)).json();
    expect(prompts[0]).toContain("Report up to 10 candidates, best fit for this person first. Only real, dated ones with their own page: fewer is fine.");
    expect(body.picks.map((p: { title: string }) => p.title)).toEqual(["Studio night 1", "Studio night 2", "Studio night 3"]);
    expect(ASK_BEST).toBe(3);
    // 3 fit, so no second round.
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("a second round that fails still leaves the first round's picks", async () => {
    const { d } = deps([[ev("Wheel night", page("/studio/wheel-night"))]]);
    let n = 0;
    const first = d.search;
    d.search = async (r) => {
      n += 1;
      if (n === 2) throw new Error("busy");
      return first(r);
    };
    const body = await (await handleScout(post({ mode: "ask", ask: "pottery tonight" }), d)).json();
    expect(body.outcome).toBe("found");
    expect(body.picks).toHaveLength(1);
  });

  it("gapLines names what was kept and what to avoid", () => {
    const text = gapLines([], [{ title: "A", reason: "x", key: "budget" }, { title: "B", reason: "x", key: "budget" }, { title: "C", reason: "x", key: "midnight" }]);
    expect(text).toContain("Dropped so far: 2 things over the budget; 1 things that end after midnight.");
  });
});

describe("the soonest after, for any time asked", () => {
  const ctxFor = (ask: string, raw: RawPick[]): AskCheckContext => {
    const intent = readIntent(ask, { now: NOW });
    const window = searchWindow(intent, NOW);
    return {
      now: NOW,
      intent,
      window,
      sourceLinks: new Set(raw.map((r) => linkKey(r.url)).filter((k): k is string => !!k)),
      sooshLinks: new Set(),
      corners: new Map(),
      pickedCornerIds: new Set(),
      askText: ask,
      latestMs: window.endMs + 7 * 86_400_000,
    };
  };

  it("this weekend: nothing in it fits, so the soonest after, marked", () => {
    const raw = [ev("Tuesday wheel night", page("/studio/tue"), { starts: "2026-11-03T19:00", ends: "2026-11-03T21:00" })];
    const r = checkAskPicks(raw, ctxFor("pottery this weekend", raw));
    expect(r.outcome).toBe("after");
    expect(r.kept).toMatchObject([{ title: "Tuesday wheel night", after: true }]);
  });

  it("only every rule but the time: a listing page or a bar is never shown as soonest after", () => {
    const raw = [
      ev("Tuesday listings", page("/events"), { starts: "2026-11-03T19:00" }),
      ev("Tuesday brewery tour", page("/tours/brewery"), { starts: "2026-11-03T19:00", place: "A brewery" }),
    ];
    const r = checkAskPicks(raw, ctxFor("pottery this weekend", raw));
    expect(r.outcome).toBe("nothing");
    expect(topReasons(r.dropped)).toEqual([
      { key: "listing", count: 1 },
      { key: "adult", count: 1 },
    ]);
  });

  it("the reasons are the 3 most common kinds, never \"other\"", () => {
    const d = (key: "listing" | "midnight" | "budget" | "time" | "other") => ({ title: "x", reason: "x", key });
    expect(topReasons([d("listing"), d("listing"), d("midnight"), d("budget"), d("budget"), d("budget"), d("time"), d("other"), d("other"), d("other"), d("other")])).toEqual([
      { key: "budget", count: 3 },
      { key: "listing", count: 2 },
      { key: "midnight", count: 1 },
    ]);
  });

  it("tells the model about the soonest after for any time", () => {
    const intent = readIntent("pottery this weekend", { now: NOW });
    const prompt = askUserPrompt("pottery this weekend", intent, searchWindow(intent, NOW), { corners: [], freeTimes: [], neighborhood: null, city: null, passes: [], sooshPages: [] }, NOW);
    expect(prompt).toContain("If nothing fits that time, also report up to 3 of the soonest good options after it.");
  });
});

describe("at most one question per ask", () => {
  it("once any answer is given (who, when, a day, Surprise me), he never asks again, even when asked to ask", async () => {
    for (const answers of [{ who: "solo" }, { when: "tonight" }, { when: "2026-11-07" }, { skip: true }]) {
      const { d, search } = deps([[]]);
      const body = await (await handleScout(post({ mode: "ask", ask: "something fun", questions: true, answers }), d)).json();
      expect(body.question).toBeUndefined();
      expect(search).toHaveBeenCalled();
    }
  });

  it("for any ask, the question is one of stay in or head out, who, when or what, and only one", () => {
    for (const ask of ["something fun", "something to do", "anything tonight", "ideas", "something with friends", "tonight with friends", "fun stuff", "something out tonight"]) {
      const intent = readIntent(ask, { now: NOW });
      expect([null, "setting", "who", "when", "what"]).toContain(intent.missing);
      // Answering it leaves nothing more to ask.
      const answer =
        intent.missing === "setting" ? { setting: "out" as const } : intent.missing === "who" ? { who: "solo" as const } : intent.missing === "when" ? { when: "tonight" } : { skip: true };
      expect(readIntent(ask, { now: NOW, answers: answer }).missing).toBeNull();
    }
  });
});
