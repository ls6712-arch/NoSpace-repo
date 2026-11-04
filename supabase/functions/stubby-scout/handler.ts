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
  type RawPick,
} from "./picks.ts";
import { SearchError, type SearchProgress, type SearchResult } from "./search.ts";
import { ASK_BEST, askRowFor, checkAskPicks, gapLines, topReasons, type AskPick } from "./ask.ts";
import { askSystemPrompt, askUserPrompt, type AboutPerson, type FollowUp, type FollowUpKind } from "./askPrompt.ts";
import { readIntent, searchWindow, type Answers, type Intent, type Setting, type Who, type Window } from "./intent.ts";
import { STUBBY_CONFIG } from "./config.ts";
import { buildContract, decisionTrace, explicitPreferences, type DecisionTrace } from "./contract.ts";
import { BodyError, parseBody } from "./schema.ts";
import { EMPTY_TASTE, tasteIsEmpty, tasteLines, type Signal, type Taste } from "./taste.ts";
import { STUBBY_UPDATING, STUBBY_VERSION, STUBBY_VERSION_HEADER, versionMatches } from "../_shared/stubbyVersion.ts";

import { emptyCapability, validTimeZone, type CapabilityProfile } from "../_shared/capabilityProfile.ts";
import { currentIntent, learnsFromFeedback } from "./v3/context.ts";
import { providerHasKey } from "./v3/provider.ts";
import { careCheck, type CareModel } from "./v3/care.ts";
import { careCountry, DRAFTED_ON, type CareResource } from "./v3/careResources.ts";
import { isSoosh } from "./v3/evidence.ts";
import { needsLine } from "./v3/soosh.ts";
import type { RequestInput, TraceDeckPick, V3Report, V3DecisionTrace } from "./v3/types.ts";

export const CITY = "new-york";
/** The morning restock fills this many days ahead. */
export const RESTOCK_DAYS = 7;
/** How far ahead "the soonest after tonight" may go. */
const AFTER_DAYS = 7;
const DAY_MS = 24 * 3_600_000;

export interface ScoutSettings {
  enabled: boolean;
  hasKey: boolean;
  /** "v3": V3 for everyone (only when the founder says so). Otherwise legacy, except for v3Testers. */
  askEngine?: "legacy" | "v3";
  askHasKey?: boolean;
  /** STUBBY_V3_TESTERS: the accounts that get V3, with legacy run alongside to compare (shadow). */
  v3Testers?: readonly string[];
  runsPerDay: number;
  maxSearches: number;
  restockSearches: number;
  asksPerPerson: number;
  asksPerDay: number;
  /** Guests (anonymous users): asks a rolling 24 hours. GUEST_DAILY_MESSAGE_LIMIT. */
  guestAsksPerDay?: number;
  /** Guest asks per IP hash a rolling 24 hours, about 3x the guest limit. GUEST_IP_DAILY_LIMIT. */
  guestAsksPerIp?: number;
  /** New guests per IP hash an hour. GUEST_NEW_PER_IP_HOUR. */
  newGuestsPerIpHour?: number;
  /** Guest asks across everyone a rolling 24 hours, then guests pause. GUEST_GLOBAL_DAILY_CAP. */
  guestAsksGlobal?: number;
  /** Web searches per round for a guest. GUEST_MAX_SEARCHES. */
  guestMaxSearches?: number;
}

/** Who is asking, from the verified token and the database (never from the request body). */
export interface CallerInfo {
  /** An anonymous Supabase user. */
  guest: boolean;
  /** private.is_active: finished onboarding or gave an 18+ birthdate. */
  member: boolean;
  /** A birthdate on file at least 21 years ago. Only then are 21+ picks allowed, even when asked for. */
  adult21?: boolean;
}

export interface AskLimits {
  guest: boolean;
  ipHash: string | null;
  perPerson: number;
  perIp: number;
  newGuestsPerIpHour: number;
  guestCap: number;
  global: number;
}
export type LimitCode = "GUEST_LIMIT_REACHED" | "USER_LIMIT_REACHED" | "GUEST_GLOBAL_CAP" | "GLOBAL_CAP";
export type ClaimResult = { askId: number } | { askId: null; code: LimitCode; resetsAt: string | null };

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
  /** Live steps while it searches (asks that stream only). */
  onProgress?: (e: SearchProgress) => void;
}

