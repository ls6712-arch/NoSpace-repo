// Step 1, safety routing (stubby-agent C1): clear distress gets the care card and no picks; ordinary
// sadness gets gentle picks; everyday phrases never trigger it. Nothing is stored and no ask is used.
import { describe, expect, it, vi } from "vitest";
import { careCheck, careKeywords } from "../../supabase/functions/stubby-scout/v3/care.ts";
import { careCountry, CARE_RESOURCES, CARE_ELSEWHERE, VERIFIED_ON, EXPERT_REVIEW } from "../../supabase/functions/stubby-scout/v3/careResources.ts";
import { claudeCareModel } from "../../supabase/functions/stubby-scout/v3/careModel.ts";
import { handleScout, CARE_LINE, type ScoutDeps } from "../../supabase/functions/stubby-scout/handler.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { candidate, input, NOW } from "./fixtures.ts";

const CLEAR = [
  "i want to die",
  "I don't want to be alive anymore, what's the point",
  "thinking about killing myself tonight",
  "I can't go on like this",
  "feeling hopeless, nothing to do",
  "I've been self harming again",
  "everyone would be better off dead without me",
  "I want to end it all",
];
const SADNESS = ["feeling low, something gentle tonight", "rough day, cheer me up", "I'm a bit sad, anything cozy?", "lonely this weekend, any ideas", "kinda burnt out, want something calm"];
const FALSE_ALARMS = [
  "this traffic is killing me, something close by tonight",
  "dying to try pottery",
  "my feet are killing me, something sitting down",
  "a killer brunch spot this weekend",
  "bored to death, anything fun",
  "dead tired, something chill at home",
  "I can't go on the hike this weekend, something indoors instead",
  "the heat is killing me, somewhere with AC",
  "ideas to kill time before my train",
];

describe("the keyword list", () => {
  it.each(CLEAR)("clear distress is the card, with no model needed: %s", (t) => expect(careKeywords(t)).toBe("distress"));
  it.each(SADNESS)("ordinary sadness is gentle picks, never the card: %s", (t) => expect(careKeywords(t)).toBe("low"));
  it.each(FALSE_ALARMS)("everyday phrases never trigger it: %s", (t) => expect(careKeywords(t)).not.toBe("distress"));
  it("ordinary asks are nothing", () => {
    for (const t of ["pottery tonight", "free stuff this weekend", "something fun at home"]) expect(careKeywords(t)).toBe("none");
  });
});

describe("the model check", () => {
  it("settles only what the list can't, and errs toward the card", async () => {
    const model = vi.fn(async () => "none" as const);
    expect(await careCheck("i want to die", model)).toBe("distress");
    expect(model).not.toHaveBeenCalled();
    expect(await careCheck("everything is killing me lately", model)).toBe("none");
    expect(model).toHaveBeenCalledTimes(1);
    expect(await careCheck("everything is killing me lately", async () => "distress")).toBe("distress");
    expect(await careCheck("everything is killing me lately", async () => { throw new Error("down"); })).toBe("distress");
    expect(await careCheck("everything is killing me lately")).toBe("distress");
    expect(await careCheck("everything is killing me lately", async () => "maybe" as never)).toBe("distress");
    expect(await careCheck("I feel so depressed", async () => "low")).toBe("low");
  });
  it("asks Claude with no tools and no storage, and treats a bad answer as a failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ type: "message", stop_reason: "end_turn", content: [{ type: "text", text: '{"level":"none"}' }] })));
    const model = claudeCareModel({ apiKey: "k", model: "m", fetchImpl });
    expect(await model("this week is killing me")).toBe("none");
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.tools).toBeUndefined();
    expect(body.max_tokens).toBeLessThanOrEqual(50);
    fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await expect(model("x")).rejects.toThrow();
  });
});

