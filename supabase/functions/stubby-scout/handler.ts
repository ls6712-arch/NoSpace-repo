// Stubby's scout: the request, from "is this allowed" to "these were saved". Three modes:
//
//   admin    (default) An admin presses Find picks. Runs as the admin, so the database's own
//            rules decide. Every find is a draft. A few runs a day, across all admins.
//   restock  The morning schedule. No sign-in: each call takes the next source not yet searched
//            today (claim_scout_source), and each source can only be searched once a day, so
//            calling it more often does nothing. Trusted pages publish, the rest are drafts.
//   ask      A signed-in person asks. 3 a day each (claim_stubby_ask), and a total for everyone.
//            The ask is read in code first (intent.ts: when, who, budget, what), with their own
//            profile read as them (picked Corners, free time, budget, neighborhood, passes,
//            Pursuits). The search is told who is coming and what fits them (askPrompt.ts), and
//            every pick is checked in code (ask.ts): the time asked for, the event's own page, no
//            21+ unless asked, the budget, ideas only in their Corners. The best 3 (at most 5)
//            are saved as their own picks, with a why line each. Events are also added to the
//            City picks for everyone (published from trusted pages, a draft otherwise) with no
//            trace of who asked or what they typed; ideas never are.
//
// Everything outside (database, search, clock, settings) comes in through ScoutDeps, so every
// path is tested without a network (stubby-scout.test.ts).

import {
  checkPicks,
  cleanText,
  isTrusted,
  personalRowFor,
  pickKey,
  readPicksBlock,
  rowFor,
  SCOUT_DAYS,
  type Dropped,
} from "./picks.ts";
import { SearchError, type SearchResult } from "./search.ts";
import { askRowFor, checkAskPicks, type AskPick } from "./ask.ts";
import { askSystemPrompt, askUserPrompt, type AboutPerson } from "./askPrompt.ts";
import { readIntent, searchWindow, type Answers, type Intent, type Who } from "./intent.ts";

export const CITY = "new-york";
/** The morning restock fills this many days ahead. */
export const RESTOCK_DAYS = 7;
/** How far ahead "the soonest after tonight" may go. */
const AFTER_DAYS = 7;
const DAY_MS = 24 * 3_600_000;

export interface ScoutSettings {
  enabled: boolean;
  hasKey: boolean;
  runsPerDay: number;
  maxSearches: number;
  restockSearches: number;
  asksPerPerson: number;
  asksPerDay: number;
}

export interface Source {
  runId: number;
  name: string;
  focus: string;
  searchDomain: string | null;
  trustedHost: string | null;
}

export interface SearchRequest {
  focus: string | null;
  cornerNames: string[];
  maxSearches: number;
  allowedDomains?: string[];
  days?: number;
  maxPicks?: number;
  ask?: string | null;
  /** A person's ask, fully written: used in place of the scout's own prompts. */
  prompt?: { system: string; user: string } | null;
}

/** What the edge function reads about the person who asks, as them (their own rows only). */
export interface PersonProfile {
  /** Corner keys, "space-slug/corner-slug". */
  picks: string[];
  /** The usual week: "sat-eve" and the like. */
  windows: string[];
  monthlyBudget: number | null;
  city: string | null;
  area: string | null;
  passes: { label: string; place: string | null }[];
  /** Their own Pursuits that are going (not finished, paused, let go, archived or a one-off plan). */
  pursuits: { id: string; title: string }[];
}

export const EMPTY_PROFILE: PersonProfile = { picks: [], windows: [], monthlyBudget: null, city: null, area: null, passes: [], pursuits: [] };

export interface CornerRow {
  id: number;
  name: string;
  spaceSlug?: string;
  slug?: string;
}

type CityRow = ReturnType<typeof rowFor>;
type PersonalRow = ReturnType<typeof personalRowFor>;