/** What the edge function reads about the person who asks, as them (their own rows only). */
export interface PersonProfile {
  personalization?: import("../_shared/personalization.ts").Personalization;
  /** Corner keys, "space-slug/corner-slug". */
  picks: string[];
  /** The usual week: "sat-eve" and the like. */
  windows: string[];
  monthlyBudget: number | null;
  city: string | null;
  area: string | null;
  passes: { label: string; place: string | null; kind?: string }[];
  /** Their own Pursuits that are going (not finished, paused, let go, archived or a one-off plan), with their Corner when known. */
  pursuits: { id: string; title: string; corner?: string | null }[];
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
  /** Guest or account, member or not, for the person behind userId(). */
  whoIs(userId: string): Promise<CallerInfo>;
  /** An HMAC of the caller's IP with a secret salt (64 hex), or null if there is none. */
  ipHash(): Promise<string | null>;
  /**
   * The startup check: true only when the database is ready for guests (public.stubby_guest_ready())
   * and the IP salt is set. Until then every guest ask is refused, whatever Supabase Auth allows.
   */
  guestReady?(): Promise<boolean>;
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
    capability?(userId: string): Promise<CapabilityProfile>;
    /** Their taste profile (stubby_profiles), read as them. */
    taste?(userId: string): Promise<Taste>;
    /** Their last ~20 signals on picks (stubby_feedback), newest first, read as them. */
    signals?(userId: string): Promise<Signal[]>;
  };
  /** As the server: only for the restock and asks, after their own checks. */
  server: {
    claimSource(): Promise<Source | null>;
    /** One ask, if every limit allows it (claim_stubby_turn). A bare number or null is accepted too. */
    claimAsk(userId: string, limits: AskLimits): Promise<ClaimResult | number | null | undefined>;
    /**
     * Marks this person's ask's free follow-up used, in one update that only succeeds once (and
     * only for an ask of theirs from the last day). True when it was free; false means it costs an ask.
     */
    claimFreeFollowUp(userId: string, askId: number, sinceMs: number): Promise<boolean>;
    finishRun(id: number, r: { searches: number; found: number; added: number; error: string | null }): Promise<void>;
    /**
     * `dropped`: why each candidate was dropped, and `trace`: how the deck was chosen (stubby-agent G4).
     * Saved for debugging and the weekly review: titles, reasons and rules only, never the ask.
     */
    finishAsk(id: number, r: { found: number; added: number; failed: boolean; dropped?: Dropped[]; trace?: DecisionTrace | V3DecisionTrace }): Promise<void>;
    /** How many asks this person has made since `ms`. */
    asksSince(userId: string, ms: number): Promise<number>;
    /** When this person's oldest ask since `ms` was made, or null. */
    oldestAskSince?(userId: string, ms: number): Promise<number | null>;
    trustedHosts(): Promise<string[]>;
    corners(): Promise<CornerRow[]>;
    existingKeys(fromMs: number, toMs: number): Promise<Set<string>>;
    insertPick(row: CityRow): Promise<boolean>;
    insertPersonal(row: PersonalRow | ReturnType<typeof askRowFor>): Promise<boolean>;
  };
  search(r: SearchRequest): Promise<SearchResult>;
  v3?(input: RequestInput): Promise<V3Report>;
  /** The care step's model check (v3/care.ts), for text the keyword list can't settle. Never stores the text. */
  careModel?: CareModel;
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
  /** Which ask this was, so the app shows this ask's picks apart from earlier ones. A free follow-up shares its ask's id. */
  askId: number;
  /** A follow-up that cost nothing (the first after an ask). */
  free: boolean;
  /** When nothing fits: the 3 most common kinds of reason, for the short reasons the person sees. */
  reasons: { key: string; count: number }[];
  /**
   * The ask was for 21+ things (bars, tastings) and they were left out because the caller, signed
   * in, has no 21+ birthdate on file. Never for a guest. The app shows "Add your birthday" only if
   * no birthday is on file at all, so an under-21 member never sees it.
   */
  adultsLeftOut?: boolean;
  intelligence?: Pick<V3Report, "outcome" | "fallback" | "warnings">;
}

/**
 * The care card (stubby-agent C1): instead of picks, when an ask reads as clear distress. No ask is
 * used and nothing about it is stored. The app shows the line, the resources for their country, the
 * emergency line and a way to message a friend.
 */
export interface CareAnswer {
  care: {
    line: string;
    resources: CareResource[];
    emergency: CareResource;
    friend: { label: string; href: string };
    draftedOn: string;
  };
}
export const CARE_LINE = "That sounds really hard. You don’t have to handle it alone.";
export const CARE_FRIEND = { label: "Message a friend", href: "/messages" };

