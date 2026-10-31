import { cornerGuide } from "../data/cornerGuides";
import { formatTime, formatWeekday } from "./dates";
import { DAYS, SLOTS, type DayKey, type Pass, type PassKind, type SlotKey, windowKey } from "./tasteModel";

/**
 * The first plan (onboarding screen 11, brief section 6). Pure: given what the
 * person answered and what is live near them, it orders the plans to offer.
 * Nothing here claims more than is known: a reason line only repeats an
 * answer that matched, a price is shown only when the listing gives one, and
 * a pass is named, never turned into "$0".
 */

export type PlanKind = "invite" | "event" | "open-pursuit" | "at-home";

export interface Plan {
  /** Stable for one run: kind plus the thing's id. */
  id: string;
  kind: PlanKind;
  title: string;
  corner: { key: string; name: string; spaceSlug: string; slug: string };
  /** Milliseconds, or null for a friend's Pursuit that has no time yet. */
  startsAt: number | null;
  /** "Thursday, 7:00 PM" for a listing, "Saturday afternoon" for an at-home plan. */
  when: string | null;
  where?: string;
  /** Only a listed price. No price known means no cost line. */
  cost?: string;
  /** Required, and true. */
  reason: string;
  eventId?: number;
  pursuitId?: string;
  joinToken?: string;
  /** The host or friend, first name. */
  hostName?: string;
  /** At-home: the guide's first step. */
  step?: string;
}

export interface LiveEventInput {
  cornerKey: string;
  eventId: number;
  title: string;
  startsAt: number;
  /** Null when the listing has no end. */
  endsAt?: number | null;
  place?: string;
  /** Free text from the host ("Free", "$12"), when the listing has one. */
  price?: string | null;
  online: boolean;
}

export interface LivePursuitInput {
  cornerKey: string;
  pursuitId: string;
  title: string;
  /** The Pursuit's next session. One with no session has no time and is not offered. */
  startsAt: number;
  hostName: string;
  /** Joining sends a request the host answers (more than half the spots are taken). Left out when it joins at once. */
  needsApproval?: boolean;
}

export interface InviteInput {
  pursuitId: string;
  token: string;
  title: string;
  hostName: string;
  cornerKey?: string;
  startsAt?: number | null;
}

