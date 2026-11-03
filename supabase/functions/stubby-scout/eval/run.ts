// Runs Stubby's scenario set (scenarios.ts) end to end through the real handler, with a fake search
// that returns each scenario's candidates and a fake database that records what would be saved.
// Every scenario is checked against every hard rule in code (Part G2), then against its own written
// expectations. Pure apart from the handler's own work: no network, no database.

import { handleScout, EMPTY_PROFILE, type ScoutDeps } from "../handler.ts";
import { freeByNature, lowestPrice, sameThing } from "../ask.ts";
import { STUBBY_CONFIG } from "../config.ts";
import type { DecisionTrace } from "../contract.ts";
import { linkKey, nyLocalToMs, type Dropped, type RawPick } from "../picks.ts";
import { SCENARIOS, type Group, type Scenario } from "./scenarios.ts";

const DEFAULT_NOW = "2026-11-01T17:00";
const ADULT = /\b(brewery|breweries|bars?|pubs?|21\+|tasting|tastings|wine|beer|cocktails?|happy hour)\b/i;
const nyHour = (ms: number) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));

interface Pick {
  kind: "event" | "idea";
  title: string;
  startsAt: string;
  price: string | null;
  url: string;
  after: boolean;
}

export interface ScenarioResult {
  id: string;
  group: Group;
  pass: boolean;
  /** Hard rules broken. Any one fails the PR. */
  hard: string[];
  /** Written expectations not met. */
  expectations: string[];
  /** The decision trace that would be saved with the ask, if one was. */
  trace?: DecisionTrace;
}

