// Stubby's scout: the request, from "who is asking and may they" to "these picks were saved".
// Everything outside (auth, database, search, clock, settings) comes in through ScoutDeps, so
// the whole flow is tested without a network (stubby-scout.test.ts).
//
// Three callers:
//   sweep  - the morning cron job, with the sweep token in x-scout-sweep. Sweeps the one watch
//            that has waited longest and not run in 20 hours.
//   member - any signed-in member asking for something ("pottery this weekend"). 3 a day each.
//   admin  - the City picks page. A few a day.
// Every kind counts toward one daily limit across the whole app, checked before anything is
// paid for. Clean finds go live; finds with a note wait for an admin (picks.ts: publishable).

import { checkPicks, cleanText, pickKey, publishable, readPicksBlock, rowFor, SCOUT_DAYS, type Dropped } from "./picks.ts";
import { SearchError, type SearchResult } from "./search.ts";

export const CITY = "new-york";
const DAY = 24 * 3_600_000;

export type RunKind = "admin" | "sweep" | "member";

export interface ScoutSettings {
  enabled: boolean;
  hasKey: boolean;
  /** Admin runs a day. */
  runsPerDay: number;
  /** Asks a day per member. */
  memberPerDay: number;
  /** All runs a day, every kind together. */
  dailyLimit: number;
  /** Searches in one admin run. */
  maxSearches: number;
  sweepSearches: number;
  memberSearches: number;
}

export interface Caller {
  id: string;
  isAdmin: boolean;
}

export interface FoundPick {
  title: string;
  startsAt: string;
  place: string | null;
  price: string | null;
  url: string;
  live: boolean;
}

export interface ScoutDeps {
  settings: ScoutSettings;
  now: () => number;
  auth: {
    sweepTokenOk(token: string): Promise<boolean>;
    /** The signed-in caller from the Authorization header, or null. */
    caller(): Promise<Caller | null>;
  };
  db: {
    runsSince(ms: number, filter?: { kind?: RunKind; userId?: string }): Promise<number>;
    startRun(r: { kind: RunKind; focus: string | null; startedBy: string | null; watchId: number | null }): Promise<number>;
    finishRun(id: number, r: { searches: number; found: number; added: number; error: string | null }): Promise<void>;
    /** The active watch that has waited longest and not run in 20 hours, or null. */
    nextWatch(): Promise<{ id: number; query: string } | null>;
    markWatch(id: number): Promise<void>;
    corners(): Promise<{ id: number; name: string }[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    /** True when saved, false when it was already there (the unique index). */
    insertPick(row: ReturnType<typeof rowFor>): Promise<boolean>;
  };
  search(focus: string | null, cornerNames: string[], maxSearches: number): Promise<SearchResult>;
}

export interface ScoutReport {
  added: number;
  live: number;
  found: number;
  searches: number;
  dropped: Dropped[];
  picks: FoundPick[];
  /** A sweep with nothing waiting. */
  idle?: boolean;
  /** A member's asks left today. */
  asksLeft?: number;
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (status: number, error: string) => json(status, { error });

export const MESSAGES = {
  off: "Stubby isn't looking right now. Try again later.",
  signIn: "Sign in first.",
  notAdmin: "This is for whoever manages City picks.",
  noFocus: "Say what you're in the mood for.",
  memberCap: (n: number) => `That's your ${n} asks for today. Stubby will look again tomorrow.`,
  adminCap: (n: number) => `The scout has run ${n} times in the last day. Try again tomorrow.`,
  dailyCap: "Stubby has looked enough for today. Try again tomorrow.",
  unreadable: "The scout's answer couldn't be read. Nothing was saved.",
  failed: "Something went wrong. Nothing more was saved.",
} as const;

export async function handleScout(req: Request, deps: ScoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "Use POST.");
  if (!deps.settings.enabled || !deps.settings.hasKey) return fail(503, MESSAGES.off);

