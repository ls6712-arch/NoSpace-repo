// Stubby plan §6: checking what the model found for one person's ask. Pure: no network, no
// database, no Deno (tested in stubby-scout.test.ts). The model's answer is never trusted;
// every rule here is a hard filter in code, and each dropped pick says why.
//
//   - "Tonight" means tonight: a pick must start inside the ask's window (and, tonight, end by
//     midnight). When nothing fits tonight, at most 3 of the soonest after are kept, marked.
//   - The event's own page only: landing, listing, roundup and calendar-index pages are dropped.
//   - No 21+ or bars unless the ask asked for them. Family: no late nights.
//   - The budget (stubby-agent C3): a limit typed in the ask is hard (over it is dropped, and
//     "free" means the page says free, or the thing is free by nature). The profile's monthly
//     budget is only a soft preference: nothing is dropped for it, picks that miss it come last.
//   - Ideas (kind "idea") are never events: a real page for the place from the search, or a Soosh
//     page Stubby offered (a Corner's start page or one of their own Pursuits). An idea fits only
//     in a Corner they picked, on a Soosh page Stubby offered them, or when the ask asked for it.
//   - The same thing found twice (the same title give or take "the", at the same time) is kept once.
//   - Best 3, at most 5, in the order the model ranked them. One why line each, 15 words at most.

import type { Intent, Window } from "./intent.ts";
import { cleanText, linkKey, nyLocalToMs, optional, type Dropped, type RawPick, type ReasonKey } from "./picks.ts";

export const ASK_BEST = 3;
/** How many candidates the model is asked for; the code keeps the best ASK_BEST. */
export const ASK_CANDIDATES = 10;
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
  /** Misses the profile's budget (a soft preference): kept, but shown after the ones that fit it. Never saved. */
  budgetMiss?: boolean;
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
  /** Titles already shown in this deck (a follow-up): never shown twice. */
  exclude?: readonly string[];
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

/** Words that make an idea free by nature: a walk or a run outside, a public park, a library. */
const FREE_BY_NATURE = /\b(walk|walks|walking|stroll|wander|run|running|jog|park|library|libraries|picnic|beach|waterfront|promenade|bridge)\b/i;
/** A price stated in the title itself ("Free Thursday afternoon at ..."), read from the page. */
const SAYS_FREE = /\bfree\b/i;

/**
 * Free by nature (stubby-agent C3): verified free, not unknown. A Soosh page Stubby offered (their
 * own Pursuit, a Corner's start page), an idea that's a walk, a run or a public place, or a thing
 * whose own title says free. Never an event with no price on its page and nothing saying free.
 */
export function freeByNature(kind: AskPick["kind"], title: string, place: string | null, soosh: boolean): boolean {
  if (soosh || SAYS_FREE.test(title)) return true;
  return kind === "idea" && FREE_BY_NATURE.test(`${title} ${place ?? ""}`);
}

/** Words that don't make an idea "asked for" just by being in the ask and the title. */
const ASK_FILLER = new Set(["this", "that", "with", "your", "free", "some", "time", "week", "into", "from", "have", "just", "near", "about", "something", "things", "today", "tonight", "tomorrow", "weekend"]);

const DUP_STOP = new Set(["the", "a", "an", "at", "of", "and", "in", "on", "for", "with", "to"]);
/** A title as a duplicate key: lower case, no punctuation, no little words. "at the Museum" and "at Museum" match. */
export function sameThing(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DUP_STOP.has(w))
    .join(" ");
}