/** One scenario through the handler: the question or the deck, and what would be saved with the ask. */
export async function runScenario(s: Scenario): Promise<ScenarioResult> {
  const now = nyLocalToMs(s.now ?? DEFAULT_NOW);
  const saved: Record<string, unknown>[] = [];
  const personal: Record<string, unknown>[] = [];
  const links = s.candidates.map((c) => c.url).filter((u): u is string => typeof u === "string" && u.startsWith("https://"));
  let round = 0;
  const pursuits = (s.sooshLinks ?? []).filter((l) => l.startsWith("/pursuit/")).map((l) => ({ id: l.slice("/pursuit/".length), title: "Pottery" }));
  const d: ScoutDeps = {
    settings: { enabled: true, hasKey: true, runsPerDay: 3, maxSearches: 5, restockSearches: 3, asksPerPerson: 3, asksPerDay: 200 },
    now: () => now,
    userId: async () => "eval-user",
    // A member with a 21+ birthdate on file: the scenarios are about the deck, not who may ask.
    whoIs: async () => ({ guest: false, member: true, adult21: true }),
    db: {
      runsSince: async () => 0,
      startRun: async () => 1,
      finishRun: async () => undefined,
      corners: async () => [],
      existingKeys: async () => new Set(),
      insertPick: async () => true,
      profile: async () => ({ ...EMPTY_PROFILE, monthlyBudget: s.profile?.monthlyBudget ?? null, windows: [...(s.profile?.windows ?? [])], pursuits, picks: (s.sooshLinks ?? []).filter((l) => l.startsWith("/start/")).map((l) => l.slice("/start/".length)) }),
    },
    server: {
      claimSource: async () => null,
      claimAsk: async () => 1,
      claimFreeFollowUp: async () => false,
      finishRun: async () => undefined,
      finishAsk: async (_id, r) => void saved.push(r as Record<string, unknown>),
      asksSince: async () => 1,
      trustedHosts: async () => [],
      corners: async () => [
        { id: 7, name: "Pottery", spaceSlug: "crafts", slug: "pottery" },
        { id: 8, name: "Running", spaceSlug: "sports-fitness", slug: "running" },
      ],
      existingKeys: async () => new Set(),
      insertPick: async () => true,
      insertPersonal: async (row) => void personal.push(row as Record<string, unknown>) || true,
    },
    // The first round finds the scenario's candidates; a second round finds nothing more.
    search: async () => {
      round += 1;
      const found = round === 1 ? s.candidates : [];
      return { text: `<picks>${JSON.stringify(found)}</picks>`, sourceLinks: new Set(links.map((l) => linkKey(l)!).filter(Boolean)), searches: 1 };
    },
  };
  const req = new Request("https://fn.example.com/stubby-scout", { method: "POST", headers: { authorization: "Bearer x" }, body: JSON.stringify({ mode: "ask", ask: s.ask, questions: true, ...(s.answers ? { answers: s.answers } : {}) }) });
  const body = (await (await handleScout(req, d)).json()) as { question?: string; picks?: Pick[]; outcome?: string; dropped?: Dropped[] };

  const hard: string[] = [];
  const exp: string[] = [];
  const e = s.expect;
  if (e.question !== undefined && (body.question ?? null) !== e.question) exp.push(`question ${body.question ?? "none"}, expected ${e.question ?? "none"}`);
  // A question nobody expected means the deck was never checked: that fails, never a silent pass.
  else if (e.question === undefined && body.question) exp.push(`asked ${body.question} before searching, and the scenario expected a deck`);
  if (body.question) return { id: s.id, group: s.group, pass: hard.length + exp.length === 0, hard, expectations: exp, trace: saved[0]?.trace as DecisionTrace | undefined };

  const picks = body.picks ?? [];
  const dropped = body.dropped ?? [];
  const trace = saved[0]?.trace as DecisionTrace | undefined;
  const contract = trace?.contract;

  // ── hard rules, on every scenario ─────────────────────────────────────────────────
  const ask = s.ask.toLowerCase();
  const typedFree = contract?.budget.strength === "hard" && contract.budget.value?.free;
  const typedMax = contract?.budget.strength === "hard" && contract.budget.value && !contract.budget.value.free ? contract.budget.value.max : null;
  const byTitle = new Map(s.candidates.map((c) => [String(c.title), c]));
  const seen = new Set<string>();
  for (const p of picks) {
    const low = lowestPrice(p.price);
    if (typedFree && low !== 0) hard.push(`"${p.title}" isn't free, and free was asked for`);
    if (typedMax !== null && low !== null && low > typedMax) hard.push(`"${p.title}" is over the $${typedMax} asked for`);
    const start = Date.parse(p.startsAt);
    const w = contract?.timeWindow;
    if (w?.strength === "hard" && w.value && !p.after && (start < w.value.startMs || start >= w.value.endMs)) hard.push(`"${p.title}" is outside the time asked for`);
    if (contract?.setting.value === "in" && contract.setting.strength === "hard" && p.kind === "event") hard.push(`"${p.title}" is an event, and they want to stay in`);
    if (!ADULT.test(ask) && ADULT.test(p.title)) hard.push(`"${p.title}" is a bar or 21+, and wasn't asked for`);
    if (contract?.company.value === "family" && nyHour(start) >= 20) hard.push(`"${p.title}" is too late for a family`);
    const k = `${sameThing(p.title)}|${start}`;
    if (seen.has(k)) hard.push(`"${p.title}" is shown twice`);
    seen.add(k);
    // No unsupported claims: "Free" only when the page said so, or it's free by nature.
    const raw = byTitle.get(p.title) as RawPick | undefined;
    if (p.price === "Free" && raw && (raw.price === null || raw.price === undefined) && !freeByNature(p.kind, p.title, typeof raw.place === "string" ? raw.place : null, p.url.startsWith("/"))) hard.push(`"${p.title}" claims free with no evidence`);
  }
  for (const x of dropped) if (/^Price not listed/.test(x.reason) && x.key !== "noprice") hard.push(`"${x.title}": no price was given the reason ${x.key}`);
  // Never the ask's text, anywhere it's saved.
  if (JSON.stringify(saved).toLowerCase().includes(ask) || JSON.stringify(personal).toLowerCase().includes(ask)) hard.push("the ask's text was saved");
  if (trace && trace.version !== STUBBY_CONFIG.version) hard.push(`the trace has version ${trace.version}`);
  if (!trace) hard.push("no decision trace was saved");

  // ── this scenario's own expectations ──────────────────────────────────────────────
  const titles = picks.map((p) => p.title);
  if (e.outcome && body.outcome !== e.outcome) exp.push(`outcome ${body.outcome}, expected ${e.outcome}`);
  if (e.kept && JSON.stringify(titles) !== JSON.stringify(e.kept)) exp.push(`kept ${JSON.stringify(titles)}, expected ${JSON.stringify(e.kept)}`);
  for (const t of e.includes ?? []) if (!titles.includes(t)) exp.push(`"${t}" isn't kept`);
  for (const t of e.excludes ?? []) if (titles.includes(t)) exp.push(`"${t}" is kept`);
  for (const k of e.droppedKeys ?? []) if (!dropped.some((x) => x.key === k)) exp.push(`nothing was dropped as ${k}`);
  for (const [field, want] of Object.entries(e.contract ?? {})) {
    const got = contract?.[field as keyof typeof e.contract];
    if (!got) {
      exp.push(`no contract ${field}`);
      continue;
    }
    if (want.from !== undefined && got.from !== want.from) exp.push(`${field} from ${got.from}, expected ${want.from}`);
    if (want.strength !== undefined && got.strength !== want.strength) exp.push(`${field} is ${got.strength}, expected ${want.strength}`);
  }
  return { id: s.id, group: s.group, pass: hard.length + exp.length === 0, hard, expectations: exp, trace };
}

/** The whole set, and a table by group: what every PR reports from PR 7 on. */
export async function runAll(scenarios: readonly Scenario[] = SCENARIOS) {
  const results: ScenarioResult[] = [];
  for (const s of scenarios) results.push(await runScenario(s));
  const groups = new Map<Group, { passed: number; total: number; hard: number }>();
  for (const r of results) {
    const g = groups.get(r.group) ?? { passed: 0, total: 0, hard: 0 };
    g.total += 1;
    if (r.pass) g.passed += 1;
    g.hard += r.hard.length;
    groups.set(r.group, g);
  }
  const table = [...groups.entries()].map(([group, g]) => `${group}: ${g.passed}/${g.total} pass, ${g.hard} hard rule failures`).join("\n");
  return { results, groups, table };
}