/**
 * Which engine answers this caller. Testers get V3 with legacy run alongside (shadow), whether or not
 * V3 is on for everyone, so the comparison keeps going after the switch (Nov 4, 2026). Everyone else:
 * V3 only when switched on. Guests never test.
 */
export function engineFor(s: ScoutSettings, userId: string, who: CallerInfo): "legacy" | "v3" | "shadow" {
  if (!who.guest && (s.v3Testers ?? []).includes(userId)) return "shadow";
  if (s.askEngine === "v3") return "v3";
  return "legacy";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** STUBBY_V3_TESTERS: user ids, comma or space separated. Anything that isn't a user id is ignored. */
export function readTesters(v: string | undefined): string[] {
  return [...new Set((v ?? "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter((x) => UUID.test(x)))].slice(0, 50);
}

/** Answered instead of searching when one thing worth a question is missing, and the app asked to be asked. No ask is used. */
export interface AskQuestion {
  question: "setting" | "who" | "when" | "what";
  asksLeft: number;
}

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, stubby-version",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": STUBBY_VERSION_HEADER,
  // Every answer says which version of Stubby gave it, so the app can tell when the two drift apart.
  [STUBBY_VERSION_HEADER]: STUBBY_VERSION,
};

/**
 * An ask can stream its steps (Stubby plan §7) as server-sent events, in this order:
 *   understood {when, who, budget, free}   at once, before any search
 *   search {query}                         each web search, as the model runs it
 *   pages {count}                          pages read so far
 *   picking                                the model is writing its picks; code checks follow
 *   done {AskReport}  or  error {error, status}
 * with a comment line every 10 seconds to keep the connection open. If the person stops, the
 * work carries on and is saved: the ask was paid for and still counts.
 */
export type Emit = (event: string, data: unknown) => void;
export const SSE_HEADERS = { ...CORS, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" };
const KEEPALIVE_MS = 10_000;

function sse(run: (emit: Emit) => Promise<void>): Response {
  const enc = new TextEncoder();
  let closed = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(text));
        } catch {
          closed = true;
        }
      };
      const emit: Emit = (event, data) => send(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
      ping = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
      void run(emit).finally(() => {
        clearInterval(ping);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already gone.
        }
      });
    },
    cancel() {
      closed = true;
      clearInterval(ping);
    },
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (status: number, error: string) => json(status, { error });
const message = (e: unknown, fallback: string) => (e instanceof SearchError ? e.message : fallback);
const statusOf = (e: unknown) => (e instanceof SearchError ? e.status : 500);

export async function handleScout(req: Request, deps: ScoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "Use POST.");
  // The app and the function come from different deploys: a different version means one of them is
  // mid-update. Said plainly, before the body is read (a newer app's body may not pass this check).
  if (!versionMatches(req.headers.get(STUBBY_VERSION_HEADER))) return json(409, STUBBY_UPDATING);

  let body: ReturnType<typeof parseBody>;
  try {
    body = parseBody(await req.text());
  } catch (e) {
    // The same short answer for every bad body: nothing about what was expected.
    if (!(e instanceof BodyError)) console.error("stubby-scout: body", (e as Error)?.name);
    return fail(400, "That request isn't valid.");
  }
  const mode = body.mode;

  if (!deps.settings.enabled) return fail(503, "The scout is switched off.");
  if (!(mode === "ask" ? deps.settings.askHasKey ?? deps.settings.hasKey : deps.settings.hasKey)) return fail(503, "The scout has no search key yet.");

  if (mode === "restock") return restock(deps);

  const userId = await deps.userId();
  if (!userId) return fail(401, "Sign in first.");
  const who = await deps.whoIs(userId);
  // Anonymous sign-ins switched on before the guest migrations (or the salt): guests get nothing.
  if (who.guest && !(deps.guestReady ? await deps.guestReady().catch(() => false) : false)) {
    return json(503, { error: "Stubby isn't open to guests yet.", code: "GUESTS_NOT_READY" });
  }
  // How many asks are left today, and the day's allowance: read only, no search, no ask used.
  if (mode === "ask" && body.status === true) {
    const perDay = limitsFor(deps.settings, who, null).perPerson;
    const used = await deps.server.asksSince(userId, deps.now() - DAY_MS);
    const left = Math.max(0, perDay - used);
    // At 0: when the oldest ask of the last 24 hours ages out, for "ask again after {time}".
    const oldest = left === 0 && deps.server.oldestAskSince ? await deps.server.oldestAskSince(userId, deps.now() - DAY_MS) : null;
    const resetsAt = oldest === null ? null : new Date(oldest + DAY_MS).toISOString();
    return json(200, { asksLeft: left, perDay, accountPerDay: deps.settings.asksPerPerson, guest: who.guest, resetsAt });
  }
  if (mode === "ask") return ask(deps, userId, who, body.ask, readAnswers(body.answers), body.questions === true, body.stream === true, readFollowUp(body.followUp));
  // Find picks is for admins, who are always members. A guest or Stubby account stops here.
  if (who.guest || !who.member) return fail(403, "This is for whoever manages City picks.");
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
  if (typeof a.when === "string" && ((WHEN_VALUES as readonly string[]).includes(a.when) || /^\d{4}-\d{2}-\d{2}$/.test(a.when))) out.when = a.when;
  if (a.skip === true) out.skip = true;
  if (a.setting === "in" || a.setting === "out") out.setting = a.setting as Setting;
  if (typeof a.rememberedWho === "string" && (WHO_VALUES as readonly string[]).includes(a.rememberedWho)) out.rememberedWho = a.rememberedWho as Who;
  return out.who || out.when || out.skip || out.setting || out.rememberedWho ? out : null;
}