/** Checks every pick for one ask. Keeps the model's order (its ranking by fit). */
export function checkAskPicks(raw: readonly RawPick[], ctx: AskCheckContext): { kept: AskPick[]; dropped: Dropped[]; outcome: "found" | "after" | "nothing" } {
  const inWindow: AskPick[] = [];
  const later: AskPick[] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  const { intent, window } = ctx;
  const askLower = ctx.askText.toLowerCase();
  const shown = new Set((ctx.exclude ?? []).map((t) => sameThing(cleanText(t))));

  for (const r of raw) {
    const title = cleanText(r.title);
    const drop = (reason: string, key: ReasonKey = "other") => dropped.push({ title: (title || "A pick with no title").slice(0, 80), reason, key });
    if (!title) {
      drop("No title.");
      continue;
    }
    if (title.length > 80) {
      drop("Title is over 80 characters.");
      continue;
    }
    const kind: AskPick["kind"] = r.kind === "idea" ? "idea" : "event";
    if (shown.has(sameThing(title))) {
      drop("Already in the deck.");
      continue;
    }

    const startsAt = nyLocalToMs(r.starts);
    if (!Number.isFinite(startsAt)) {
      drop(kind === "idea" ? "No suggested time." : "No clear start time.", "notime");
      continue;
    }
    // An event needs an hour to get there; an idea can start any time from now.
    if (startsAt < ctx.now + (kind === "idea" ? 0 : HOUR)) {
      drop("Already started, or starts within the hour.", "time");
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
        drop(kind === "idea" ? "No real page for the place, and not a Soosh page Stubby offered." : "No https link of 500 characters or less.", "nopage");
        continue;
      }
      if (!ctx.sourceLinks.has(key)) {
        drop("Its link wasn't one of the pages the search found.", "nopage");
        continue;
      }
      if (isListingPage(url)) {
        drop("A page that lists many things, not its own page.", "listing");
        continue;
      }
    }

    const place = optional(r.place, 80);
    const price = optional(r.price, 40);
    const what = `${title} ${place.value ?? ""}`;

    if (!intent.adults && ADULT_WORDS.test(what)) {
      drop("A bar, brewery, tasting or 21+, and the ask didn't ask for one.", "adult");
      continue;
    }
    if (intent.who === "family" && nyHour(startsAt) >= FAMILY_LATEST_HOUR) {
      drop("Too late for a family outing.", "family");
      continue;
    }

    // The budget, as the page states the price, or free by nature.
    const stated = lowestPrice(price.value);
    const natural = stated === null && freeByNature(kind, title, place.value, soosh);
    const low = natural ? 0 : stated;
    const budget = intent.budget;
    const misses = !!budget && (budget.free ? low !== 0 : low !== null && low > budget.max);
    // Typed in the ask (or tightened by Cheaper): a hard limit. From the profile: a soft preference.
    if (budget && misses && budget.from === "ask") {
      if (low === null) drop("Price not listed, and only free things were asked for.", "noprice");
      else if (budget.free) drop("Not free.", "budget");
      else drop(`Over the budget (about $${budget.max} an outing).`, "budget");
      continue;
    }
    if (price.tooLong) notes.push("Price is long, check the page");
    else if (!price.value && !natural && (kind === "event" || misses)) notes.push("Price not listed");
    if (place.tooLong) notes.push("Place shortened away, check the page");
    const unsure = optional(r.unsure, 120).value;
    if (unsure && !notes.some((n) => n.toLowerCase() === unsure.toLowerCase())) notes.push(unsure);

    const cornerName = cleanText(r.corner).toLowerCase();
    const cornerId = cornerName ? (ctx.corners.get(cornerName) ?? null) : null;
    if (kind === "idea") {
      const inTheirCorners = cornerId !== null && ctx.pickedCornerIds.has(cornerId);
      const askWords = new Set(askLower.split(/[^a-z0-9]+/));
      // Whole words of 4 letters or more ("walk", "yoga"), leaving out filler like "this" or "free".
      const asked = (cornerName && askLower.includes(cornerName)) || title.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && !ASK_FILLER.has(w) && askWords.has(w));
      // Their own Pursuit, or a Corner's start page Stubby offered them, is always theirs.
      if (!inTheirCorners && !asked && !soosh) {
        drop("An idea outside their Corners that the ask didn't ask for.");
        continue;
      }
    }

    const k = `${sameThing(title)}|${startsAt}`;
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
      price: price.value ?? (natural ? "Free" : null),
      url,
      cornerId,
      note: notes.length ? notes.join(". ").slice(0, 200) : null,
      why: cleanWhy(r.why),
      betterWithFriend: intent.who === "solo" && isTrue(r.better_with_friend),
      after: false,
      ...(misses ? { budgetMiss: true } : {}),
    };

    // The window. Tonight also means home by midnight.
    const startsIn = startsAt >= window.startMs && startsAt < window.endMs;
    const endsIn = endsAt === null || window.label !== "tonight" || endsAt <= window.endMs;
    if (startsIn && endsIn) {
      inWindow.push(pick);
      continue;
    }
    if (startsIn) {
      drop("Ends after midnight.", "midnight");
      continue;
    }
    // Every rule but the time: kept as one of the soonest after, for any time asked (founder, Nov 2, 2026).
    if (kind === "event" && startsAt >= window.endMs && startsAt <= ctx.latestMs) {
      later.push(pick);
      drop("After the time asked for (kept as one of the soonest after, if nothing in it fits).", "time");
      continue;
    }
    drop(startsAt < window.startMs || !window.hard ? "Outside the time asked for." : "Not in the time asked for.", "time");
  }

  // At most one "better with a friend" per set.
  let nudged = false;
  const one = (p: AskPick) => {
    if (p.betterWithFriend && nudged) return { ...p, betterWithFriend: false };
    if (p.betterWithFriend) nudged = true;
    return p;
  };

  // The profile's budget is soft: picks that miss it keep their order, after the ones that fit.
  const fitsFirst = (list: AskPick[]) => [...list.filter((p) => !p.budgetMiss), ...list.filter((p) => p.budgetMiss)];

  if (inWindow.length > 0) {
    // The model ranks up to 10 candidates; the best 3 are kept.
    const ranked = fitsFirst(inWindow);
    for (const extra of ranked.slice(ASK_BEST)) dropped.push({ title: extra.title, reason: `Over the ${ASK_BEST} picks for one ask.`, key: "other" });
    return { kept: ranked.slice(0, ASK_BEST).map(one), dropped, outcome: "found" };
  }
  if (later.length > 0) {
    const soonest = fitsFirst([...later].sort((a, b) => a.startsAt - b.startsAt)).slice(0, AFTER_MOST).map((p) => one({ ...p, after: true }));
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
    better_with_friend: p.betterWithFriend,
  };
}

