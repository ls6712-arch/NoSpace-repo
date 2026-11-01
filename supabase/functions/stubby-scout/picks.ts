// Stubby's scout: everything about turning what the model wrote into City pick drafts.
// Pure: no network, no database, no Deno. Tested with vitest (stubby-scout.test.ts).
//
// The model's output is never trusted. A pick is only kept when:
//   - it has a title, and a start in New York time that is at least an hour away and at most
//     SCOUT_DAYS days away (an end, if given, is after the start and within 12 hours);
//   - its link is https and is one of the pages the web search actually returned, so the
//     scout can't invent a page;
//   - it isn't already a City pick (same title, same start), or a repeat within the run.
// Anything it is unsure of (no price on the page, say) is kept as a short note for the admin.

export const SCOUT_DAYS = 14;
export const SCOUT_MAX_PICKS = 12;
export const HOME_TZ = "America/New_York";
const HOUR = 3_600_000;
const LEAD_MS = HOUR;
const MAX_LENGTH_MS = 12 * HOUR;

/** The eight colours a City pick can have (city_picks.color). The scout takes them in turn. */
export const PICK_COLORS = ["rose", "orange", "violet", "blue", "amber", "lime", "teal", "pink"] as const;

/** One pick as the model wrote it. Every field is unknown until checked. */
export interface RawPick {
  title?: unknown;
  place?: unknown;
  starts?: unknown;
  ends?: unknown;
  price?: unknown;
  url?: unknown;
  corner?: unknown;
  unsure?: unknown;
}

/** A checked pick, ready to save as a draft. */
export interface ScoutPick {
  title: string;
  place: string | null;
  startsAt: number;
  endsAt: number | null;
  price: string | null;
  url: string;
  cornerId: number | null;
  note: string | null;
}

export interface Dropped {
  title: string;
  reason: string;
}

// ── text ──────────────────────────────────────────────────────────────────

/** One line of plain text: no control characters, no markup brackets, single spaces, plain hyphens for long dashes. */
export function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s*[–—]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text or null, null when blank or longer than `max`. */
function optional(v: unknown, max: number): { value: string | null; tooLong: boolean } {
  const t = cleanText(v);
  if (!t || /^(null|unknown|n\/a|none|tbd|tba)$/i.test(t)) return { value: null, tooLong: false };
  if (t.length > max) return { value: null, tooLong: true };
  return { value: t, tooLong: false };
}

// ── links ─────────────────────────────────────────────────────────────────

