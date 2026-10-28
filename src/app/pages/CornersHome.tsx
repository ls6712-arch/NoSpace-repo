import { postCornerKey } from "../lib/cornerAlias";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { HorizontalRow } from "../components/HorizontalRow";
import { BrowseByChips } from "../components/corners/BrowseByChips";
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
import { NO_PICK, SETTING_OPTIONS, hasPick, matches, paramsFromPicker, pickerFromParams, type Picker, type Setting } from "../lib/cornerFilters";
import { fetchCornersLive, thisWeek, type CornerLive } from "../lib/cornersLive";
import { billboardCorners } from "../lib/billboard";
import { fetchAffinity, makeRanker, rankRows, toAffinity, type Affinity, type AffinityRow } from "../lib/recommend";
import { cornerSubline } from "../lib/cornerSubline";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";

/**
 * Corners home (/corners): every browsable built-in Corner, open to anyone
 * including signed-out visitors. A billboard, a "Browse by" row of the 18
 * groups, three filters (how long, what mood, where), then:
 *   - with no filter: Happening this week (if any), then one row per group.
 *     A row holds only its own group's Corners and stays short if it is short.
 *   - with any filter: one grid of the Corners that match, with how many.
 * The filters live in the URL (/corners?time=60&mood=make&place=home): a pick
 * adds a history entry, so back undoes it, and a shared link restores it. The
 * last choices on this device are only the default when the URL has none.
 * In a row or the grid the curated Corners come first, then the most recent
 * Moment, then A to Z (or the order that suits the person, see recommend.ts).
 */

const PICKER_KEY = "soosh.corners.picker.v1";
const AFFINITY_KEY = "soosh.corners.affinity.v1";
/** The last scores for this person, so the page opens already in their order and only changes if they have moved on. */
const AFFINITY_TTL_MS = 6 * 3_600_000;

const DURATION_OPTIONS = DURATION_LIMITS.map((m) => ({ id: m as number, label: `Up to ${plural(m / 60, "hour")}` }));
const MOOD_OPTIONS = MOODS.map((m) => ({ id: m.id, label: m.label }));
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

function readAffinity(userId: string | undefined): Affinity | null {
  if (!userId) return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(AFFINITY_KEY) ?? "null") as { userId: string; at: number; rows: AffinityRow[] } | null;
    if (!raw || raw.userId !== userId || Date.now() - raw.at > AFFINITY_TTL_MS || !Array.isArray(raw.rows)) return null;
    return toAffinity(raw.rows);
  } catch {
    return null;
  }
}

function writeAffinity(userId: string, aff: Affinity) {
  try {
    const rows: AffinityRow[] = [
      ...[...aff.corners].map(([k, v]) => ({ hobby_slug: k.split("/")[0], corner: k.split("/").slice(1).join("/"), ...v })),
      ...[...aff.hobbies].map(([h, mine]) => ({ hobby_slug: h, corner: "", mine, peers: 0, trending: 0 })),
    ];
    window.localStorage.setItem(AFFINITY_KEY, JSON.stringify({ userId, at: Date.now(), rows }));
  } catch {
    // Blocked storage: the page just waits for the scores each time.
  }
}

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