describe("resources by country", () => {
  it("the US gets 988 (call or text) and 911; New York is the default", () => {
    expect(careCountry(null, null)).toBe(CARE_RESOURCES.US);
    expect(careCountry("Brooklyn", "America/New_York").resources.map((r) => r.href)).toEqual(["tel:988", "sms:988"]);
    expect(careCountry(null, null).emergency.href).toBe("tel:911");
  });
  it("other countries get their own line, and anywhere unlisted gets the helpline directory", () => {
    expect(careCountry("London", null).country).toBe("GB");
    expect(careCountry(null, "Australia/Sydney").country).toBe("AU");
    expect(careCountry("Lisbon", "Europe/Lisbon")).toBe(CARE_ELSEWHERE);
  });
  it("every link is tel:, sms: or https:, and the list says it isn't verified or expert reviewed yet", () => {
    for (const c of [...Object.values(CARE_RESOURCES), CARE_ELSEWHERE]) for (const r of [...c.resources, c.emergency]) expect(r.href).toMatch(/^(tel:\+?\d+|sms:\d+|https:\/\/)/);
    expect(VERIFIED_ON).toBeNull();
    expect(EXPERT_REVIEW).toBe("pending");
  });
});

describe("in the ask", () => {
  function deps(text: string) {
    const d: ScoutDeps = {
      settings: { enabled: true, hasKey: true, askHasKey: true, askEngine: "legacy", v3Testers: ["alice"], runsPerDay: 3, maxSearches: 3, restockSearches: 3, asksPerPerson: 6, asksPerDay: 200 },
      now: () => NOW, userId: async () => "alice", whoIs: async () => ({ guest: false, member: true }), ipHash: async () => null,
      db: { runsSince: async () => 0, startRun: async () => "forbidden", finishRun: async () => {}, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => false,
        profile: async () => input().profile, capability: async () => input().capability, signals: async () => [] },
      server: { claimSource: async () => null, claimAsk: vi.fn(async () => ({ askId: 7 })), claimFreeFollowUp: async () => false,
        finishRun: async () => {}, finishAsk: vi.fn(async () => {}), asksSince: async () => 1, trustedHosts: async () => [], corners: async () => [], existingKeys: async () => new Set(), insertPick: vi.fn(async () => true), insertPersonal: vi.fn(async () => true) },
      search: vi.fn(async () => ({ text: "<picks>[]</picks>", sourceLinks: new Set<string>(), searches: 1 })),
      v3: vi.fn(async (req) => runV3(req, { discovery: [{ id: "fixture", discover: async () => [candidate()] }] })),
      careModel: vi.fn(async () => "none" as const),
    };
    const req = new Request("https://example.org/scout", { method: "POST", body: JSON.stringify({ mode: "ask", ask: text }) });
    return { d, req };
  }
  it("clear distress: the care card, no picks, no ask used, nothing saved or logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { d, req } = deps("i don't want to be alive anymore");
    const body = await (await handleScout(req, d)).json();
    expect(body.care.line).toBe(CARE_LINE);
    expect(body.care.resources[0]).toMatchObject({ href: "tel:988" });
    expect(body.care.friend).toEqual({ label: "Message a friend", href: "/messages" });
    expect(body.picks).toBeUndefined();
    expect(d.server.claimAsk).not.toHaveBeenCalled();
    expect(d.server.finishAsk).not.toHaveBeenCalled();
    expect(d.server.insertPersonal).not.toHaveBeenCalled();
    expect(d.v3).not.toHaveBeenCalled();
    expect(d.search).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("ordinary sadness: gentle picks, and the trace records only that, never the words", async () => {
    const { d, req } = deps("feeling low, pottery tonight");
    const body = await (await handleScout(req, d)).json();
    expect(body.care).toBeUndefined();
    expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ gentle: true }));
    const trace = vi.mocked(d.server.finishAsk).mock.calls[0][1].trace as { gentle: boolean };
    expect(trace.gentle).toBe(true);
    expect(JSON.stringify(trace)).not.toMatch(/feeling low/);
  });
  it("a false alarm asks normally", async () => {
    const { d, req } = deps("this traffic is killing me, pottery tonight");
    const body = await (await handleScout(req, d)).json();
    expect(body.care).toBeUndefined();
    expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ gentle: false }));
  });
  it("legacy accounts aren't routed until the care step is expert reviewed", async () => {
    const { d, req } = deps("i want to die");
    d.settings = { ...d.settings, v3Testers: [] };
    const body = await (await handleScout(req, d)).json();
    expect(body.care).toBeUndefined();
  });
});