export interface PlanInput {
  now: number;
  picks: { key: string; name: string; spaceSlug: string; slug: string }[];
  windows: readonly string[];
  /** Dollars a month, 0 for free only, null when skipped. */
  budget: number | null;
  passes: readonly Pass[];
  events: readonly LiveEventInput[];
  pursuits: readonly LivePursuitInput[];
  invite?: InviteInput | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The soonest a plan can start: time to read it, decide and get there. */
export const MIN_LEAD_MS = 2 * HOUR;
/** "Tonight or the next free window, within 72 hours". */
export const NEAR_MS = 72 * HOUR;
/** "This week". */
export const WEEK_MS = 7 * DAY;
/** After this many plans, "Show me something else" opens Discover. */
export const PLANS_SHOWN_MAX = 3;

/** What an at-home plan's window means as a start time: a daytime window is the afternoon, an evening one 7pm. */
const SLOT_START_HOUR: Record<SlotKey, number> = { day: 14, eve: 19 };
const SLOT_PART: Record<SlotKey, string> = { day: "afternoon", eve: "evening" };
const SLOT_PLURAL: Record<SlotKey, string> = { day: "daytimes", eve: "evenings" };
/** A listing counts as in a window by its own start time: 6am to 5:59pm is daytime, 6pm to midnight is evening. */
export function slotOf(startsAt: number): SlotKey | null {
  const h = new Date(startsAt).getHours();
  if (h >= 6 && h < 18) return "day";
  if (h >= 18) return "eve";
  return null;
}

// Date#getDay(): Sunday is 0.
const DAY_INDEX: Record<DayKey, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_BY_INDEX = (i: number): DayKey => (Object.keys(DAY_INDEX) as DayKey[]).find((k) => DAY_INDEX[k] === i) ?? "sun";

/** The window a time falls in, as "sat-day", or null (the small hours). */
export function windowOfTime(startsAt: number): string | null {
  const slot = slotOf(startsAt);
  return slot ? windowKey(DAY_BY_INDEX(new Date(startsAt).getDay()), slot) : null;
}

export interface UpcomingWindow {
  key: string;
  day: DayKey;
  slot: SlotKey;
  startsAt: number;
}

/** The person's free windows as real times in the next week, soonest first. */
export function upcomingWindows(windows: readonly string[], now: number): UpcomingWindow[] {
  const out: UpcomingWindow[] = [];
  const base = new Date(now);
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const key = windowKey(day.key, slot.key);
      if (!windows.includes(key)) continue;
      for (let offset = 0; offset < 8; offset++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, SLOT_START_HOUR[slot.key], 0, 0, 0);
        if (d.getDay() === DAY_INDEX[day.key] && d.getTime() >= now + MIN_LEAD_MS) {
          out.push({ key, day: day.key, slot: slot.key, startsAt: d.getTime() });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

/** "Saturday afternoon". */
export const windowWhen = (w: UpcomingWindow) => `${formatWeekday(w.startsAt, "long")} ${SLOT_PART[w.slot]}`;
/** "Thursday, 7:00 PM". */
export const listingWhen = (startsAt: number) => `${formatWeekday(startsAt, "long")}, ${formatTime(startsAt)}`;

/** The saturday you get with no free windows answered: the next Saturday afternoon. */
export function defaultWindow(now: number): UpcomingWindow {
  return upcomingWindows(["sat-day"], now)[0];
}

/** "Tonight’s yours." and its relatives, by when the plan starts. */
export function headlineFor(startsAt: number | null, now: number): string {
  if (startsAt === null) return "Here’s one for this week.";
  const start = new Date(startsAt);
  const today = new Date(now);
  const dayDiff = Math.round(
    (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      DAY,
  );
  if (dayDiff <= 0) return start.getHours() >= 17 ? "Tonight’s yours." : "Today’s yours.";
  if (dayDiff === 1) return "Tomorrow’s yours.";
  const dow = start.getDay();
  if ((dow === 6 || dow === 0) && dayDiff <= 6) return "This weekend’s yours.";
  return "Here’s one for this week.";
}

/** "$12" or "Free" from a host's own words; null when it says nothing usable. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/\bfree\b/i.test(text)) return 0;
  const m = /\$\s?(\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) : null;
}

/** Which kind of pass covers a Corner. Only the pairs that are plainly true. */
const PASS_FOR_CORNER: Record<string, PassKind> = { climbing: "climbing", cycling: "bike" };

export function passFor(cornerSlug: string, passes: readonly Pass[]): Pass | null {
  const kind = PASS_FOR_CORNER[cornerSlug];
  return kind ? (passes.find((p) => p.kind === kind) ?? null) : null;
}

/**
 * Can this be offered within what they said about money? A skipped budget or
 * Free only allows free things and things a pass of theirs is for. A set
 * budget allows a listing whose price is unknown or within the month.
 */
export function affordable(budget: number | null, price: number | null, hasPass: boolean): boolean {
  if (hasPass) return true;
  if (budget === null || budget === 0) return price === 0;
  return price === null || price <= budget;
}

const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** "Thursday evenings", for the reason line, from the window that matched. */
const windowPhrase = (key: string) => {
  const [d, s] = key.split("-") as [DayKey, SlotKey];
  const day = DAYS.find((x) => x.key === d)?.label ?? "";
  return `${day} ${SLOT_PLURAL[s] ?? ""}`.trim();
};

export function reasonLine(opts: { windowKey?: string | null; cornerName: string; pass?: Pass | null }): string {
  const picked = `you picked ${opts.cornerName}`;
  const base = opts.windowKey ? `You said ${windowPhrase(opts.windowKey)} work, and ${picked}.` : `${picked[0].toUpperCase()}${picked.slice(1)}.`;
  return opts.pass ? `${base} You have a ${opts.pass.label.toLowerCase()} pass.` : base;
}

/**
 * The plans to offer, in order: a friend's Pursuit, then listings in the next
 * 72 hours (soonest first), then listings later this week, then plans to do at
 * home from a picked Corner's guide. Listings must fall in a free window (when
 * any were given), be in a picked Corner, and fit the budget.
 */
export function buildPlans(input: PlanInput): Plan[] {
  const { now, windows, budget, passes } = input;
  const pickByKey = new Map(input.picks.map((p) => [p.key, p]));
  const plans: Plan[] = [];

  if (input.invite) {
    const i = input.invite;
    const pick = i.cornerKey ? pickByKey.get(i.cornerKey) : undefined;
    const slug = i.cornerKey?.split("/")[1] ?? "";
    const space = i.cornerKey?.split("/")[0] ?? "";
    plans.push({
      id: `invite:${i.pursuitId}`,
      kind: "invite",
      title: i.title,
      corner: { key: i.cornerKey ?? "", name: pick?.name ?? i.title, spaceSlug: pick?.spaceSlug ?? space, slug: pick?.slug ?? slug },
      startsAt: i.startsAt ?? null,
      when: i.startsAt ? listingWhen(i.startsAt) : null,
      reason: `${firstOf(i.hostName)} is already in.`,
      pursuitId: i.pursuitId,
      joinToken: i.token,
      hostName: firstOf(i.hostName),
    });
  }

  const inWindow = (t: number) => {
    if (t < now + MIN_LEAD_MS || t > now + WEEK_MS) return null;
    if (windows.length === 0) return { key: null as string | null };
    const w = windowOfTime(t);
    return w && windows.includes(w) ? { key: w } : null;
  };

  const live: (Plan & { sort: number })[] = [];
  for (const e of input.events) {
    const pick = pickByKey.get(e.cornerKey);
    const fit = inWindow(e.startsAt);
    if (!pick || !fit) continue;
    const price = parsePrice(e.price);
    const pass = passFor(pick.slug, passes);
    if (!affordable(budget, price, !!pass)) continue;
    live.push({
      id: `event:${e.eventId}`,
      kind: "event",
      title: e.title,
      corner: pick,
      startsAt: e.startsAt,
      when: listingWhen(e.startsAt),
      where: e.place || (e.online ? "Online" : undefined),
      cost: price === null ? undefined : price === 0 ? "Free" : `$${price}`,
      reason: reasonLine({ windowKey: fit.key, cornerName: pick.name, pass }),
      eventId: e.eventId,
      sort: e.startsAt,
    });
  }
  for (const p of input.pursuits) {
    const pick = pickByKey.get(p.cornerKey);
    const fit = inWindow(p.startsAt);
    if (!pick || !fit) continue;
    live.push({
      id: `pursuit:${p.pursuitId}`,
      kind: "open-pursuit",
      title: p.title,
      corner: pick,
      startsAt: p.startsAt,
      when: listingWhen(p.startsAt),
      reason: reasonLine({ windowKey: fit.key, cornerName: pick.name, pass: passFor(pick.slug, passes) }),
      pursuitId: p.pursuitId,
      hostName: firstOf(p.hostName),
      sort: p.startsAt,
    });
  }
  const near = live.filter((p) => p.sort <= now + NEAR_MS).sort((a, b) => a.sort - b.sort);
  const later = live.filter((p) => p.sort > now + NEAR_MS).sort((a, b) => a.sort - b.sort);
  for (const p of [...near, ...later]) {
    const { sort: _sort, ...plan } = p;
    plans.push(plan);
  }

  plans.push(...atHomePlans(input));
  return plans;
}

/** One plan to do at home per picked Corner that has a guide, each in the next free window (a different one where there are several). */
export function atHomePlans(input: PlanInput): Plan[] {
  const { now, windows, budget, passes } = input;
  const slots = upcomingWindows(windows, now);
  const fallback = defaultWindow(now);
  const out: Plan[] = [];
  for (const pick of input.picks) {
    const guide = cornerGuide(pick.spaceSlug, pick.slug);
    if (!guide || guide.adultsOnly || guide.where === "outdoors" || guide.together === "together") continue;
    // A skipped budget or Free only means nothing that has to be bought.
    if ((budget === null || budget === 0) && !guide.haveIt) continue;
    const w = slots.length > 0 ? slots[out.length % slots.length] : fallback;
    out.push({
      id: `home:${pick.key}`,
      kind: "at-home",
      title: `${pick.name} at home`,
      corner: pick,
      startsAt: w.startsAt,
      when: windowWhen(w),
      reason: reasonLine({ windowKey: slots.length > 0 ? w.key : null, cornerName: pick.name, pass: passFor(pick.slug, passes) }),
      step: guide.step,
    });
  }
  return out;
}