export function CornersHome() {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const [live, setLive] = useState<Map<string, CornerLive> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const picker = pickerFromParams(searchParams) ?? NO_PICK;
  const [affinity, setAffinity] = useState<Affinity | null>(() => readAffinity(user?.id));

  const everyCorner = useMemo(() => CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug)), []);

  useEffect(() => {
    let cancelled = false;
    fetchCornersLive({ targets: everyCorner }).then((m) => !cancelled && setLive(m));
    return () => {
      cancelled = true;
    };
  }, [everyCorner]);

  // What this person's own activity says they like (my_corner_affinity). Fails soft: before the
  // database function is applied, or with no activity, the page keeps its default order.
  useEffect(() => {
    if (!user) {
      setAffinity(null);
      return;
    }
    let cancelled = false;
    fetchAffinity().then((a) => {
      if (cancelled || !a) return;
      setAffinity(a);
      writeAffinity(user.id, a);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // The last choices on this device are the default only when the URL carries none, and only on arrival.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const stored = readPicker();
    if (!pickerFromParams(searchParams) && hasPick(stored)) setSearchParams(paramsFromPicker(stored), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pick adds a history entry (so back undoes it) and is remembered as the default for next time.
  const update = (patch: Partial<Picker>) => {
    const next = { ...picker, ...patch };
    writePicker(next);
    setSearchParams(paramsFromPicker(next));
  };

  // The newest public Moment in each Corner, for ordering the rows.
  const latest = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of publicFeed) {
      const key = postCornerKey(p);
      if (!key) continue;
      if (p.createdAt > (m.get(key) ?? 0)) m.set(key, p.createdAt);
    }
    return m;
  }, [publicFeed]);

  const ranker = useMemo(() => makeRanker(affinity, everyCorner, { userId: user?.id }), [affinity, everyCorner, user?.id]);

  const slides = useMemo<BillboardSlide[]>(
    () =>
      live
        ? billboardCorners(live, Date.now(), undefined, ranker.personal ? (x) => ranker.score(x) : undefined).map((corner) => ({
            corner,
            next: thisWeek(live.get(cornerKey(corner))?.events ?? [])[0],
            logTo: user
              ? `/create?hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`
              : `/login?redirect=${encodeURIComponent(`/create?hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`)}`,
          }))
        : [],
    [live, user, ranker],
  );

  const picked = hasPick(picker);

  // Corners that match the filters, in the order that suits the person (recommend.ts) or the default order.
  const shown = useMemo(() => {
    const matching = everyCorner.filter((c) => matches(c, picker));
    return ranker.personal ? ranker.order(matching) : matching.sort(byRow(latest));
  }, [everyCorner, picker, ranker, latest]);

  // No filter: this week's Corners, then one row per group, best fit first for a person with a taste profile.
  const week = useMemo(
    () => shown.filter((c) => thisWeek(live?.get(cornerKey(c))?.events ?? []).length > 0).slice(0, 20),
    [shown, live],
  );
  const groupRows = useMemo(() => {
    const order = byRow(latest);
    const rows = CORNER_CATEGORIES.map((cat) => {
      const own = homeCornersIn(cat.slug);
      return { cat, relevance: ranker.relevance(own), corners: ranker.personal ? ranker.order(own) : own.sort(order) };
    }).filter((r) => r.corners.length > 0);
    return ranker.personal ? rankRows(rows, (r) => r.relevance) : rows;
  }, [latest, ranker]);

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
      {/* Browse by a group, then the three filters, every choice showing, lifted over the billboard's foot. */}
      <section className={`${SECTION_GAP} relative z-10 -mt-6 flex flex-col gap-3`} aria-label="Choose what fits">
        <BrowseByChips />
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

      {picked ? (
        shown.length === 0 ? (
          <EmptyState line="No Corners match those choices." hint="Clear a choice to see more." action={{ label: "Clear choices", onClick: () => update(NO_PICK) }} />
        ) : (
          <section className={SECTION_GAP} aria-labelledby="results-title">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="results-title" className="text-lead font-semibold md:text-title">
                {plural(shown.length, "Corner")}
              </h2>
              <button
                type="button"
                onClick={() => update(NO_PICK)}
                className="inline-flex min-h-11 items-center text-small font-semibold text-[var(--accent-text)] hover:underline"
              >
                Clear
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {shown.map((c) => (
                <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} fluid />
              ))}
            </ul>
          </section>
        )
      ) : (
        <>
          {week.length > 0 && (
            <section className={SECTION_GAP} aria-labelledby="row-week">
              <h2 id="row-week" className="mb-3 text-lead font-semibold md:text-title">
                Happening this week
              </h2>
              <HorizontalRow name="corners.row.week" label="Happening this week" contentKey={week.map(cornerKey).join(",")}>
                {week.map((c) => (
                  <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} />
                ))}
              </HorizontalRow>
            </section>
          )}
          {groupRows.map(({ cat, corners }) => (
            <section key={cat.slug} className={SECTION_GAP} aria-labelledby={`row-${cat.slug}`}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id={`row-${cat.slug}`} className="text-lead font-semibold md:text-title">
                  <Link to={`/browse/${cat.slug}`} className="hover:underline">
                    {cat.name}
                  </Link>
                </h2>
                <Link to={`/browse/${cat.slug}`} className="inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-[var(--accent-text)] hover:underline">
                  See all
                </Link>
              </div>
              <HorizontalRow name={`corners.row.${cat.slug}`} label={cat.name} contentKey={corners.map(cornerKey).join(",")}>
                {corners.map((c) => (
                  <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} />
                ))}
              </HorizontalRow>
            </section>
          ))}
        </>
      )}
      </div>
    </div>
  );
}
