// Stubby's scout: the request, from "is this allowed" to "these were saved". Three modes:
//
//   admin    (default) An admin presses Find picks. Runs as the admin, so the database's own
//            rules decide. Every find is a draft. A few runs a day, across all admins.
//   restock  The morning schedule. No sign-in: each call takes the next source not yet searched
//            today (claim_scout_source), and each source can only be searched once a day, so
//            calling it more often does nothing. Trusted pages publish, the rest are drafts.
//   ask      A signed-in person asks for something different. 3 a day each (claim_stubby_ask),
//            and a total for everyone. What Stubby finds is saved as their own picks, and also
//            added to the City picks for everyone (published from trusted pages, a draft from
//            anywhere else) with no trace of who asked or what they typed.
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
  type ScoutPick,
} from "./picks.ts";
import { SearchError, type SearchResult } from "./search.ts";

export const CITY = "new-york";
/** The morning restock fills this many days ahead. */
export const RESTOCK_DAYS = 7;
/** A person's ask returns at most this many. */
export const ASK_MAX_PICKS = 6;
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
    corners(): Promise<{ id: number; name: string }[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    insertPick(row: CityRow): Promise<boolean>;
    insertPersonal(row: PersonalRow): Promise<boolean>;
  };
  search(r: SearchRequest): Promise<SearchResult>;
}

export interface ScoutReport {
  added: number;
  found: number;
  searches: number;
  dropped: Dropped[];
}

/** What a person gets back from an ask: their new picks, soonest first. */
export interface AskReport {
  picks: { title: string; place: string | null; startsAt: string; endsAt: string | null; price: string | null; url: string; note: string | null }[];
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

  let body: { mode?: unknown; focus?: unknown; ask?: unknown } = {};
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
  if (mode === "ask") return ask(deps, userId, body.ask);
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

async function ask(deps: ScoutDeps, userId: string, raw: unknown): Promise<Response> {
  // Their own words, one plain line. Double quotes become single so the prompt stays one quote.
  const text = cleanText(raw).replace(/"/g, "'").slice(0, 200);
  if (text.length < 2) return fail(400, "Say what you're after, like pottery on Saturday.");

  const { asksPerPerson, asksPerDay } = deps.settings;
  const askId = await deps.server.claimAsk(userId, asksPerPerson, asksPerDay);
  if (askId === null) {
    return fail(429, `That's your ${asksPerPerson} for today. Stubby can look again tomorrow.`);
  }

  const now = deps.now();
  let found = 0;
  try {
    const corners = await deps.server.corners();
    const result = await deps.search({
      focus: null,
      ask: text,
      cornerNames: corners.map((c) => c.name),
      maxSearches: deps.settings.maxSearches,
      maxPicks: ASK_MAX_PICKS,
    });
    const rawPicks = readPicksBlock(result.text);
    if (!rawPicks) throw new SearchError("Stubby couldn't read what he found. Try asking another way.", 502);
    found = rawPicks.length;
    // For this person, nothing is "already a City pick": they get everything that checks out.
    const { kept } = checkPicks(rawPicks, { now, maxPicks: ASK_MAX_PICKS, sourceLinks: result.sourceLinks, corners: cornerMap(corners), existing: new Set() });

    const mine: ScoutPick[] = [];
    for (const p of kept) if (await deps.server.insertPersonal(personalRowFor(p, userId))) mine.push(p);

    // Shared with everyone, without who asked: published from a trusted page, a draft otherwise.
    const hosts = await deps.server.trustedHosts();
    const existing = await deps.server.existingKeys(now - DAY_MS, now + (SCOUT_DAYS + 1) * DAY_MS);
    for (const [i, p] of kept.entries()) {
      if (existing.has(pickKey(p.title, p.startsAt))) continue;
      await deps.server.insertPick(rowFor(p, i, CITY, now, isTrusted(p.url, hosts))).catch(() => false);
    }

    await deps.server.finishAsk(askId, { found, added: mine.length, failed: false });
    const report: AskReport = {
      picks: kept.map((p) => ({
        title: p.title,
        place: p.place,
        startsAt: new Date(p.startsAt).toISOString(),
        endsAt: p.endsAt === null ? null : new Date(p.endsAt).toISOString(),
        price: p.price,
        url: p.url,
        note: p.note,
      })),
      asksLeft: Math.max(0, asksPerPerson - (await deps.server.asksSince(userId, now - DAY_MS))),
    };
    return json(200, report);
  } catch (e) {
    await deps.server.finishAsk(askId, { found, added: 0, failed: true }).catch(() => undefined);
    return fail(statusOf(e), message(e, "Something went wrong. Try again in a bit."));
  }
}

const cornerMap = (corners: { id: number; name: string }[]) => new Map(corners.map((c) => [c.name.trim().toLowerCase(), c.id]));

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