/** The reasons a person sees when nothing fits: the 3 most common kinds, never "other". */
export function topReasons(dropped: readonly Dropped[], most = 3): { key: Exclude<ReasonKey, "other">; count: number }[] {
  const counts = new Map<Exclude<ReasonKey, "other">, number>();
  for (const d of dropped) if (d.key && d.key !== "other") counts.set(d.key, (counts.get(d.key) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, most);
}

/** What the second search round aims at: what was kept, what was dropped and why. */
export function gapLines(kept: readonly AskPick[], dropped: readonly Dropped[]): string {
  const why: Record<Exclude<ReasonKey, "other">, string> = {
    listing: "pages that list many things (find each event's own page instead)",
    midnight: "things that end after midnight",
    time: "things outside the time asked for",
    budget: "things over the budget",
    noprice: "things with no price on their page (only free things fit: find ones whose page says free)",
    adult: "bars, tastings or 21+",
    nopage: "links that weren't pages from your search",
    notime: "pages with no clear date and start time",
    family: "things too late for kids",
  };
  const reasons = topReasons(dropped, 5).map((r) => `${r.count} ${why[r.key]}`);
  return [
    `Your first search found ${kept.length === 0 ? "nothing" : `only ${kept.length}`} that fit. Search again, aimed at what's missing.`,
    reasons.length ? `Dropped so far: ${reasons.join("; ")}. Avoid those.` : "",
    kept.length ? `Already found (don't report these again): ${kept.map((k) => `"${k.title.replace(/"/g, "'")}"`).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