const FOLLOW_UP_KINDS: readonly FollowUpKind[] = ["cheaper", "closer", "later", "different", "more"];

/** A follow-up on the deck: which ask it follows, what to change, and the titles already shown. */
function readFollowUp(v: unknown): (FollowUp & { of: number }) | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  if (typeof f.of !== "number" || !Number.isInteger(f.of) || f.of <= 0) return null;
  if (typeof f.kind !== "string" || !(FOLLOW_UP_KINDS as readonly string[]).includes(f.kind)) return null;
  const titles = Array.isArray(f.titles) ? f.titles.filter((t): t is string => typeof t === "string").map((t) => cleanText(t).slice(0, 80)).filter(Boolean).slice(0, 10) : [];
  return { of: f.of, kind: f.kind as FollowUpKind, titles };
}

/** What a follow-up changes before the search: Cheaper halves the ceiling, Later starts two hours on. */
export function applyFollowUp(intent: Intent, window: Window, kind: FollowUpKind, now: number): { intent: Intent; window: Window } {
  if (kind === "cheaper") {
    const budget = intent.budget ? { ...intent.budget, max: Math.floor(intent.budget.max * 100 / 2) / 100, from: "ask" as const } : { max: 20, free: false, from: "ask" as const };
    return { intent: { ...intent, budget }, window };
  }
  if (kind === "later") {
    const start = Math.max(window.startMs, now) + 2 * 3_600_000;
    return { intent, window: start < window.endMs ? { ...window, startMs: start } : window };
  }
  return { intent, window };
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
export function aboutPerson(profile: PersonProfile, picked: CornerRow[], taste: Taste = EMPTY_TASTE, signals: readonly Signal[] = []): AboutPerson {
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
    taste: tasteLines(taste, signals),
  };
}

const understoodOf = (intent: Intent): AskReport["understood"] => ({
  when: intent.when?.label ?? null,
  who: intent.who,
  budget: intent.budget ? intent.budget.max : null,
  free: intent.budget?.free ?? false,
});

/** The limits for this caller, from the settings (each clamped in readSettings). */
export function limitsFor(s: ScoutSettings, who: CallerInfo, ipHash: string | null): AskLimits {
  const guestDay = s.guestAsksPerDay ?? 3;
  return {
    guest: who.guest,
    ipHash,
    perPerson: who.guest ? guestDay : s.asksPerPerson,
    perIp: s.guestAsksPerIp ?? guestDay * 3,
    newGuestsPerIpHour: s.newGuestsPerIpHour ?? 5,
    guestCap: s.guestAsksGlobal ?? 60,
    global: s.asksPerDay,
  };
}

/** A claim's answer, whatever shape it came back in. */
function claimed(r: ClaimResult | number | null | undefined, guest: boolean): ClaimResult {
  if (typeof r === "number") return { askId: r };
  if (r && typeof r === "object") return r;
  return { askId: null, code: guest ? "GUEST_LIMIT_REACHED" : "USER_LIMIT_REACHED", resetsAt: null };
}

/** The 429 for a limit: a code the app renders its own words for, and when the oldest ask ages out. */
function limitReached(c: Extract<ClaimResult, { askId: null }>, perPerson: number): Response {
  const error =
    c.code === "GUEST_GLOBAL_CAP" || c.code === "GLOBAL_CAP"
      ? "Lots of asks right now. Try again later."
      : `That's ${perPerson} for today. I'll look again tomorrow.`;
  return json(429, { error, code: c.code, resetsAt: c.resetsAt });
}

