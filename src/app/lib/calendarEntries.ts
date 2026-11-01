import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { nyParts, nyTimeToMs } from "./homeWeek";
import { ERROR_LINE } from "./stateCopy";
import { mergeSpans, planSpan, weekDays, windowsAcross, type Span, type WeekPlanDetail } from "./weekView";

/**
 * What changes a person's usual week: one-off or weekly free time ("I'm free
 * then"), "not free this time", and private blocks (migration 20261031185723).
 * `effectiveFreeTime` is the one place that says what is free: the usual week
 * plus free entries, minus busy entries, blocks, busy times from elsewhere and
 * plans. It is pure and runs in New York time.
 */

export type EntryKind = "free" | "busy" | "block";
export type EntryRepeat = "none" | "weekly";

export interface CalendarEntry {
  id: number;
  kind: EntryKind;
  startsAt: number;
  endsAt: number;
  repeat: EntryRepeat;
  /** Blocks only, at most 80 characters. */
  note?: string;
}

export const NOTE_MAX = 80;
const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;
/** A stretch of free time shorter than this is not worth showing. */
export const MIN_FREE_MS = HOUR;

/** One showing of an entry: the entry may repeat, so the same id can have many. */
export interface Occurrence extends Span {
  entry: CalendarEntry;
}

/**
 * Where an entry falls inside [fromMs, toMs). A weekly entry repeats at the same
 * New York clock time on the same weekday, from its first date on, so it stays at
 * 9 AM across the clock change. Its length is kept in real time.
 */
export function occurrences(entry: CalendarEntry, fromMs: number, toMs: number): Occurrence[] {
  const length = entry.endsAt - entry.startsAt;
  if (!(length > 0)) return [];
  if (entry.repeat === "none") {
    return entry.startsAt < toMs && entry.endsAt > fromMs ? [{ startMs: entry.startsAt, endMs: entry.endsAt, entry }] : [];
  }
  const p = nyParts(entry.startsAt);
  const extra = Math.round((entry.startsAt - nyTimeToMs(p.y, p.m, p.d, p.hour)) / 60_000);
  const out: Occurrence[] = [];
  const first = Math.max(0, Math.floor((fromMs - length - entry.startsAt) / WEEK) - 1);
  const last = Math.ceil((toMs - entry.startsAt) / WEEK) + 1;
  for (let k = first; k <= last; k++) {
    const startMs = k === 0 ? entry.startsAt : nyTimeToMs(p.y, p.m, p.d + 7 * k, p.hour) + extra * 60_000;
    const endMs = startMs + length;
    if (startMs < toMs && endMs > fromMs) out.push({ startMs, endMs, entry });
  }
  return out;
}

/** What is left of `from` after taking `out` away. Both are merged first. */
export function subtractSpans(from: readonly Span[], out: readonly Span[]): Span[] {
  const cut = mergeSpans(out);
  let rest = mergeSpans(from);
  for (const c of cut) {
    const next: Span[] = [];
    for (const s of rest) {
      if (c.endMs <= s.startMs || c.startMs >= s.endMs) next.push(s);
      else {
        if (c.startMs > s.startMs) next.push({ startMs: s.startMs, endMs: c.startMs });
        if (c.endMs < s.endMs) next.push({ startMs: c.endMs, endMs: s.endMs });
      }
    }
    rest = next;
  }
  return rest;
}

export interface FreeTimeInput {
  /** The usual week: "sat-day", "tue-eve". */
  windows: readonly string[];
  entries: readonly CalendarEntry[];
  plans: readonly WeekPlanDetail[];
  /** Busy times from a connected calendar (a later change). Empty calendar time is never free time, so nothing is ever added from it. */
  busy?: readonly Span[];
  fromMs: number;
  toMs: number;
}

