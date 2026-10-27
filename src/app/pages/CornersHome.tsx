import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FilterChip } from "../components/FilterChip";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { PressLink } from "../components/afterhours/PressLink";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { EmptyState } from "../components/StateViews";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import {
  CURATED_CORNERS,
  DURATION_LIMITS,
  cornerMeta,
  cornerMoods,
  guideMoods,
  type CornerSetting,
  type CuratedCorner,
} from "../data/curatedCorners";
import { cornerGuide } from "../data/cornerGuides";
import { cornerKey, homeCornersIn, type HomeCorner } from "../data/homeCorners";
import { categoryStyle } from "../lib/categoryStyle";
import { formatStarts } from "../lib/dates";
import { MOODS, type MoodId } from "../data/moods";
import { postCorner } from "../data/posts";
import { fetchCornersLive, thisWeek, type CornerLive } from "../lib/cornersLive";
import { cornerPhoto, cornerPhotoAlt } from "../lib/cornerPhoto";
import { cornerSubline } from "../lib/cornerSubline";
import { displayStyle } from "../lib/doorList";
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
const WEEK_MS = 7 * 24 * 3_600_000;

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

/** The curated Corner with the most events this week; with none, one per week in turn. */
function heroCorner(live: Map<string, CornerLive>, now = Date.now()): CuratedCorner | null {
  let best: { x: CuratedCorner; n: number } | null = null;
  for (const x of CURATED_CORNERS) {
    const n = thisWeek(live.get(cornerKey(x))?.events ?? [], now).length;
    if (n > 0 && (!best || n > best.n)) best = { x, n };
  }
  if (best) return best.x;
  const withPhoto = CURATED_CORNERS.filter((x) => cornerPhoto(x.spaceSlug, x.slug));
  return withPhoto.length ? withPhoto[Math.floor(now / WEEK_MS) % withPhoto.length] : null;
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

  const hero = useMemo(() => (live ? heroCorner(live) : null), [live]);

  const rows = CORNER_CATEGORIES.map((cat) => ({
    cat,
    corners: homeCornersIn(cat.slug).filter((c) => matches(c, picker)).sort(byRow(latest)),
  })).filter((r) => r.corners.length > 0);

  const heroAbout = hero ? cornerGuide(hero.spaceSlug, hero.slug)?.about : undefined;
  const heroNext = hero ? thisWeek(live?.get(cornerKey(hero))?.events ?? [])[0] : undefined;

  const picked = picker.duration !== null || picker.mood !== null || picker.setting !== null;
  const logTo = hero
    ? `/create?hobby=${encodeURIComponent(hero.spaceSlug)}&sub=${encodeURIComponent(hero.slug)}`
    : "/create";

  return (
    <div className={`ns-afterhours min-h-viewport ${PAGE_X} pb-24 pt-4 md:pt-8`}>
      {/* Hero: a photo card. The space is held while the week's events load, so nothing jumps. */}
      <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-card bg-surface-muted text-on-media md:aspect-[16/9]">
        {hero && (
          <>
            <ImageWithFallback
              src={cornerPhoto(hero.spaceSlug, hero.slug, 1600)}
              alt={cornerPhotoAlt(hero.slug)}
              priority
              width={1200}
              className="absolute inset-0 size-full"
            />
            <div className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 md:p-8">
              <p className="text-small font-semibold text-on-media/90">Corner of the week</p>
              <h1 className="text-display" style={displayStyle(40, { lineHeight: 1.05 })}>
                {hero.name}
              </h1>
              <p className="text-body text-on-media/90">{cornerMeta(hero)}</p>
              {heroAbout && <p className="max-w-xl text-body text-on-media/90 max-md:hidden">{heroAbout}</p>}
              {heroNext && (
                <p className="text-small font-semibold text-on-media">
                  {heroNext.title}
                  <span className="font-normal text-on-media/90">{` · ${formatStarts(heroNext.startsAt, { timeZone: heroNext.timezone })}`}</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                <PressLink
                  to={`/corners/${hero.slug}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)]"
                >
                  {`Explore ${hero.name}`}
                </PressLink>
                <PressLink
                  to={user ? logTo : `/login?redirect=${encodeURIComponent(logTo)}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-control border border-on-media/70 px-6 text-body font-semibold text-on-media"
                >
                  Log a Moment
                </PressLink>
              </div>
            </div>
          </>
        )}
      </div>
      {!hero && <h1 className="sr-only">Corners</h1>}

      {/* One compact row of three filters. */}
      <section className={`${SECTION_GAP} -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`} aria-label="Choose what fits">
        <FilterChip anyLabel="Any time" options={DURATION_OPTIONS} value={picker.duration} onChange={(duration) => update({ duration })} />
        <FilterChip anyLabel="Any mood" options={MOOD_OPTIONS} value={picker.mood} onChange={(mood) => update({ mood })} />
        <FilterChip anyLabel="Anywhere" options={SETTING_OPTIONS} value={picker.setting} onChange={(setting) => update({ setting })} />
        {picked && (
          <button
            type="button"
            onClick={() => update(NO_PICK)}
            className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-[var(--accent-text)] hover:underline"
          >
            Clear
          </button>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          line="No Corners match those choices."
          hint="Clear a choice to see more."
          action={picked ? { label: "Clear choices", onClick: () => update(NO_PICK) } : undefined}
        />
      ) : (
        rows.map(({ cat, corners }) => (
          <section key={cat.slug} className={SECTION_GAP} aria-labelledby={`row-${cat.slug}`}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id={`row-${cat.slug}`} className="flex items-center gap-2.5 text-title font-semibold" style={categoryStyle(cat.slug)}>
                <span className="size-2.5 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
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
        ))
      )}
    </div>
  );
}
