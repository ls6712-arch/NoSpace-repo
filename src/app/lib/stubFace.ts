import type { StubItem } from "./profileApi";
import type { StubKind } from "./stubs";
import { cornerColor } from "./categoryStyle";
import { cornerName } from "./homeItems";
import { formatDate, formatMonth } from "./dates";

/**
 * Everything a Stub's artwork prints, already worded. Built from the profile's
 * list (faceFromItem) or from a Stub just earned (faceFromEarned), so the
 * artwork never reaches for data itself.
 */
export interface StubFace {
  id?: number;
  kind: StubKind;
  /** The big line: a Pursuit's title, a drop's title, a Space's name, a Corner's name. */
  title: string;
  cornerName?: string;
  /** CSS colour of the Corner, for paper and edges. */
  color: string;
  /** "Oct 31". */
  day: string;
  /** Regular: "Oct" for the metal band, "October" for the line. */
  monthShort?: string;
  monthLong?: string;
  /** Finisher and drop: the goal, in Moments. */
  goal?: number;
  photoUrl?: string;
  /** Drop. */
  edition?: number;
  editionsTotal?: number;
  palette?: readonly string[];
  /** Was there. Absent when the viewer may see only the Corner and month. */
  hostName?: string;
  neighborhood?: string;
  eventTitle?: string;
  /** Owner only. */
  serial?: number;
}

const colorOf = (key?: string): string => {
  const [space, slug] = key?.split("/") ?? [];
  return space && slug ? `var(--cat-${cornerColor(space, slug)})` : "var(--cat-orange)";
};

const day = (ymd: string): Date => new Date(`${ymd}T12:00:00`);
const monthShortOf = (d: Date): string => formatDate(d, { year: false }).split(" ")[0] ?? "";

/** The first name only: a host's full name never goes on a Stub. */
const firstName = (name?: string): string | undefined => name?.trim().split(/\s+/)[0]?.slice(0, 30) || undefined;

/** A Stub from get_profile_stubs. */
export function faceFromItem(s: StubItem, coverUrl?: string): StubFace {
  const corner = s.cornerKey ? cornerName(s.cornerKey) : undefined;
  const base = { id: s.id, kind: s.kind, cornerName: corner, color: colorOf(s.cornerKey), day: formatDate(day(s.day)), serial: s.serial };
  switch (s.kind) {
    case "regular": {
      const m = day(`${s.period ?? s.day.slice(0, 7)}-01`);
      return { ...base, title: corner ?? "Corner", monthShort: monthShortOf(m), monthLong: formatMonth(m) };
    }
    case "drop":
      return {
        ...base,
        title: s.drop?.title ?? s.title ?? "Drop",
        goal: s.goal,
        edition: s.drop?.edition,
        editionsTotal: s.drop?.editionsTotal,
        palette: s.drop?.palette,
      };
    case "event":
      if (s.event?.full) {
        return { ...base, title: s.event.spaceName, eventTitle: s.title, hostName: firstName(s.event.hostName), neighborhood: s.event.neighborhood };
      }
      return { ...base, title: corner ?? "An event", day: s.event && !s.event.full ? formatMonth(day(`${s.event.month}-01`)) : base.day };
    default:
      return { ...base, title: s.title ?? "Pursuit", goal: s.goal, photoUrl: coverUrl };
  }
}

/** What fetchEarnedStub returns: a Stub just issued, with its Pursuit and drop. */
export interface EarnedStub {
  id: number;
  kind: StubKind;
  serial: number | null;
  issuedAt: string;
  cornerKey?: string;
  period?: string;
  edition?: number;
  pursuitTitle?: string;
  coverPath?: string;
  goal?: number;
  drop?: { title: string; palette: string[]; targetMoments: number };
}

/** A Stub just earned (Posted, the recap). */
export function faceFromEarned(e: EarnedStub, coverUrl?: string): StubFace {
  const corner = e.cornerKey ? cornerName(e.cornerKey) : undefined;
  const base = { id: e.id, kind: e.kind, cornerName: corner, color: colorOf(e.cornerKey), day: formatDate(e.issuedAt), serial: e.serial ?? undefined };
  switch (e.kind) {
    case "regular": {
      const m = e.period ? day(e.period.slice(0, 10)) : new Date(e.issuedAt);
      return { ...base, title: corner ?? "Corner", monthShort: monthShortOf(m), monthLong: formatMonth(m) };
    }
    case "drop":
      return { ...base, title: e.drop?.title ?? e.pursuitTitle ?? "Drop", goal: e.drop?.targetMoments, edition: e.edition, palette: e.drop?.palette };
    case "event":
      return { ...base, title: corner ?? "An event" };
    default:
      return { ...base, title: e.pursuitTitle ?? corner ?? "Pursuit", goal: e.goal, photoUrl: coverUrl };
  }
}

/** The kind's label (glossary, Oct 31, 2026). */
export const KIND_LABEL: Record<StubKind, string> = { finish: "Finisher", drop: "Drop", event: "Was there", regular: "Regular" };