/** A link as a comparable key: https only, lower-case host, no hash, no trailing slash. Null if not a real https link. */
export function linkKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let u: URL;
  try {
    u = new URL(v.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
  u.hash = "";
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.hostname.toLowerCase()}${path}${u.search}`;
}

// ── New York time ─────────────────────────────────────────────────────────

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: HOME_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** New York's offset from UTC at an instant, in ms (negative: -4h or -5h). */
function nyOffset(ms: number): number {
  const p: Record<string, number> = {};
  for (const x of parts.formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000;
}

/** "2026-11-07T19:30" read as New York wall clock time, to ms. NaN if it isn't that shape or isn't a real time. */
export function nyLocalToMs(v: unknown): number {
  if (typeof v !== "string") return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return NaN;
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(wall).getUTCDate() !== d) return NaN; // 31 November
  let ms = wall - nyOffset(wall);
  ms = wall - nyOffset(ms); // settles across a clock change
  return ms;
}

/** Ms to "2026-11-07T19:30" in New York: what the prompt shows as "now". */
export function msToNyLocal(ms: number): string {
  const p: Record<string, string> = {};
  for (const x of parts.formatToParts(new Date(ms))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ── the model's answer ────────────────────────────────────────────────────

/** The JSON list between <picks> and </picks>, or null when there is none or it isn't a list. */
export function readPicksBlock(text: string): RawPick[] | null {
  const m = /<picks>([\s\S]*?)<\/picks>/i.exec(text);
  if (!m) return null;
  const body = m[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const v = JSON.parse(body);
    return Array.isArray(v) ? v.filter((x): x is RawPick => !!x && typeof x === "object" && !Array.isArray(x)) : null;
  } catch {
    return null;
  }
}

/** "title|start ms": how a pick is recognised as one already saved. */
export const pickKey = (title: string, startsAt: number) => `${title.trim().toLowerCase()}|${startsAt}`;

export interface CheckContext {
  now: number;
  /** linkKey() of every page the web search returned or cited this run. */
  sourceLinks: ReadonlySet<string>;
  /** Corner names (any case) to their ids. */
  corners: ReadonlyMap<string, number>;
  /** pickKey() of every City pick already saved around this window. */
  existing: ReadonlySet<string>;
}

/** Checks every pick; keeps at most SCOUT_MAX_PICKS, soonest first. */
export function checkPicks(raw: readonly RawPick[], ctx: CheckContext): { kept: ScoutPick[]; dropped: Dropped[] } {
  const kept: ScoutPick[] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  const latest = ctx.now + SCOUT_DAYS * 24 * HOUR;

  for (const r of raw) {
    const title = cleanText(r.title);
    const label = title || "A pick with no title";
    const drop = (reason: string) => dropped.push({ title: label.slice(0, 80), reason });

    if (!title) {
      drop("No title.");
      continue;
    }
    if (title.length > 80) {
      drop("Title is over 80 characters.");
      continue;
    }

    const startsAt = nyLocalToMs(r.starts);
    if (!Number.isFinite(startsAt)) {
      drop("No clear start time.");
      continue;
    }
    if (startsAt < ctx.now + LEAD_MS) {
      drop("Already started, or starts within the hour.");
      continue;
    }
    if (startsAt > latest) {
      drop(`More than ${SCOUT_DAYS} days away.`);
      continue;
    }

    let endsAt: number | null = null;
    const notes: string[] = [];
    if (r.ends !== undefined && r.ends !== null && cleanText(r.ends) !== "") {
      const e = nyLocalToMs(r.ends);
      if (Number.isFinite(e) && e > startsAt && e - startsAt <= MAX_LENGTH_MS) endsAt = e;
      else notes.push("End time unclear");
    }

    const key = linkKey(r.url);
    if (!key || (r.url as string).trim().length > 500) {
      drop("No https link of 500 characters or less.");
      continue;
    }
    if (!ctx.sourceLinks.has(key)) {
      drop("Its link wasn't one of the pages the search found.");
      continue;
    }

    const k = pickKey(title, startsAt);
    if (ctx.existing.has(k)) {
      drop("Already a City pick.");
      continue;
    }
    if (seen.has(k)) {
      drop("Found twice in this run.");
      continue;
    }
    seen.add(k);

    const place = optional(r.place, 80);
    if (place.tooLong) notes.push("Place shortened away, check the page");
    const price = optional(r.price, 40);
    if (price.tooLong) notes.push("Price is long, check the page");
    else if (!price.value) notes.push("Price not listed");

    const unsure = optional(r.unsure, 120).value;
    if (unsure) notes.push(unsure);

    const cornerName = cleanText(r.corner).toLowerCase();
    const cornerId = cornerName ? (ctx.corners.get(cornerName) ?? null) : null;

    const note = notes.length ? notes.join(". ").slice(0, 200) : null;
    kept.push({
      title,
      place: place.value,
      startsAt,
      endsAt,
      price: price.value,
      url: (r.url as string).trim(),
      cornerId,
      note,
    });
  }

  kept.sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title));
  for (const extra of kept.splice(SCOUT_MAX_PICKS)) dropped.push({ title: extra.title, reason: `Over the ${SCOUT_MAX_PICKS} pick limit for one run.` });
  return { kept, dropped };
}

/**
 * A pick goes live by itself only when it has nothing to double check (founder, Nov 1, 2026).
 * Any note (price not listed, end unclear, the model unsure) means it waits for an admin.
 */
export const publishable = (p: ScoutPick) => p.note === null;

/** The row to insert: from the scout, with its source and when it was read; live only when clean. */
export function rowFor(p: ScoutPick, index: number, city: string, checkedAt: number, requestedBy: string | null = null) {
  return {
    city,
    title: p.title,
    place: p.place,
    starts_at: new Date(p.startsAt).toISOString(),
    ends_at: p.endsAt === null ? null : new Date(p.endsAt).toISOString(),
    price: p.price,
    url: p.url,
    source_url: p.url,
    corner_id: p.cornerId,
    color: PICK_COLORS[index % PICK_COLORS.length],
    published: publishable(p),
    found_by: "scout",
    requested_by: requestedBy,
    checked_at: new Date(checkedAt).toISOString(),
    scout_note: p.note,
  };
}
