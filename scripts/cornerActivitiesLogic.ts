// data/corner_activities.csv to src/app/data/cornerActivities.ts, as pure functions. The CSV is the founder's team's
// content (approved); nothing here writes or rewrites a word of it. Anything malformed throws, so a bad CSV never ships.
import { parseCsv } from "./catalogCornersLogic";

export const MOODS = ["cozy", "restless", "curious", "make"] as const;
export const ENERGIES = ["low", "medium", "high"] as const;
export const WHOS = ["solo", "friend", "group"] as const;
export const COSTS = ["free", "low", "treat"] as const;
export const WHERES = ["home", "outside", "place"] as const;
export const DURATIONS = ["15min", "hour", "evening", "halfday"] as const;
export const SEASONS = ["any", "warm", "cold"] as const;

export type ActivityMood = (typeof MOODS)[number];
export type ActivityEnergy = (typeof ENERGIES)[number];
export type ActivityWho = (typeof WHOS)[number];
export type ActivityCost = (typeof COSTS)[number];
export type ActivityWhere = (typeof WHERES)[number];
export type ActivityDuration = (typeof DURATIONS)[number];
export type ActivitySeason = (typeof SEASONS)[number];

export interface ActivityRow {
  id: string;
  cornerSlug: string;
  title: string;
  how: string;
  firstStep: string;
  moods: ActivityMood[];
  energy: ActivityEnergy;
  who: ActivityWho[];
  cost: ActivityCost;
  where: ActivityWhere;
  duration: ActivityDuration;
  season: ActivitySeason;
  momentPrompt: string;
}

const COLUMNS = ["id", "corner_slug", "corner_name", "title", "how", "first_step", "moods", "energy", "who", "cost", "where", "duration", "season", "moment_prompt"];

function one<T extends string>(id: string, field: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`${id}: ${field} "${value}" is not one of ${allowed.join(", ")}`);
  return value as T;
}
function list<T extends string>(id: string, field: string, value: string, allowed: readonly T[]): T[] {
  const parts = value.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error(`${id}: ${field} is empty`);
  return [...new Set(parts.map((p) => one(id, field, p, allowed)))];
}

/** Rows of the CSV, validated. Corner names in the CSV are for people reading it; the app uses the Corner's own name. */
export function parseActivities(text: string): ActivityRow[] {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header || COLUMNS.some((c, i) => header[i]?.trim() !== c)) throw new Error(`corner_activities.csv: the columns must be ${COLUMNS.join(", ")}`);
  const seen = new Set<string>();
  const out: ActivityRow[] = [];
  for (const cells of body) {
    if (cells.every((c) => !c.trim())) continue;
    const r = Object.fromEntries(COLUMNS.map((c, i) => [c, (cells[i] ?? "").trim()])) as Record<string, string>;
    const id = r.id;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*-\d+$/.test(id)) throw new Error(`bad id "${id}" (want {corner_slug}-{n})`);
    if (seen.has(id)) throw new Error(`duplicate id "${id}"`);
    seen.add(id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.corner_slug) || !id.startsWith(`${r.corner_slug}-`)) throw new Error(`${id}: corner_slug "${r.corner_slug}" does not match the id`);
    for (const f of ["title", "how", "first_step", "moment_prompt"]) {
      if (!r[f]) throw new Error(`${id}: ${f} is empty`);
      if (/[–—]/.test(r[f])) throw new Error(`${id}: ${f} has an en or em dash (docs/style-guide.md)`);
      if (/https?:\/\/|www\./i.test(r[f])) throw new Error(`${id}: ${f} has a link`);
    }
    out.push({
      id,
      cornerSlug: r.corner_slug,
      title: r.title,
      how: r.how,
      firstStep: r.first_step,
      moods: list(id, "moods", r.moods, MOODS),
      energy: one(id, "energy", r.energy, ENERGIES),
      who: list(id, "who", r.who, WHOS),
      cost: one(id, "cost", r.cost, COSTS),
      where: one(id, "where", r.where, WHERES),
      duration: one(id, "duration", r.duration, DURATIONS),
      season: one(id, "season", r.season, SEASONS),
      momentPrompt: r.moment_prompt,
    });
  }
  return out;
}