  let body: { mode?: unknown; focus?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const now = deps.now();
  const s = deps.settings;

  // ── who is asking ──
  let kind: RunKind;
  let caller: Caller | null = null;
  let focus = cleanText(body.focus).slice(0, 200) || null;
  let watchId: number | null = null;
  let maxSearches: number;

  const token = req.headers.get("x-scout-sweep");
  if (token) {
    if (!(await deps.auth.sweepTokenOk(token))) return fail(401, MESSAGES.signIn);
    kind = "sweep";
    maxSearches = s.sweepSearches;
  } else {
    if (!req.headers.get("authorization")) return fail(401, MESSAGES.signIn);
    caller = await deps.auth.caller();
    if (!caller) return fail(401, MESSAGES.signIn);
    if (body.mode === "member") {
      kind = "member";
      maxSearches = s.memberSearches;
      focus = focus ? focus.slice(0, 120) : null;
      if (!focus) return fail(400, MESSAGES.noFocus);
    } else {
      if (!caller.isAdmin) return fail(403, MESSAGES.notAdmin);
      kind = "admin";
      maxSearches = s.maxSearches;
    }
  }

  // ── limits, before anything is paid for ──
  let asksLeft: number | undefined;
  if (kind === "member") {
    const used = await deps.db.runsSince(now - DAY, { kind: "member", userId: caller!.id });
    if (used >= s.memberPerDay) return fail(429, MESSAGES.memberCap(s.memberPerDay));
    asksLeft = s.memberPerDay - used - 1;
  }
  if (kind === "admin" && (await deps.db.runsSince(now - DAY, { kind: "admin" })) >= s.runsPerDay) {
    return fail(429, MESSAGES.adminCap(s.runsPerDay));
  }
  if ((await deps.db.runsSince(now - DAY)) >= s.dailyLimit) return fail(429, MESSAGES.dailyCap);

  if (kind === "sweep") {
    const watch = await deps.db.nextWatch();
    if (!watch) return json(200, { added: 0, live: 0, found: 0, searches: 0, dropped: [], picks: [], idle: true } satisfies ScoutReport);
    // Marked first, so a failing watch waits its turn instead of being retried every 15 minutes.
    await deps.db.markWatch(watch.id);
    watchId = watch.id;
    focus = watch.query;
  }

  const runId = await deps.db.startRun({ kind, focus, startedBy: caller?.id ?? null, watchId });

  let searches = 0;
  let found = 0;
  try {
    const corners = await deps.db.corners();
    const result = await deps.search(focus, corners.map((c) => c.name), maxSearches);
    searches = result.searches;
    const raw = readPicksBlock(result.text);
    if (!raw) throw new SearchError(MESSAGES.unreadable, 502);
    found = raw.length;

    const existing = await deps.db.existingKeys(now - DAY, now + (SCOUT_DAYS + 1) * DAY);
    const { kept, dropped } = checkPicks(raw, {
      now,
      sourceLinks: result.sourceLinks,
      corners: new Map(corners.map((c) => [c.name.trim().toLowerCase(), c.id])),
      existing,
    });

    const requestedBy = kind === "member" ? caller!.id : null;
    let added = 0;
    let live = 0;
    const picks: FoundPick[] = [];
    for (const [i, p] of kept.entries()) {
      if (await deps.db.insertPick(rowFor(p, i, CITY, now, requestedBy))) {
        added += 1;
        if (publishable(p)) live += 1;
        picks.push({ title: p.title, startsAt: new Date(p.startsAt).toISOString(), place: p.place, price: p.price, url: p.url, live: publishable(p) });
      } else dropped.push({ title: p.title, reason: "Already a City pick." });
    }

    await deps.db.finishRun(runId, { searches, found, added, error: null });
    const report: ScoutReport = { added, live, found, searches, dropped, picks, ...(asksLeft !== undefined ? { asksLeft } : {}) };
    return json(200, report);
  } catch (e) {
    const message = e instanceof SearchError ? e.message : MESSAGES.failed;
    await deps.db.finishRun(runId, { searches, found, added: 0, error: message }).catch(() => undefined);
    return fail(e instanceof SearchError ? e.status : 500, message);
  }
}

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
    memberPerDay: int("STUBBY_SCOUT_MEMBER_PER_DAY", 3, 10),
    dailyLimit: int("STUBBY_SCOUT_DAILY_LIMIT", 40, 300),
    maxSearches: int("STUBBY_SCOUT_MAX_SEARCHES", 8, 20),
    sweepSearches: int("STUBBY_SCOUT_SWEEP_SEARCHES", 5, 20),
    memberSearches: int("STUBBY_SCOUT_MEMBER_SEARCHES", 4, 10),
  };
}

export { pickKey };
