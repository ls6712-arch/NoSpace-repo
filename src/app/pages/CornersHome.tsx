import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { Billboard, type BillboardSlide } from "../components/corners/Billboard";
import { EmptyState } from "../components/StateViews";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import {
  CURATED_CORNERS,
  DURATION_LIMITS,
  cornerMoods,
  guideMoods,
  type CornerSetting,
} from "../data/curatedCorners";
import { cornerKey, homeCornersIn, type HomeCorner } from "../data/homeCorners";
import { MOODS, type MoodId } from "../data/moods";
import { postCorner } from "../data/posts";
import { fetchCornersLive, thisWeek, type CornerLive } from "../lib/cornersLive";
import { billboardCorners } from "../lib/billboard";
import { fillRow } from "../lib/cornerSimilarity";
import { LENSES, MAX_LENS_CORNERS, MIN_LENS_CORNERS, interleaveRows, type LensId } from "../lib/cornerLenses";
import { cornerSubline } from "../lib/cornerSubline";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";

/**
 * Corners home (/corners): every built-in Corner, open to anyone including
 * signed-out visitors. A photo hero for one curated Corner, a one-line picker
 * (how long, what mood, where) and one row per group of 18. In a row the
 * curated Corners come first, then the rest by most recent Moment, then A to Z.
 * A row with nothing in it is not shown.
 */

const PICKER_KEY = "soosh.corners.picker.v1";

type Setting = Exclude<CornerSetting, "anywhere">;

interface Picker {
  duration: number | null;
  mood: MoodId | null;
  setting: Setting | null;
}

const NO_PICK: Picker = { duration: null, mood: null, setting: null };

const DURATION_OPTIONS = DURATION_LIMITS.map((m) => ({ id: m as number, label: `Up to ${plural(m / 60, "hour")}` }));
const MOOD_OPTIONS = MOODS.map((m) => ({ id: m.id, label: m.label }));
const SETTING_OPTIONS: { id: Setting; label: string }[] = [
  { id: "home", label: "At home" },
  { id: "outdoors", label: "Outdoors" },
];