/** One Corner's activities, resolved: the Space the Corner sits under in the app, after the catalog merge. */
export interface ResolvedActivity extends ActivityRow {
  spaceSlug: string;
}

/**
 * Puts every activity on the Corner people actually see. `spaceOf` is the catalog merge: a catalog Corner's own
 * Space, or the existing Corner's Space when the catalog row was merged into it (for example Table tennis).
 * A slug that does not resolve, or that resolves to a different slug than the CSV's, is a problem listed in full, not a guess.
 */
export function resolveActivities(rows: ActivityRow[], spaceOf: (slug: string) => { spaceSlug: string; slug: string } | null): { resolved: ResolvedActivity[]; unresolved: string[] } {
  const resolved: ResolvedActivity[] = [];
  const unresolved = new Set<string>();
  const cache = new Map<string, { spaceSlug: string; slug: string } | null>();
  for (const r of rows) {
    if (!cache.has(r.cornerSlug)) cache.set(r.cornerSlug, spaceOf(r.cornerSlug));
    const hit = cache.get(r.cornerSlug);
    if (!hit) unresolved.add(r.cornerSlug);
    else if (hit.slug !== r.cornerSlug) unresolved.add(`${r.cornerSlug} (resolves to ${hit.slug}: decide before attaching)`);
    else resolved.push({ ...r, spaceSlug: hit.spaceSlug });
  }
  return { resolved, unresolved: [...unresolved].sort() };
}

const q = (s: string) => JSON.stringify(s);

export function renderActivitiesFile(activities: ResolvedActivity[]): string {
  const rows = activities.map((a) =>
    `  { ${[
      `id: ${q(a.id)}`, `cornerSlug: ${q(a.cornerSlug)}`, `spaceSlug: ${q(a.spaceSlug)}`, `title: ${q(a.title)}`, `how: ${q(a.how)}`, `firstStep: ${q(a.firstStep)}`,
      `moods: [${a.moods.map(q).join(", ")}]`, `energy: ${q(a.energy)}`, `who: [${a.who.map(q).join(", ")}]`, `cost: ${q(a.cost)}`, `where: ${q(a.where)}`,
      `duration: ${q(a.duration)}`, `season: ${q(a.season)}`, `momentPrompt: ${q(a.momentPrompt)}`,
    ].join(", ")} },`,
  );
  return `// GENERATED FILE. DO NOT EDIT.
// Source: data/corner_activities.csv. Regenerate with: npx tsx scripts/build-corner-activities.ts
// ${activities.length} activities on ${new Set(activities.map((a) => a.cornerSlug)).size} Corners. Written by the founder's team and approved as content;
// nothing here is generated at runtime. \`spaceSlug\` is the Space the Corner sits under in the app, after the catalog merge.

export type ActivityMood = ${MOODS.map(q).join(" | ")};
export type ActivityEnergy = ${ENERGIES.map(q).join(" | ")};
export type ActivityWho = ${WHOS.map(q).join(" | ")};
export type ActivityCost = ${COSTS.map(q).join(" | ")};
export type ActivityWhere = ${WHERES.map(q).join(" | ")};
export type ActivityDuration = ${DURATIONS.map(q).join(" | ")};
export type ActivitySeason = ${SEASONS.map(q).join(" | ")};

export interface Activity {
  id: string;
  cornerSlug: string;
  spaceSlug: string;
  title: string;
  how: string;
  firstStep: string;
  moods: ActivityMood[];
  energy: ActivityEnergy;
  who: ActivityWho[];
  cost: ActivityCost;
  where: ActivityWhere;
  duration: ActivityDuration;
  season: ActivitySeason;
  /** What to capture when logging the Moment. Shown in the composer when someone logs from this activity. */
  momentPrompt: string;
}

export const CORNER_ACTIVITIES: readonly Activity[] = [
${rows.join("\n")}
];
`;
}
