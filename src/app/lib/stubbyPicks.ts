import { reasonLine, affordable, parsePrice, passFor, MIN_LEAD_MS, WEEK_MS, type LiveEventInput, type LivePursuitInput, type PlanInput } from "./firstPlan";
import { nyParts } from "./homeWeek";
import type { Pass } from "./tasteModel";
import { planSpan } from "./weekView";

/**
 * Stubby's picks (calendar brief section 5). For each free stretch in the next
 * 7 days, at most one thing from a Corner the person picked, inside their
 * budget, that fits the whole stretch. It is pure and runs in the browser on
 * what is already on screen: nothing about a pick, a Keep or a Not this is
 * sent anywhere. If nothing fits, the stretch gets no pick (never filler), and
 * the screen says "Find something".
 */

/** After this many Not this on one stretch it goes back to Find something. */
export const NOT_THIS_MAX = 3;

export interface PickSlot {
  /** Stable for a stretch across reloads and the clock moving: its date and window ("2026-11-03:tue-eve"). */
  key: string;
  startMs: number;
  endMs: number;
}

export interface StubbyPick {
  /** "event:12" or "pursuit:abc". */
  id: string;
  kind: "event" | "open-pursuit";
  title: string;
  corner: { key: string; name: string; spaceSlug: string; slug: string };
  startsAt: number;
  endsAt: number;
  where?: string;
  /** "Free", "$25", "your climbing pass", or nothing when the host gave no price. */
  cost?: string;
  /** Always true: only repeats an answer the person gave. */
  reason: string;
  eventId?: number;
  pursuitId?: string;
  hostName?: string;
}

export interface PickInput {
  now: number;
  slots: readonly PickSlot[];
  picks: PlanInput["picks"];
  events: readonly LiveEventInput[];
  pursuits: readonly LivePursuitInput[];
  /** The usual week, for a reason line that names it only when it is true. */
  windows: readonly string[];
  /** Dollars a month, 0 for free only, null when skipped. */
  budget: number | null;
  passes: readonly Pass[];
  /** Their saved area. Things whose place names it come first; the rest are still fine ("in or near"). */
  area?: string;
  /** Ids said Not this to, by stretch. A thing said no to is not offered in any stretch. */
  declined: Readonly<Record<string, readonly string[]>>;
  /** Ids already on the calendar: nothing is picked twice. */
  taken: ReadonlySet<string>;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** "sat-eve" for a moment in New York, or null in the small hours. */
export function nyWindowKey(ms: number): string | null {
  const p = nyParts(ms);
  return p.hour >= 18 ? `${DAY_KEYS[p.dow]}-eve` : p.hour >= 6 ? `${DAY_KEYS[p.dow]}-day` : null;
}

interface Candidate {
  pick: StubbyPick;
  place: string;
}

function candidates(input: PickInput): Candidate[] {
  const { now, budget, passes } = input;
  const byKey = new Map(input.picks.map((p) => [p.key, p]));
  const gone = new Set(Object.values(input.declined).flat());
  const windowKey = (t: number) => {
    const w = nyWindowKey(t);
    return w && input.windows.includes(w) ? w : null;
  };
  const ok = (id: string, startsAt: number) => !input.taken.has(id) && !gone.has(id) && startsAt >= now + MIN_LEAD_MS && startsAt <= now + WEEK_MS;
  const out: Candidate[] = [];
  for (const e of input.events) {
    const corner = byKey.get(e.cornerKey);
    const id = `event:${e.eventId}`;
    if (!corner || !ok(id, e.startsAt)) continue;
    const pass = passFor(corner.slug, passes);
    const price = parsePrice(e.price);
    if (!affordable(budget, price, !!pass)) continue;
    out.push({
      place: e.place ?? "",
      pick: {
        id,
        kind: "event",
        title: e.title,
        corner,
        startsAt: e.startsAt,
        endsAt: planSpan(e.startsAt, e.endsAt).endMs,
        where: e.place || (e.online ? "Online" : undefined),
        cost: pass ? `your ${pass.label.toLowerCase()} pass` : price === null ? undefined : price === 0 ? "Free" : `$${price}`,
        reason: reasonLine({ windowKey: windowKey(e.startsAt), cornerName: corner.name, pass }),
        eventId: e.eventId,
      },
    });
  }
  for (const p of input.pursuits) {
    const corner = byKey.get(p.cornerKey);
    const id = `pursuit:${p.pursuitId}`;
    if (!corner || !ok(id, p.startsAt)) continue;
    out.push({
      place: "",
      pick: {
        id,
        kind: "open-pursuit",
        title: p.title,
        corner,
        startsAt: p.startsAt,
        endsAt: planSpan(p.startsAt).endMs,
        reason: reasonLine({ windowKey: windowKey(p.startsAt), cornerName: corner.name, pass: passFor(corner.slug, passes) }),
        pursuitId: p.pursuitId,
        hostName: p.hostName.trim().split(/\s+/)[0],
      },
    });
  }
  return out;
}

/**
 * One pick per stretch, soonest stretch first, no thing twice. A thing is only
 * picked for a stretch that holds all of it, so a 1 hour stretch never gets
 * a 2 hour thing. Among what fits, a place that names the person's area comes
 * first, then the soonest start. Keyed by stretch.
 */
export function stubbyPicks(input: PickInput): Map<string, StubbyPick> {
  const out = new Map<string, StubbyPick>();
  const area = input.area?.trim().toLowerCase();
  const pool = candidates(input);
  const used = new Set<string>();
  const stretches = [...input.slots].filter((s) => s.startMs < input.now + WEEK_MS).sort((a, b) => a.startMs - b.startMs);
  for (const slot of stretches) {
    if ((input.declined[slot.key]?.length ?? 0) >= NOT_THIS_MAX) continue;
    const fits = pool
      .filter((c) => !used.has(c.pick.id) && c.pick.startsAt >= slot.startMs && c.pick.endsAt <= slot.endMs)
      .sort((a, b) => {
        const near = Number(!!area && b.place.toLowerCase().includes(area)) - Number(!!area && a.place.toLowerCase().includes(area));
        return near || a.pick.startsAt - b.pick.startsAt || a.pick.id.localeCompare(b.pick.id);
      });
    if (fits[0]) {
      out.set(slot.key, fits[0].pick);
      used.add(fits[0].pick.id);
    }
  }
  return out;
}