/** One group of filter chips, every option showing. Tap a chosen one again to unset it. */
function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T | null;
  onChange: (next: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.id)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small font-semibold transition-colors duration-fast ${
              on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-border bg-surface text-foreground hover:border-[var(--accent)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The last choices on this device, or none. Storage can be blocked or hold junk. */
function readPicker(): Picker {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PICKER_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return NO_PICK;
    return {
      duration: (DURATION_LIMITS as readonly number[]).includes(raw.duration) ? raw.duration : null,
      mood: MOODS.some((m) => m.id === raw.mood) ? raw.mood : null,
      setting: SETTING_OPTIONS.some((s) => s.id === raw.setting) ? raw.setting : null,
    };
  } catch {
    return NO_PICK;
  }
}

function writePicker(p: Picker) {
  try {
    window.localStorage.setItem(PICKER_KEY, JSON.stringify(p));
  } catch {
    // Private window or blocked storage: the choices just don't stick.
  }
}

/** A Corner without a guide has no length, place or mood on record, so a choice on that filter leaves it out. */
function matches(c: HomeCorner, p: Picker): boolean {
  const x = c.curated;
  if (p.duration !== null && !(x && x.durationMinutes <= p.duration)) return false;
  // "At home" and "Outdoors" also keep the Corners that work anywhere.
  if (p.setting !== null && !(x && (x.setting === p.setting || x.setting === "anywhere"))) return false;
  if (p.mood !== null) {
    const moods = x ? cornerMoods(x) : guideMoods(c.spaceSlug, c.slug);
    if (!moods.includes(p.mood)) return false;
  }
  return true;
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const curatedIndex = new Map(CURATED_CORNERS.map((x, i) => [x.slug, i]));

/** Curated first, then the most recent Moment, then A to Z. */
function byRow(latest: Map<string, number>) {
  return (a: HomeCorner, b: HomeCorner) => {
    const ca = a.curated ? curatedIndex.get(a.slug)! : Infinity;
    const cb = b.curated ? curatedIndex.get(b.slug)! : Infinity;
    if (ca !== cb) return ca - cb;
    const la = latest.get(cornerKey(a)) ?? 0;
    const lb = latest.get(cornerKey(b)) ?? 0;
    if (la !== lb) return lb - la;
    return a.name.localeCompare(b.name);
  };
}

/** Does a Corner belong in this lens row? Reads the same data the picker does. */
function inLens(id: LensId, c: HomeCorner, live: Map<string, CornerLive> | null): boolean {
  if (id === "week") return thisWeek(live?.get(cornerKey(c))?.events ?? []).length > 0;
  if (id === "hour") return matches(c, { ...NO_PICK, duration: 60 });
  if (id === "home") return matches(c, { ...NO_PICK, setting: "home" });
  if (id === "outdoors") return matches(c, { ...NO_PICK, setting: "outdoors" });
  return matches(c, { ...NO_PICK, mood: id.slice("mood-".length) as MoodId });
}

export function CornersHome() {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const [live, setLive] = useState<Map<string, CornerLive> | null>(null);
  const [picker, setPicker] = useState<Picker>(readPicker);

  const everyCorner = useMemo(() => CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug)), []);

  useEffect(() => {
    let cancelled = false;
    fetchCornersLive({ targets: everyCorner }).then((m) => !cancelled && setLive(m));
    return () => {
      cancelled = true;
    };
  }, [everyCorner]);

  const update = (patch: Partial<Picker>) =>
    setPicker((prev) => {
      const next = { ...prev, ...patch };
      writePicker(next);
      return next;
    });

  // The newest public Moment in each Corner, for ordering the rows.
  const latest = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of publicFeed) {
      const c = postCorner(p);
      if (!c) continue;
      const key = `${p.hobbySlug}/${slugOf(c)}`;
      if (p.createdAt > (m.get(key) ?? 0)) m.set(key, p.createdAt);
    }
    return m;
  }, [publicFeed]);

  const slides = useMemo<BillboardSlide[]>(
    () =>
      live
        ? billboardCorners(live).map((corner) => ({
            corner,
            next: thisWeek(live.get(cornerKey(corner))?.events ?? [])[0],
            logTo: user
              ? `/create?hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`
              : `/login?redirect=${encodeURIComponent(`/create?hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`)}`,
          }))
        : [],
    [live, user],
  );

  const order = byRow(latest);
  // A row never runs short: one with only a few Corners is filled up with the most similar Corners from
  // elsewhere (see cornerSimilarity.ts), so every row reaches past the edge of the page.
  const shown = everyCorner.filter((c) => matches(c, picker));
  const groupRows = CORNER_CATEGORIES.map((cat) => {
    const own = homeCornersIn(cat.slug).filter((c) => matches(c, picker)).sort(order);
    return { kind: "group" as const, cat, corners: fillRow(own, shown) };
  }).filter((r) => r.corners.length > 0);
  // A different way into the same Corners, woven in among the groups. A lens with too few Corners is left out.
  const lensRows = LENSES.map((lens) => ({
    kind: "lens" as const,
    lens,
    corners: shown.filter((c) => inLens(lens.id, c, live)).sort(order).slice(0, MAX_LENS_CORNERS),
  }))
    .filter((r) => r.corners.length >= MIN_LENS_CORNERS)
    .map((r) => ({ ...r, corners: fillRow(r.corners, shown) }));
  const rows = interleaveRows(lensRows, groupRows);

  const picked = picker.duration !== null || picker.mood !== null || picker.setting !== null;
  return (
    <div className="ns-afterhours min-h-viewport pb-24">
      {/* The billboard runs edge to edge. The space is held while the week's events load, so nothing jumps. */}
      {slides.length > 0 ? (
        <Billboard slides={slides} />
      ) : (
        <div className="h-[72svh] min-h-[22.5rem] max-h-[820px] w-full bg-surface-muted" aria-hidden="true" />
      )}
      <h1 className="sr-only">Corners</h1>

      <div className={PAGE_X}>
      {/* The three filters, every choice showing, lifted over the billboard's foot. */}
      <section className={`${SECTION_GAP} relative z-10 -mt-6 flex flex-col gap-3`} aria-label="Choose what fits">
        <ChipGroup label="Any time" options={DURATION_OPTIONS} value={picker.duration} onChange={(duration) => update({ duration })} />
        <ChipGroup label="Any mood" options={MOOD_OPTIONS} value={picker.mood} onChange={(mood) => update({ mood })} />
        <div className="flex flex-wrap items-center gap-x-2">
          <ChipGroup label="Anywhere" options={SETTING_OPTIONS} value={picker.setting} onChange={(setting) => update({ setting })} />
          {picked && (
            <button
              type="button"
              onClick={() => update(NO_PICK)}
              className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-[var(--accent-text)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          line="No Corners match those choices."
          hint="Clear a choice to see more."
          action={picked ? { label: "Clear choices", onClick: () => update(NO_PICK) } : undefined}
        />
      ) : (
        rows.map((row) => {
          if (row.kind === "lens") {
            return (
              <section key={row.lens.id} className={SECTION_GAP} aria-labelledby={`row-${row.lens.id}`}>
                <h2 id={`row-${row.lens.id}`} className="mb-3 text-lead font-semibold md:text-title">
                  {row.lens.title}
                </h2>
                <HorizontalRow name={`corners.row.${row.lens.id}`} label={row.lens.title}>
                  {row.corners.map((c) => (
                    <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} />
                  ))}
                </HorizontalRow>
              </section>
            );
          }
          const { cat, corners } = row;
          return (
            <section key={cat.slug} className={SECTION_GAP} aria-labelledby={`row-${cat.slug}`}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id={`row-${cat.slug}`} className="text-lead font-semibold md:text-title">
                  {cat.name}
                </h2>
                <Link to={`/browse/${cat.slug}`} className="inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-[var(--accent-text)] hover:underline">
                  See all
                </Link>
              </div>
              <HorizontalRow name={`corners.row.${cat.slug}`} label={cat.name}>
                {corners.map((c) => (
                  <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} />
                ))}
              </HorizontalRow>
            </section>
          );
        })
      )}
      </div>
    </div>
  );
}
