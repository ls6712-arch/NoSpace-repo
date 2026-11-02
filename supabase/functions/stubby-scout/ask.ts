// Stubby plan §6: checking what the model found for one person's ask. Pure: no network, no
// database, no Deno (tested in stubby-scout.test.ts). The model's answer is never trusted;
// every rule here is a hard filter in code, and each dropped pick says why.
//
//   - "Tonight" means tonight: a pick must start inside the ask's window (and, tonight, end by
//     midnight). When nothing fits tonight, at most 3 of the soonest after are kept, marked.
//   - The event's own page only: landing, listing, roundup and calendar-index pages are dropped.
//   - No 21+ or bars unless the ask asked for them. Family: no late nights.
//   - The budget: anything over the ceiling is dropped, and "free" means the page says free.
//   - Ideas (kind "idea") are never events: a real page for the place from the search, or a Soosh
//     page Stubby offered (a Corner's start page or one of their own Pursuits). An idea fits only
//     in a Corner they picked, or when the ask asked for that thing.
//   - Best 3, at most 5, in the order the model ranked them. One why line each, 15 words at most.

import type { Intent, Window } from "./intent.ts";
import { cleanText, linkKey, nyLocalToMs, optional, type Dropped, type RawPick } from "./picks.ts";

export const ASK_BEST = 3;
export const ASK_MOST = 5;
export const AFTER_MOST = 3;
export const WHY_WORDS = 15;
const HOUR = 3_600_000;
const MAX_LENGTH_MS = 12 * HOUR;
/** Family mode: nothing that starts at or after this hour. */
const FAMILY_LATEST_HOUR = 20;

export interface AskPick {
  kind: "event" | "idea";
  title: string;
  place: string | null;
  startsAt: number;
  endsAt: number | null;
  price: string | null;
  url: string;
  cornerId: number | null;
  note: string | null;
  why: string | null;
  betterWithFriend: boolean;
  /** One of the soonest after "tonight", shown because nothing fit tonight. */
  after: boolean;
}

export interface AskCheckContext {
  now: number;
  intent: Intent;
  /** The window searched: the ask's own, or the next 7 days. */
  window: Window;
  /** linkKey() of every page the web search returned or cited. */
  sourceLinks: ReadonlySet<string>;
  /** The Soosh pages an idea may link to, exactly ("/start/crafts/pottery", "/pursuit/p1"). */
  sooshLinks: ReadonlySet<string>;
  /** Corner names (any case) to their ids. */
  corners: ReadonlyMap<string, number>;
  /** The ids of the Corners they picked. */
  pickedCornerIds: ReadonlySet<number>;
  /** The ask's own words, for "the ask asked for it". */
  askText: string;
  /** How far ahead the soonest-after may go. */
  latestMs: number;
}

// ── pages that aren't the event's own ─────────────────────────────────────

const LISTING_PATHS = [
  /\/lp\//i,
  /\/events\/p\d+\/?$/i,
  /\/events\/exhibits\/?$/i,
  /\/things-to-do(\/|$)/i,
  /\/(events|calendar|whats-on|what-s-on)\/?$/i,
  /\/(best|top)-[a-z0-9-]*(things|events|activities|ideas|places)/i,
  /\/(roundup|round-up|guides?|lists?)\//i,
  /[?&](page|paged)=\d+/i,
];

/** True for a page that lists many things (a landing page, a roundup, a calendar index), not one thing's own page. */
export function isListingPage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (u.hostname.toLowerCase().endsWith("substack.com")) return true;
  const path = `${u.pathname}${u.search}`;
  if (u.pathname === "/" || u.pathname === "") return true;
  return LISTING_PATHS.some((re) => re.test(path));
}

// ── words ─────────────────────────────────────────────────────────────────

const ADULT_WORDS = /\b(brewery|breweries|brewing co|bars?|pubs?|21\+|21 and over|tasting|tastings|wine|beer|cocktails?|happy hour|speakeasy)\b/i;

