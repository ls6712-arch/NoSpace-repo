// Stubby's scout: the request, from "is this allowed" to "these drafts were saved".
// Everything outside (database, search, clock, settings) comes in through ScoutDeps, so the
// whole flow is tested without a network (stubby-scout.test.ts).

import { checkPicks, cleanText, pickKey, readPicksBlock, rowFor, SCOUT_DAYS, type Dropped } from "./picks.ts";
import { SearchError, type SearchResult } from "./search.ts";

export const CITY = "new-york";

export interface ScoutSettings {
  enabled: boolean;
  hasKey: boolean;
  runsPerDay: number;
  maxSearches: number;
}

export interface ScoutDeps {
  settings: ScoutSettings;
  now: () => number;
  /** All of these act as the signed-in caller, so the database's own rules apply (admins only). */
  db: {
    runsSince(ms: number): Promise<number>;
    /** The new run's id, or "forbidden" when the caller isn't an admin. */
    startRun(focus: string | null): Promise<number | "forbidden">;
    finishRun(id: number, r: { searches: number; found: number; added: number; error: string | null }): Promise<void>;
    corners(): Promise<{ id: number; name: string }[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    /** True when saved, false when it was already there (the unique index). */
    insertPick(row: ReturnType<typeof rowFor>): Promise<boolean>;
  };
  search(focus: string | null, cornerNames: string[]): Promise<SearchResult>;
}

export interface ScoutReport {
  added: number;
  found: number;
  searches: number;
  dropped: Dropped[];
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (status: number, error: string) => json(status, { error });

export async function handleScout(req: Request, deps: ScoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "Use POST.");
  if (!req.headers.get("authorization")) return fail(401, "Sign in first.");
  if (!deps.settings.enabled) return fail(503, "The scout is switched off.");
  if (!deps.settings.hasKey) return fail(503, "The scout has no search key yet.");

  let focus: string | null = null;
  try {
    const body = (await req.json()) as { focus?: unknown };
    focus = cleanText(body?.focus).slice(0, 200) || null;
  } catch {
    focus = null;
  }

  const now = deps.now();
  const used = await deps.db.runsSince(now - 24 * 3_600_000);
  if (used >= deps.settings.runsPerDay) {
    return fail(429, `The scout has run ${deps.settings.runsPerDay} times in the last day. Try again tomorrow.`);
  }

  const runId = await deps.db.startRun(focus);
  if (runId === "forbidden") return fail(403, "This is for whoever manages City picks.");

  let searches = 0;
  let found = 0;
  try {
    const corners = await deps.db.corners();
    const result = await deps.search(focus, corners.map((c) => c.name));
    searches = result.searches;
    const raw = readPicksBlock(result.text);
    if (!raw) throw new SearchError("The scout's answer couldn't be read. Nothing was saved.", 502);
    found = raw.length;

    const existing = await deps.db.existingKeys(now - 24 * 3_600_000, now + (SCOUT_DAYS + 1) * 24 * 3_600_000);
    const { kept, dropped } = checkPicks(raw, {
      now,
      sourceLinks: result.sourceLinks,
      corners: new Map(corners.map((c) => [c.name.trim().toLowerCase(), c.id])),
      existing,
    });

    let added = 0;
    for (const [i, p] of kept.entries()) {
      if (await deps.db.insertPick(rowFor(p, i, CITY, now))) added += 1;
      else dropped.push({ title: p.title, reason: "Already a City pick." });
    }

    await deps.db.finishRun(runId, { searches, found, added, error: null });
    const report: ScoutReport = { added, found, searches, dropped };
    return json(200, report);
  } catch (e) {
    const message = e instanceof SearchError ? e.message : "Something went wrong. Nothing more was saved.";
    await deps.db.finishRun(runId, { searches, found, added: 0, error: message }).catch(() => undefined);
    return fail(e instanceof SearchError ? e.status : 500, message);
  }
}

/** The run's settings from the environment, clamped so a typo can't open the tap. */
export function readSettings(env: (k: string) => string | undefined): ScoutSettings {
  const int = (k: string, dflt: number, max: number) => {
    const n = Number.parseInt(env(k) ?? "", 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : dflt;
  };
  return {
    enabled: env("STUBBY_SCOUT_ENABLED") === "true",
    hasKey: !!env("ANTHROPIC_API_KEY"),
    runsPerDay: int("STUBBY_SCOUT_RUNS_PER_DAY", 3, 20),
    maxSearches: int("STUBBY_SCOUT_MAX_SEARCHES", 8, 20),
  };
}

export { pickKey };