async function ask(
  deps: ScoutDeps,
  userId: string,
  who: CallerInfo,
  raw: unknown,
  answers: Answers | null,
  questions: boolean,
  stream = false,
  followUp: (FollowUp & { of: number }) | null = null,
): Promise<Response> {
  const engine = engineFor(deps.settings, userId, who);
  const v3 = engine !== "legacy";
  // Their own words, one plain line. Double quotes become single so the prompt stays one quote.
  const text = cleanText(raw).replace(/"/g, "'").slice(0, v3 ? 500 : 200);
  if (text.length < 2) return fail(400, "Say what you're after, like pottery on Saturday.");

  const now = deps.now();
  const limits = limitsFor(deps.settings, who, who.guest ? await deps.ipHash() : null);
  const asksPerPerson = limits.perPerson;
  // Follow-ups (Cheaper, Closer and the rest) are for accounts: the app asks a guest to sign up.
  if (followUp && who.guest) return json(403, { error: "Sign up to ask Stubby for more.", code: "SIGNUP_REQUIRED" });
  if (v3 && !deps.v3) return fail(503, "Stubby’s new search is unavailable.");

  // Read as them, from their own rows only. Best effort: without it, he still searches. The
  // onboarding answers are used by default (Nov 3, 2026); learning from feedback is the only opt-in.
  const capability = !who.guest && deps.db.capability ? await deps.db.capability(userId).catch(() => emptyCapability()) : emptyCapability();
  const profile = await deps.db.profile(userId).catch(() => EMPTY_PROFILE);
  const zone = validTimeZone(capability.timeZone) ? capability.timeZone : "America/New_York";

  // Step 1, safety routing (C1), before anything is claimed: clear distress gets the care card and
  // no picks. Nothing about it is stored, and no ask is used.
  let gentle = false;
  if (v3) {
    const level = await careCheck(text, deps.careModel);
    if (level === "distress") {
      const country = careCountry(profile.city, zone);
      const answer: CareAnswer = { care: { line: CARE_LINE, resources: country.resources, emergency: country.emergency, friend: CARE_FRIEND, draftedOn: DRAFTED_ON } };
      return json(200, answer);
    }
    gentle = level === "low";
  }

  const taste = (!v3 || who.guest) && deps.db.taste ? await deps.db.taste(userId).catch(() => EMPTY_TASTE) : EMPTY_TASTE;
  // Legacy reads feedback as it always has (it runs alongside V3 for testers); V3 only with consent.
  const signals = learnsFromFeedback(capability) && deps.db.signals ? await deps.db.signals(userId).catch(() => [] as Signal[]) : [];
  const corners = await deps.server.corners();
  const byKey = new Map(corners.filter((c) => c.spaceSlug && c.slug).map((c) => [`${c.spaceSlug}/${c.slug}`, c]));
  const picked = profile.picks.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
  const legacyRead = engine !== "v3" ? readIntent(text, { now, windows: profile.windows, monthlyBudget: profile.monthlyBudget, cornerNames: picked.map((c) => c.name), answers }) : null;
  const read = v3 ? currentIntent(text, now, zone, answers, corners.map(c => c.name)) : legacyRead!;
  // 21+ only with a birthdate on file at least 21 years ago. Guests never; nobody without one.
  const adultOk = who.adult21 === true && !who.guest;
  const intent: Intent = adultOk ? read : { ...read, adults: false };
  const legacyIntent: Intent | null = legacyRead ? (adultOk ? legacyRead : { ...legacyRead, adults: false }) : null;
  const adultsLeftOut = read.adults && !intent.adults && !who.guest;

  // Nothing known about them yet: a vague ask gets one question first, even if the app didn't ask for it.
  const knowsNothing = tasteIsEmpty(taste) && signals.length === 0 && profile.picks.length === 0 && !profile.city && !profile.area;
  // One question first, when something worth asking is missing. No ask is used.
  if ((questions || knowsNothing) && intent.missing && !followUp && !answers?.skip) {
    const left = Math.max(0, asksPerPerson - (await deps.server.asksSince(userId, now - DAY_MS)));
    const q: AskQuestion = { question: intent.missing, asksLeft: left };
    return json(200, q);
  }

  // A follow-up: the first after an ask is free and joins that ask's picks; later ones use an ask.
  const free = followUp ? await deps.server.claimFreeFollowUp(userId, followUp.of, now - DAY_MS) : false;
  const claim = free ? ({ askId: followUp!.of } as ClaimResult) : claimed(await deps.server.claimAsk(userId, limits), who.guest);
  if (claim.askId === null) return limitReached(claim, asksPerPerson);
  const askId = claim.askId;
  // A free follow-up's picks rank after its ask's own.
  const rankFrom = free ? 10 : 0;
  const maxSearches = who.guest ? Math.min(deps.settings.guestMaxSearches ?? 3, deps.settings.maxSearches) : deps.settings.maxSearches;

  let found = 0;

  /**
   * The legacy engine's deck for this ask, nothing saved: what it searched, kept and dropped. Shown
   * and saved on the legacy path; on the shadow path only compared, in the trace.
   */
  const legacyDeck = async (li: Intent, emit: Emit, live: boolean) => {
    const changed = followUp ? applyFollowUp(li, searchWindow(li, now), followUp.kind, now) : { intent: li, window: searchWindow(li, now) };
    const window = changed.window;
    const asked = changed.intent;
    const person = aboutPerson(profile, picked, taste, signals);
    let picking = false;
    const onProgress = live && stream
      ? (e: SearchProgress) => {
          if (e.type === "picking") picking = true;
          emit(e.type, e);
        }
      : undefined;
    const search = (gaps: string | null) =>
      deps.search({
        focus: null,
        ask: text,
        cornerNames: corners.map((c) => c.name),
        maxSearches,
        prompt: { system: askSystemPrompt(), user: askUserPrompt(text, asked, window, person, now, followUp, gaps) },
        onProgress,
      });
    const check = (raw: RawPick[], links: ReadonlySet<string>) =>
      checkAskPicks(raw, {
        now,
        intent: asked,
        window,
        sourceLinks: links,
        sooshLinks: new Set(person.sooshPages.map((p) => p.url)),
        corners: cornerMap(corners),
        pickedCornerIds: new Set(picked.map((c) => c.id)),
        askText: text,
        latestMs: window.endMs + AFTER_DAYS * DAY_MS,
        exclude: followUp?.titles,
      });

    let rounds = 1;
    const result = await search(null);
    let rawPicks = readPicksBlock(result.text);
    if (!rawPicks) throw new SearchError("Stubby couldn't read what he found. Try asking another way.", 502);
    const links = new Set(result.sourceLinks);
    let checked = check(rawPicks, links);
    // Fewer than 3 that fit: one more search round within the same ask, aimed at the gaps.
    if (checked.outcome !== "found" || checked.kept.length < ASK_BEST) {
      picking = false;
      rounds = 2;
      try {
        const again = await search(gapLines(checked.outcome === "found" ? checked.kept : [], checked.dropped));
        const more = readPicksBlock(again.text) ?? [];
        for (const l of again.sourceLinks) links.add(l);
        rawPicks = [...rawPicks, ...more];
        checked = check(rawPicks, links);
      } catch {
        // The second round is a bonus: what the first one found still stands.
      }
    }
    if (live && stream && !picking) emit("picking", { type: "picking" });
    return { ...checked, found: rawPicks.length, rounds, asked, window, person };
  };

  /** V3, saved and shown. On the shadow path, legacy runs alongside and its deck goes in the trace only. */
  const v3Work = async (emit: Emit): Promise<AskReport> => {
    const change = followUp ? applyFollowUp(intent, searchWindow(intent, now, zone), followUp.kind, now) : null;
    const input: RequestInput = { text, now, profile, capability, knownTopics: corners.map(c => c.name),
      learned: learnsFromFeedback(capability) ? signals.map(s => ({ source: "feedback" as const, ...s })) : [],
      adult21: adultOk, answers, searchLimit: maxSearches, sessionCity: who.guest ? taste.city : null, gentle,
      budgetOverride: followUp?.kind === "cheaper" ? change?.intent.budget?.max : undefined,
      travelOverride: followUp?.kind === "closer" ? 20 : undefined,
      notBefore: followUp?.kind === "later" ? Math.max(now, intent.when?.startMs ?? now) + 2 * 3600000 : undefined, exclude: followUp?.titles ?? [] };
    const [report, shadow] = await Promise.all([
      deps.v3!(input),
      engine === "shadow" && legacyIntent ? legacyDeck(legacyIntent, emit, false).catch(() => null) : Promise.resolve(null),
    ]);
    emit("picking", { type: "picking" });
    const mine: AskPick[] = [];
    for (const [rank, r] of report.recommendations.entries()) {
      const c = r.candidate;
      const own = isSoosh(c);
      const p: AskPick = { kind: c.kind === "event" ? "event" : "idea", title: c.title, place: c.place, startsAt: c.startsAt, endsAt: c.endsAt,
        // Their own Pursuit or Corner: no price claimed; what it needs is the note instead of an uncertainty.
        price: own ? null : c.cost ? c.cost.max === 0 ? "Free" : `Up to $${c.cost.max}` : null,
        url: c.evidence[0].url, cornerId: null,
        note: own ? [needsLine(c.needs), ...r.uncertainties].filter(Boolean).join(" ").slice(0, 200) : [r.verification === "partial" ? "Details need confirmation." : "Source verified.", ...r.uncertainties].join(" ").slice(0, 200),
        why: r.explanation, after: r.after === true, betterWithFriend: false };
      if (await deps.server.insertPersonal(askRowFor(p, userId, askId, Math.min(20, rankFrom + rank)))) mine.push(p);
    }
    const rejected: Record<string, number> = {};
    for (const d of report.dropped) rejected[d.reason] = (rejected[d.reason] ?? 0) + 1;
    const typed = change?.intent ?? intent;
    // The contract says what bound this ask: a typed budget is hard; the onboarding budget is soft (C3).
    const softBudget = capability.perActivityBudget;
    const asked: Intent = typed.budget || softBudget === null ? typed : { ...typed, budget: { max: softBudget, free: softBudget === 0, from: "profile" }, from: { ...typed.from, budget: "profile" } };
    const window = asked.when ?? searchWindow(asked, now, zone);
    const deckOf = (r: V3Report["recommendations"]): TraceDeckPick[] => r.slice(0, 5).map((x, rank) => ({ title: x.candidate.title.slice(0, 80), kind: x.candidate.kind,
      source: isSoosh(x.candidate) ? "soosh" : "web", verification: x.verification, rank, after: x.after === true }));
    const trace: V3DecisionTrace = {
      version: report.version, engine: "v3",
      contract: buildContract(asked, window),
      preferences: explicitPreferences({ corners: picked.map(c => c.name), monthlyBudget: profile.monthlyBudget, freeTimes: windowWords(profile.windows), passes: profile.passes.map(p => p.label), neighborhood: cleanText(profile.area) || null, city: cleanText(profile.city) || null }).map(p => p.attribute),
      cityFrom: report.cityFrom ?? null, gentle, outcome: report.outcome, found: report.recommendations.length, added: mine.length, usage: report.usage, rejected,
      deck: deckOf(report.recommendations),
      sources: report.recommendations.slice(0, 3).map((r, rank) => ({ rank, evidence: r.candidate.evidence.slice(0, 2), verification: r.verification })),
    };
    if (engine === "shadow") {
      const dropped: Record<string, number> = {};
      for (const d of shadow?.dropped ?? []) dropped[d.key ?? "other"] = (dropped[d.key ?? "other"] ?? 0) + 1;
      trace.legacy = shadow
        ? { version: STUBBY_CONFIG.version, outcome: shadow.outcome, found: shadow.found, rounds: shadow.rounds, dropped,
            deck: shadow.kept.slice(0, 5).map((p, rank) => ({ title: p.title.slice(0, 80), kind: p.kind, source: p.url.startsWith("/") ? "soosh" : "web", verification: p.note ? "partial" : "verified", rank, after: p.after })) }
        : { failed: true };
    }
    if (!free) await deps.server.finishAsk(askId, { found: report.recommendations.length, added: mine.length, failed: false, trace: fitTrace(trace) });
    const outcome = mine.length === 0 ? "nothing" : report.after ? "after" : "found";
    return { picks: mine.map(p => ({ ...p, startsAt: new Date(p.startsAt).toISOString(), endsAt: p.endsAt === null ? null : new Date(p.endsAt).toISOString() })),
      outcome, understood: understoodOf(asked), dropped: [],
      asksLeft: Math.max(0, asksPerPerson - await deps.server.asksSince(userId, now - DAY_MS)), askId, free, reasons: [],
      ...(adultsLeftOut ? { adultsLeftOut: true } : {}),
      intelligence: { outcome: mine.length ? report.outcome : "no_verified_match", fallback: report.fallback ?? (mine.length ? null : "No new picks were saved. Try different words."), warnings: report.warnings } };
  };

  // Everything from the search to the saved picks. Streams its steps through `emit` when asked.
  const work = async (emit: Emit): Promise<AskReport> => {
    if (v3) return v3Work(emit);
    const { kept, dropped, outcome, found: n, rounds, asked, window, person } = await legacyDeck(intent, emit, true);
    found = n;

    const mine: AskPick[] = [];
    for (const [rank, p] of kept.entries()) if (await deps.server.insertPersonal(askRowFor(p, userId, askId, Math.min(20, rankFrom + rank)))) mine.push(p);

    // Shared with everyone, without who asked: events only, never ideas. Published from a trusted page, a draft otherwise.
    // Never from a guest: a guest's ask changes nothing outside their own picks (guest brief §6e).
    const events = who.guest ? [] : kept.filter((p) => p.kind === "event");
    if (events.length) {
      const hosts = await deps.server.trustedHosts();
      const existing = await deps.server.existingKeys(now - DAY_MS, now + (SCOUT_DAYS + 1) * DAY_MS);
      for (const [i, p] of events.entries()) {
        if (existing.has(pickKey(p.title, p.startsAt))) continue;
        await deps.server.insertPick(rowFor(p, i, CITY, now, isTrusted(p.url, hosts))).catch(() => false);
      }
    }

    // A free follow-up isn't an ask of its own: its ask's counts stay as they were.
    const trace = decisionTrace({
      contract: buildContract(asked, window),
      preferences: explicitPreferences({ corners: person.corners, monthlyBudget: profile.monthlyBudget, freeTimes: person.freeTimes, passes: person.passes, neighborhood: person.neighborhood, city: person.city }),
      rounds,
      found,
      outcome,
      kept,
      dropped,
    });
    if (!free) await deps.server.finishAsk(askId, { found, added: mine.length, failed: false, dropped: dropped.slice(0, STUBBY_CONFIG.saved.dropReasonsMost), trace });
    return {
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
      understood: understoodOf(asked),
      dropped,
      asksLeft: Math.max(0, asksPerPerson - (await deps.server.asksSince(userId, now - DAY_MS))),
      askId,
      free,
      reasons: outcome === "nothing" ? topReasons(dropped) : [],
      ...(adultsLeftOut ? { adultsLeftOut: true } : {}),
    };
  };
  const failed = (e: unknown) => {
    if (!free) void deps.server.finishAsk(askId, { found, added: 0, failed: true }).catch(() => undefined);
    return { error: message(e, "Something went wrong. Try again in a bit."), status: statusOf(e) };
  };

  if (!stream) {
    try {
      return json(200, await work(() => undefined));
    } catch (e) {
      const f = failed(e);
      return fail(f.status, f.error);
    }
  }
  return sse(async (emit) => {
    emit("understood", understoodOf(intent));
    try {
      emit("done", await work(emit));
    } catch (e) {
      emit("error", failed(e));
    }
  });
}

/** The saved trace stays under the column's 16 KB: evidence goes first, then the decks shrink. Never the ask. */
export function fitTrace(t: V3DecisionTrace): V3DecisionTrace {
  const size = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;
  let out = t;
  if (size(out) > 15_000) out = { ...out, sources: [] };
  if (size(out) > 15_000) out = { ...out, deck: out.deck.slice(0, 3), legacy: out.legacy && "deck" in out.legacy ? { ...out.legacy, deck: out.legacy.deck.slice(0, 3) } : out.legacy };
  return out;
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
    askEngine: env("STUBBY_ASK_ENGINE") === "v3" ? "v3" : "legacy",
    // Both engines use Claude with the same key (V3 is Claude only, Nov 3, 2026).
    askHasKey: providerHasKey(env),
    v3Testers: readTesters(env("STUBBY_V3_TESTERS")),
    runsPerDay: int("STUBBY_SCOUT_RUNS_PER_DAY", 3, 20),
    maxSearches: int("STUBBY_SCOUT_MAX_SEARCHES", 5, 20),
    restockSearches: int("STUBBY_RESTOCK_SEARCHES", 3, 10),
    // Members and Stubby accounts. USER_DAILY_MESSAGE_LIMIT, or the older name.
    asksPerPerson: env("USER_DAILY_MESSAGE_LIMIT") ? int("USER_DAILY_MESSAGE_LIMIT", 6, 50) : int("STUBBY_ASKS_PER_PERSON", 6, 50),
    asksPerDay: int("STUBBY_ASKS_PER_DAY", 200, 5000),
    guestAsksPerDay: int("GUEST_DAILY_MESSAGE_LIMIT", 3, 20),
    guestAsksPerIp: int("GUEST_IP_DAILY_LIMIT", 3 * int("GUEST_DAILY_MESSAGE_LIMIT", 3, 20), 100),
    newGuestsPerIpHour: int("GUEST_NEW_PER_IP_HOUR", 5, 50),
    guestAsksGlobal: int("GUEST_GLOBAL_DAILY_CAP", 60, 2000),
    guestMaxSearches: int("GUEST_MAX_SEARCHES", 3, 20),
  };
}

export { pickKey };