/** The person's free time in [fromMs, toMs): merged, in order, never overlapping a plan, a block or a busy time. */
export function effectiveFreeTime(input: FreeTimeInput): Span[] {
  const { fromMs, toMs } = input;
  if (!(toMs > fromMs)) return [];
  const dayCount = Math.ceil((toMs - fromMs) / (24 * HOUR)) + 2;
  const days = weekDays(fromMs - 24 * HOUR, dayCount);
  const usual = windowsAcross(input.windows, days, 0).map((w) => ({ startMs: w.startMs, endMs: w.endMs }));
  const extra = input.entries.filter((e) => e.kind === "free").flatMap((e) => occurrences(e, fromMs, toMs));
  const taken = [
    ...input.entries.filter((e) => e.kind !== "free").flatMap((e) => occurrences(e, fromMs, toMs)),
    ...input.plans.map((p) => planSpan(p.startsAt, p.endsAt)),
    ...(input.busy ?? []),
  ];
  return subtractSpans([...usual, ...extra], taken)
    .map((s) => ({ startMs: Math.max(s.startMs, fromMs), endMs: Math.min(s.endMs, toMs) }))
    .filter((s) => s.endMs > s.startMs);
}

/** The blocks showing in [fromMs, toMs), soonest first. */
export const blockOccurrences = (entries: readonly CalendarEntry[], fromMs: number, toMs: number): Occurrence[] =>
  entries.filter((e) => e.kind === "block").flatMap((e) => occurrences(e, fromMs, toMs)).sort((a, b) => a.startMs - b.startMs);

// ---------- the database ----------

interface Row {
  id: number;
  kind: EntryKind;
  starts_at: string;
  ends_at: string;
  repeat: EntryRepeat;
  note: string | null;
}

const toEntry = (r: Row): CalendarEntry => ({
  id: r.id,
  kind: r.kind,
  startsAt: Date.parse(r.starts_at),
  endsAt: Date.parse(r.ends_at),
  repeat: r.repeat,
  note: r.note ?? undefined,
});

// PostgREST: PGRST205 no such table; Postgres: 42P01. Before the migration is live there are simply no entries.
const notDeployed = (code?: string) => ["PGRST205", "42P01"].includes(code ?? "");

/** The person's entries. Best effort: before the migration, or on any failure, none. */
export async function fetchEntries(userId: string): Promise<CalendarEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("calendar_entries").select("id, kind, starts_at, ends_at, repeat, note").eq("user_id", userId).order("starts_at", { ascending: true }).limit(500);
    if (error || !Array.isArray(data)) return [];
    return (data as Row[]).map(toEntry);
  } catch {
    return [];
  }
}

export interface NewEntry {
  kind: EntryKind;
  startsAt: number;
  endsAt: number;
  repeat?: EntryRepeat;
  note?: string;
}

const clean = (n?: string) => n?.trim().slice(0, NOTE_MAX) || null;

export async function addEntry(e: NewEntry): Promise<{ entry?: CalendarEntry; error?: string }> {
  if (!supabase) return { error: ERROR_LINE };
  try {
    const { data, error } = await supabase
      .from("calendar_entries")
      .insert({
        kind: e.kind,
        starts_at: new Date(e.startsAt).toISOString(),
        ends_at: new Date(e.endsAt).toISOString(),
        repeat: e.kind === "busy" ? "none" : (e.repeat ?? "none"),
        note: e.kind === "block" ? clean(e.note) : null,
      })
      .select("id, kind, starts_at, ends_at, repeat, note")
      .single();
    if (error || !data) return { error: error && !notDeployed(error.code) ? friendlyError(error) : ERROR_LINE };
    return { entry: toEntry(data as Row) };
  } catch (err) {
    return { error: friendlyError(err) };
  }
}

export async function updateEntry(id: number, fields: Partial<Pick<NewEntry, "startsAt" | "endsAt" | "repeat" | "note">>): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const patch: Record<string, unknown> = {};
    if (fields.startsAt !== undefined) patch.starts_at = new Date(fields.startsAt).toISOString();
    if (fields.endsAt !== undefined) patch.ends_at = new Date(fields.endsAt).toISOString();
    if (fields.repeat !== undefined) patch.repeat = fields.repeat;
    if ("note" in fields) patch.note = clean(fields.note);
    const { error } = await supabase.from("calendar_entries").update(patch).eq("id", id);
    return error ? friendlyError(error) : null;
  } catch (err) {
    return friendlyError(err);
  }
}

export async function removeEntry(id: number): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  try {
    const { error } = await supabase.from("calendar_entries").delete().eq("id", id);
    return error ? friendlyError(error) : null;
  } catch (err) {
    return friendlyError(err);
  }
}