export interface ScoutDeps {
  settings: ScoutSettings;
  now: () => number;
  /** The signed-in person's id from their token (checked with Supabase Auth), or null. */
  userId(): Promise<string | null>;
  /** As the signed-in caller: the database's own rules apply (admins only). */
  db: {
    runsSince(ms: number): Promise<number>;
    /** The new run's id, or "forbidden" when the caller isn't an admin. */
    startRun(focus: string | null): Promise<number | "forbidden">;
    finishRun(id: number, r: { searches: number; found: number; added: number; error: string | null }): Promise<void>;
    corners(): Promise<{ id: number; name: string }[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    /** True when saved, false when it was already there (the unique index). */
    insertPick(row: CityRow): Promise<boolean>;
    /** The caller's own profile, Corners, passes and Pursuits. Read as them. */
    profile(userId: string): Promise<PersonProfile>;
  };
  /** As the server: only for the restock and asks, after their own checks. */
  server: {
    claimSource(): Promise<Source | null>;
    claimAsk(userId: string, perPerson: number, perDay: number): Promise<number | null>;
    finishRun(id: number, r: { searches: number; found: number; added: number; error: string | null }): Promise<void>;
    finishAsk(id: number, r: { found: number; added: number; failed: boolean }): Promise<void>;
    /** How many asks this person has made since `ms`. */
    asksSince(userId: string, ms: number): Promise<number>;
    trustedHosts(): Promise<string[]>;
    corners(): Promise<CornerRow[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    insertPick(row: CityRow): Promise<boolean>;
    insertPersonal(row: PersonalRow | ReturnType<typeof askRowFor>): Promise<boolean>;
  };
  search(r: SearchRequest): Promise<SearchResult>;
}

export interface ScoutReport {
  added: number;
  found: number;
  searches: number;
  dropped: Dropped[];
}

/** What a person gets back from an ask: their new picks, best fit first. */
export interface AskReport {
  picks: {
    kind: "event" | "idea";
    title: string;
    place: string | null;
    startsAt: string;
    endsAt: string | null;
    price: string | null;
    url: string;
    note: string | null;
    why: string | null;
    betterWithFriend: boolean;
    after: boolean;
  }[];
  /** found: picks in the time asked for; after: nothing fit tonight, these are the soonest after; nothing. */
  outcome: "found" | "after" | "nothing";
  /** What Stubby understood, for the chips. */
  understood: { when: string | null; who: Who | null; budget: number | null; free: boolean };
  dropped: Dropped[];
  asksLeft: number;
}

/** Answered instead of searching when one thing worth a question is missing, and the app asked to be asked. No ask is used. */
export interface AskQuestion {
  question: "who" | "when" | "what";
  asksLeft: number;
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (status: number, error: string) => json(status, { error });
const message = (e: unknown, fallback: string) => (e instanceof SearchError ? e.message : fallback);
const statusOf = (e: unknown) => (e instanceof SearchError ? e.status : 500);

export async function handleScout(req: Request, deps: ScoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "Use POST.");

  let body: { mode?: unknown; focus?: unknown; ask?: unknown; answers?: unknown; questions?: unknown } = {};
  try {
    body = ((await req.json()) ?? {}) as typeof body;
  } catch {
    body = {};
  }
  const mode = body.mode === "restock" || body.mode === "ask" ? body.mode : "admin";

  if (!deps.settings.enabled) return fail(503, "The scout is switched off.");
  if (!deps.settings.hasKey) return fail(503, "The scout has no search key yet.");

  if (mode === "restock") return restock(deps);

  const userId = await deps.userId();
  if (!userId) return fail(401, "Sign in first.");
  if (mode === "ask") return ask(deps, userId, body.ask, readAnswers(body.answers), body.questions === true);
  return admin(deps, cleanText(body.focus).slice(0, 200) || null);
}

// ── admin: Find picks ─────────────────────────────────────────────────────

async function admin(deps: ScoutDeps, focus: string | null): Promise<Response> {
  const now = deps.now();
  const used = await deps.db.runsSince(now - DAY_MS);
  if (used >= deps.settings.runsPerDay) {
    return fail(429, `The scout has run ${deps.settings.runsPerDay} times in the last day. Try again tomorrow.`);
  }
  const runId = await deps.db.startRun(focus);
  if (runId === "forbidden") return fail(403, "This is for whoever manages City picks.");

  let searches = 0;
  let found = 0;
  try {
    const corners = await deps.db.corners();
    const result = await deps.search({ focus, cornerNames: corners.map((c) => c.name), maxSearches: deps.settings.maxSearches });
    searches = result.searches;
    const raw = readPicksBlock(result.text);
    if (!raw) throw new SearchError("The scout's answer couldn't be read. Nothing was saved.", 502);
    found = raw.length;
    const existing = await deps.db.existingKeys(now - DAY_MS, now + (SCOUT_DAYS + 1) * DAY_MS);
    const { kept, dropped } = checkPicks(raw, { now, sourceLinks: result.sourceLinks, corners: cornerMap(corners), existing });
    let added = 0;
    for (const [i, p] of kept.entries()) {
      if (await deps.db.insertPick(rowFor(p, i, CITY, now))) added += 1;
      else dropped.push({ title: p.title, reason: "Already a City pick." });
    }
    await deps.db.finishRun(runId, { searches, found, added, error: null });
    const report: ScoutReport = { added, found, searches, dropped };
    return json(200, report);
  } catch (e) {
    const m = message(e, "Something went wrong. Nothing more was saved.");
    await deps.db.finishRun(runId, { searches, found, added: 0, error: m }).catch(() => undefined);
    return fail(statusOf(e), m);
  }
}

// ── restock: the morning schedule ─────────────────────────────────────────

async function restock(deps: ScoutDeps): Promise<Response> {
  const source = await deps.server.claimSource();
  if (!source) return json(200, { done: true });

  const now = deps.now();
  let searches = 0;
  let found = 0;
  try {
    const corners = await deps.server.corners();
    const result = await deps.search({
      focus: source.focus,
      cornerNames: corners.map((c) => c.name),
      maxSearches: deps.settings.restockSearches,
      allowedDomains: source.searchDomain ? [source.searchDomain] : undefined,
      days: RESTOCK_DAYS,
    });
    searches = result.searches;
    const raw = readPicksBlock(result.text);
    if (!raw) throw new SearchError("The scout's answer couldn't be read. Nothing was saved.", 502);
    found = raw.length;
    const existing = await deps.server.existingKeys(now - DAY_MS, now + (RESTOCK_DAYS + 1) * DAY_MS);
    const { kept, dropped } = checkPicks(raw, { now, days: RESTOCK_DAYS, sourceLinks: result.sourceLinks, corners: cornerMap(corners), existing });
    const trusted = source.trustedHost ? [source.trustedHost] : [];
    let added = 0;
    let published = 0;
    for (const [i, p] of kept.entries()) {
      const live = isTrusted(p.url, trusted);
      if (await deps.server.insertPick(rowFor(p, i, CITY, now, live))) {
        added += 1;
        if (live) published += 1;
      } else dropped.push({ title: p.title, reason: "Already a City pick." });
    }
    await deps.server.finishRun(source.runId, { searches, found, added, error: null });
    return json(200, { source: source.name, added, published, found, searches, dropped });
  } catch (e) {
    const m = message(e, "Something went wrong. Nothing more was saved.");
    await deps.server.finishRun(source.runId, { searches, found, added: 0, error: m }).catch(() => undefined);
    return fail(statusOf(e), m);
  }
}

// ── ask: one person wants something different ─────────────────────────────

const WHO_VALUES: readonly Who[] = ["solo", "partner", "friends", "family"];
const WHEN_VALUES = ["tonight", "tomorrow", "weekend"] as const;

/** The person's answer to Stubby's one question, if they gave one. Anything else is ignored. */
function readAnswers(v: unknown): Answers | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  const out: Answers = {};
  if (typeof a.who === "string" && (WHO_VALUES as readonly string[]).includes(a.who)) out.who = a.who as Who;
  if (typeof a.when === "string" && (WHEN_VALUES as readonly string[]).includes(a.when)) out.when = a.when as Answers["when"];
  return out.who || out.when ? out : null;
}

const DAY_WORDS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const SLOT_WORDS: Record<string, string> = { day: "daytime", eve: "evening" };
/** "sat-eve" to "Saturday evening". Anything else is left out. */
export function windowWords(windows: readonly string[]): string[] {
  return windows.flatMap((w) => {
    const [d, s] = w.split("-");
    return DAY_WORDS[d] && SLOT_WORDS[s] ? [`${DAY_WORDS[d]} ${SLOT_WORDS[s]}`] : [];
  });
}

const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

/** What the prompt says about the person, and the Soosh pages an idea may link to. */
export function aboutPerson(profile: PersonProfile, picked: CornerRow[]): AboutPerson {
  const sooshPages: AboutPerson["sooshPages"] = [];
  for (const c of picked) {
    if (c.spaceSlug && c.slug && SAFE_SLUG.test(c.spaceSlug) && SAFE_SLUG.test(c.slug)) sooshPages.push({ label: `${c.name}, how to start`, url: `/start/${c.spaceSlug}/${c.slug}` });
  }
  for (const p of profile.pursuits.slice(0, 10)) {
    if (SAFE_SLUG.test(p.id)) sooshPages.push({ label: `Their Pursuit: ${cleanText(p.title).replace(/"/g, "'").slice(0, 80)}`, url: `/pursuit/${p.id}` });
  }
  return {
    corners: picked.map((c) => c.name),
    freeTimes: windowWords(profile.windows),
    neighborhood: cleanText(profile.area).slice(0, 60) || null,
    city: cleanText(profile.city).slice(0, 60) || null,
    passes: profile.passes.slice(0, 10).map((p) => cleanText(p.place ? `${p.label} (${p.place})` : p.label).replace(/"/g, "'").slice(0, 80)).filter(Boolean),
    sooshPages,
  };
}

const understoodOf = (intent: Intent): AskReport["understood"] => ({
  when: intent.when?.label ?? null,
  who: intent.who,
  budget: intent.budget ? intent.budget.max : null,
  free: intent.budget?.free ?? false,
});

async function ask(deps: ScoutDeps, userId: string, raw: unknown, answers: Answers | null, questions: boolean): Promise<Response> {
  // Their own words, one plain line. Double quotes become single so the prompt stays one quote.
  const text = cleanText(raw).replace(/"/g, "'").slice(0, 200);
  if (text.length < 2) return fail(400, "Say what you're after, like pottery on Saturday.");

  const now = deps.now();
  const { asksPerPerson, asksPerDay } = deps.settings;
  // Read as them, from their own rows only. Best effort: without it, he still searches.
  const profile = await deps.db.profile(userId).catch(() => EMPTY_PROFILE);
  const corners = await deps.server.corners();
  const byKey = new Map(corners.filter((c) => c.spaceSlug && c.slug).map((c) => [`${c.spaceSlug}/${c.slug}`, c]));
  const picked = profile.picks.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
  const intent = readIntent(text, { now, windows: profile.windows, monthlyBudget: profile.monthlyBudget, cornerNames: picked.map((c) => c.name), answers });

  // One question first, when the app can ask it and something worth asking is missing. No ask is used.
  if (questions && intent.missing) {
    const left = Math.max(0, asksPerPerson - (await deps.server.asksSince(userId, now - DAY_MS)));
    const q: AskQuestion = { question: intent.missing, asksLeft: left };
    return json(200, q);
  }

  const askId = await deps.server.claimAsk(userId, asksPerPerson, asksPerDay);
  if (askId === null) return fail(429, `That's ${asksPerPerson} for today. I'll look again tomorrow.`);

  let found = 0;
  try {
    const window = searchWindow(intent, now);
    const person = aboutPerson(profile, picked);
    const result = await deps.search({
      focus: null,
      ask: text,
      cornerNames: corners.map((c) => c.name),
      maxSearches: deps.settings.maxSearches,
      prompt: { system: askSystemPrompt(), user: askUserPrompt(text, intent, window, person, now) },
    });
    const rawPicks = readPicksBlock(result.text);
    if (!rawPicks) throw new SearchError("Stubby couldn't read what he found. Try asking another way.", 502);
    found = rawPicks.length;
    const { kept, dropped, outcome } = checkAskPicks(rawPicks, {
      now,
      intent,
      window,
      sourceLinks: result.sourceLinks,
      sooshLinks: new Set(person.sooshPages.map((p) => p.url)),
      corners: cornerMap(corners),
      pickedCornerIds: new Set(picked.map((c) => c.id)),
      askText: text,
      latestMs: window.endMs + AFTER_DAYS * DAY_MS,
    });

    const mine: AskPick[] = [];
    for (const [rank, p] of kept.entries()) if (await deps.server.insertPersonal(askRowFor(p, userId, askId, rank))) mine.push(p);

    // Shared with everyone, without who asked: events only, never ideas. Published from a trusted page, a draft otherwise.
    const events = kept.filter((p) => p.kind === "event");
    if (events.length) {
      const hosts = await deps.server.trustedHosts();
      const existing = await deps.server.existingKeys(now - DAY_MS, now + (SCOUT_DAYS + 1) * DAY_MS);
      for (const [i, p] of events.entries()) {
        if (existing.has(pickKey(p.title, p.startsAt))) continue;
        await deps.server.insertPick(rowFor(p, i, CITY, now, isTrusted(p.url, hosts))).catch(() => false);
      }
    }

    await deps.server.finishAsk(askId, { found, added: mine.length, failed: false });
    const report: AskReport = {
      picks: kept.map((p) => ({
        kind: p.kind,
        title: p.title,
        place: p.place,
        startsAt: new Date(p.startsAt).toISOString(),
        endsAt: p.endsAt === null ? null : new Date(p.endsAt).toISOString(),
        price: p.price,
        url: p.url,
        note: p.note,
        why: p.why,
        betterWithFriend: p.betterWithFriend,
        after: p.after,
      })),
      outcome,
      understood: understoodOf(intent),
      dropped,
      asksLeft: Math.max(0, asksPerPerson - (await deps.server.asksSince(userId, now - DAY_MS))),
    };
    return json(200, report);
  } catch (e) {
    await deps.server.finishAsk(askId, { found, added: 0, failed: true }).catch(() => undefined);
    return fail(statusOf(e), message(e, "Something went wrong. Try again in a bit."));
  }
}

const cornerMap = (corners: readonly { id: number; name: string }[]) => new Map(corners.map((c) => [c.name.trim().toLowerCase(), c.id]));

/** The settings from the environment, clamped so a typo can't open the tap. */
export function readSettings(env: (k: string) => string | undefined): ScoutSettings {
  const int = (k: string, dflt: number, max: number) => {
    const n = Number.parseInt(env(k) ?? "", 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : dflt;
  };
  return {
    enabled: env("STUBBY_SCOUT_ENABLED") === "true",
    hasKey: !!env("ANTHROPIC_API_KEY"),
    runsPerDay: int("STUBBY_SCOUT_RUNS_PER_DAY", 3, 20),
    maxSearches: int("STUBBY_SCOUT_MAX_SEARCHES", 5, 20),
    restockSearches: int("STUBBY_RESTOCK_SEARCHES", 3, 10),
    asksPerPerson: int("STUBBY_ASKS_PER_PERSON", 3, 20),
    asksPerDay: int("STUBBY_ASKS_PER_DAY", 200, 5000),
  };
}

export { pickKey };