/** The lowest dollar amount a price names: "Free" is 0, "$15 to $30" is 15. Null when it names none. */
export function lowestPrice(price: string | null): number | null {
  if (!price) return null;
  if (/\bfree\b/i.test(price)) return 0;
  const nums = [...price.matchAll(/\$?\s*(\d{1,4}(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.min(...nums) : null;
}

/** The why line: one plain line, 15 words at most, no exclamation marks, ending in a period. */
export function cleanWhy(v: unknown): string | null {
  let t = cleanText(v).replace(/!+/g, ".").replace(/\s+-\s+/g, ", ");
  if (!t) return null;
  const words = t.split(" ");
  if (words.length > WHY_WORDS) t = words.slice(0, WHY_WORDS).join(" ").replace(/[,;:]$/, "");
  t = t.replace(/\.+$/, "").replace(/[,;:]$/, "");
  return t.length > 1 ? `${t}.`.slice(0, 160) : null;
}

const nyHour = (ms: number) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));

const isTrue = (v: unknown) => v === true || v === "true";

/** Checks every pick for one ask. Keeps the model's order (its ranking by fit). */
export function checkAskPicks(raw: readonly RawPick[], ctx: AskCheckContext): { kept: AskPick[]; dropped: Dropped[]; outcome: "found" | "after" | "nothing" } {
  const inWindow: AskPick[] = [];
  const later: AskPick[] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  const { intent, window } = ctx;
  const askLower = ctx.askText.toLowerCase();

  for (const r of raw) {
    const title = cleanText(r.title);
    const drop = (reason: string) => dropped.push({ title: (title || "A pick with no title").slice(0, 80), reason });
    if (!title) {
      drop("No title.");
      continue;
    }
    if (title.length > 80) {
      drop("Title is over 80 characters.");
      continue;
    }
    const kind: AskPick["kind"] = r.kind === "idea" ? "idea" : "event";

    const startsAt = nyLocalToMs(r.starts);
    if (!Number.isFinite(startsAt)) {
      drop(kind === "idea" ? "No suggested time." : "No clear start time.");
      continue;
    }
    // An event needs an hour to get there; an idea can start any time from now.
    if (startsAt < ctx.now + (kind === "idea" ? 0 : HOUR)) {
      drop("Already started, or starts within the hour.");
      continue;
    }
    let endsAt: number | null = null;
    const notes: string[] = [];
    if (r.ends !== undefined && r.ends !== null && cleanText(r.ends) !== "") {
      const e = nyLocalToMs(r.ends);
      if (Number.isFinite(e) && e > startsAt && e - startsAt <= MAX_LENGTH_MS) endsAt = e;
      else notes.push("End time unclear");
    }

    // The link: the thing's own page from this search, or a Soosh page offered for ideas.
    const url = typeof r.url === "string" ? r.url.trim() : "";
    const soosh = kind === "idea" && ctx.sooshLinks.has(url);
    if (!soosh) {
      const key = linkKey(url);
      if (!key || url.length > 500) {
        drop(kind === "idea" ? "No real page for the place, and not a Soosh page Stubby offered." : "No https link of 500 characters or less.");
        continue;
      }
      if (!ctx.sourceLinks.has(key)) {
        drop("Its link wasn't one of the pages the search found.");
        continue;
      }
      if (isListingPage(url)) {
        drop("A page that lists many things, not its own page.");
        continue;
      }
    }

    const place = optional(r.place, 80);
    const price = optional(r.price, 40);
    const what = `${title} ${place.value ?? ""}`;

    if (!intent.adults && ADULT_WORDS.test(what)) {
      drop("A bar, brewery, tasting or 21+, and the ask didn't ask for one.");
      continue;
    }
    if (intent.who === "family" && nyHour(startsAt) >= FAMILY_LATEST_HOUR) {
      drop("Too late for a family outing.");
      continue;
    }

    // The budget, as the page states the price.
    const low = lowestPrice(price.value);
    if (intent.budget) {
      if (intent.budget.free && low !== 0 && !(kind === "idea" && low === null && soosh)) {
        drop(low === null ? "Price not listed, and only free things were asked for." : "Not free.");
        continue;
      }
      if (!intent.budget.free && low !== null && low > intent.budget.max) {
        drop(`Over the budget (about $${intent.budget.max} an outing).`);
        continue;
      }
    }
    if (price.tooLong) notes.push("Price is long, check the page");
    else if (!price.value && kind === "event") notes.push("Price not listed");
    if (place.tooLong) notes.push("Place shortened away, check the page");
    const unsure = optional(r.unsure, 120).value;
    if (unsure && !notes.some((n) => n.toLowerCase() === unsure.toLowerCase())) notes.push(unsure);

    const cornerName = cleanText(r.corner).toLowerCase();
    const cornerId = cornerName ? (ctx.corners.get(cornerName) ?? null) : null;
    if (kind === "idea") {
      const inTheirCorners = cornerId !== null && ctx.pickedCornerIds.has(cornerId);
      const asked = (cornerName && askLower.includes(cornerName)) || title.toLowerCase().split(/\s+/).some((w) => w.length > 4 && askLower.includes(w));
      if (!inTheirCorners && !asked) {
        drop("An idea outside their Corners that the ask didn't ask for.");
        continue;
      }
    }

    const k = `${title.toLowerCase()}|${startsAt}`;
    if (seen.has(k)) {
      drop("Found twice in this ask.");
      continue;
    }
    seen.add(k);

    const pick: AskPick = {
      kind,
      title,
      place: place.value,
      startsAt,
      endsAt,
      price: price.value,
      url,
      cornerId,
      note: notes.length ? notes.join(". ").slice(0, 200) : null,
      why: cleanWhy(r.why),
      betterWithFriend: intent.who === "solo" && isTrue(r.better_with_friend),
      after: false,
    };

    // The window. Tonight also means home by midnight.
    const startsIn = startsAt >= window.startMs && startsAt < window.endMs;
    const endsIn = endsAt === null || window.label !== "tonight" || endsAt <= window.endMs;
    if (startsIn && endsIn) {
      inWindow.push(pick);
      continue;
    }
    if (startsIn) {
      drop("Ends after midnight.");
      continue;
    }
    if (window.hard && window.label === "tonight" && kind === "event" && startsAt >= window.endMs && startsAt <= ctx.latestMs) {
      later.push(pick);
      drop("Not tonight (kept as one of the soonest after, if nothing tonight fits).");
      continue;
    }
    drop(startsAt < window.startMs || !window.hard ? "Outside the time asked for." : "Not in the time asked for.");
  }

  // At most one "better with a friend" per set.
  let nudged = false;
  const one = (p: AskPick) => {
    if (p.betterWithFriend && nudged) return { ...p, betterWithFriend: false };
    if (p.betterWithFriend) nudged = true;
    return p;
  };

  if (inWindow.length > 0) {
    for (const extra of inWindow.slice(ASK_MOST)) dropped.push({ title: extra.title, reason: `Over the ${ASK_MOST} picks for one ask.` });
    return { kept: inWindow.slice(0, ASK_MOST).map(one), dropped, outcome: "found" };
  }
  if (later.length > 0) {
    const soonest = [...later].sort((a, b) => a.startsAt - b.startsAt).slice(0, AFTER_MOST).map((p) => one({ ...p, after: true }));
    return { kept: soonest, dropped, outcome: "after" };
  }
  return { kept: [], dropped, outcome: "nothing" };
}

/** The personal pick row for this person: never published, never shown to anyone else. */
export function askRowFor(p: AskPick, userId: string, askId: number, rank: number) {
  return {
    user_id: userId,
    title: p.title,
    place: p.place,
    starts_at: new Date(p.startsAt).toISOString(),
    ends_at: p.endsAt === null ? null : new Date(p.endsAt).toISOString(),
    price: p.price,
    url: p.url,
    corner_id: p.cornerId,
    note: p.note,
    kind: p.kind,
    why: p.why,
    rank,
    ask_id: askId,
    soonest_after: p.after,
  };
}
