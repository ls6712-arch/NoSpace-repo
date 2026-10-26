import { useEffect, useMemo, useState } from "react";
import { ChipRow } from "../components/ChipRow";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { CoverEmoji } from "../components/corners/CoverEmoji";
import { PressLink } from "../components/afterhours/PressLink";
import { EmptyState } from "../components/StateViews";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import {
  CURATED_CORNERS,
  DURATION_LIMITS,
  cornerMoods,
  curatedInCategory,
  type CornerSetting,
  type CuratedCorner,
} from "../data/curatedCorners";
import { MOODS, type MoodId } from "../data/moods";
import { cornerStyle } from "../lib/categoryStyle";
import { fetchCornersLive, thisWeek, type CornerLive } from "../lib/cornersLive";
import { displayStyle } from "../lib/doorList";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";

/**
 * Corners home (/corners): the curated Corners, open to anyone including
 * signed-out visitors. A hero for the busiest Corner this week, a picker
 * (how long, what mood, where) and one row per category. A row with nothing
 * in it is not shown.
 */

const PICKER_KEY = "soosh.corners.picker.v1";

interface Picker {
  duration: number | null;
  mood: MoodId | null;
  setting: CornerSetting | null;
}

const NO_PICK: Picker = { duration: null, mood: null, setting: null };

const DURATION_OPTIONS = DURATION_LIMITS.map((h) => ({ id: h, label: `Up to ${plural(h / 60, "hour")}` }));
const MOOD_OPTIONS = MOODS.map((m) => ({ id: m.id, label: m.label }));
const SETTING_OPTIONS: { id: CornerSetting; label: string }[] = [
  { id: "home", label: "At home" },
  { id: "outdoors", label: "Outdoors" },
  { id: "anywhere", label: "Anywhere" },
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

function matches(x: CuratedCorner, moods: MoodId[], p: Picker): boolean {
  if (p.duration !== null && x.durationMinutes > p.duration) return false;
  if (p.mood !== null && !moods.includes(p.mood)) return false;
  // "At home" and "Outdoors" also keep the Corners that work anywhere.
  if (p.setting !== null && x.setting !== p.setting && !(x.setting === "anywhere" && p.setting !== "anywhere")) return false;
  return true;
}

/** The one live line on a card: events this week, else Spaces, else an invitation. */
export function cornerSignal(live: CornerLive | undefined): string {
  if (!live) return "";
  const events = thisWeek(live.events).length;
  if (events > 0) return `${plural(events, "event")} this week`;
  if (live.spaces.length > 0) return plural(live.spaces.length, "Space");
  return "Be the first to start a Space";
}

export function CornersHome() {
  const [live, setLive] = useState<Map<string, CornerLive> | null>(null);
  const [picker, setPicker] = useState<Picker>(readPicker);

  useEffect(() => {
    let cancelled = false;
    fetchCornersLive().then((m) => !cancelled && setLive(m));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<Picker>) =>
    setPicker((prev) => {
      const next = { ...prev, ...patch };
      writePicker(next);
      return next;
    });

  const moodsBySlug = useMemo(() => new Map(CURATED_CORNERS.map((x) => [x.slug, cornerMoods(x)])), []);

  // The busiest Corner this week. No events anywhere: no hero.
  const hero = useMemo(() => {
    if (!live) return null;
    let best: { corner: CuratedCorner; events: number } | null = null;
    for (const x of CURATED_CORNERS) {
      const events = thisWeek(live.get(x.slug)?.events ?? []).length;
      if (events > 0 && (!best || events > best.events)) best = { corner: x, events };
    }
    return best;
  }, [live]);

  const rows = CORNER_CATEGORIES.map((cat) => ({
    cat,
    corners: curatedInCategory(cat.slug).filter((x) => matches(x, moodsBySlug.get(x.slug) ?? [], picker)),
  })).filter((r) => r.corners.length > 0);

  const picked = picker.duration !== null || picker.mood !== null || picker.setting !== null;

  return (
    <div className="ns-afterhours min-h-viewport">
      {hero && (
        <header className="relative overflow-hidden bg-[var(--cat)] text-[var(--ink)]" style={cornerStyle(hero.corner.spaceSlug, hero.corner.slug)}>
          <CoverEmoji emoji={hero.corner.emoji} size="hero" className="pointer-events-none absolute right-6 top-6 md:right-16" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
          <div className={`${PAGE_X} relative pb-16 pt-14 md:pb-20 md:pt-20`}>
            <p className="text-small font-semibold">Busy this week</p>
            <h1 className="mt-2 text-display">{hero.corner.name}</h1>
            <p className="mt-2 text-body">{`${plural(hero.events, "event")} this week`}</p>
            <PressLink
              to={`/corners/${hero.corner.slug}`}
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--ink)] px-6 text-body font-semibold text-[var(--cat)]"
            >
              {`Explore ${hero.corner.name}`}
            </PressLink>
          </div>
        </header>
      )}

      <div className={`${PAGE_X} ${hero ? "pt-8" : "pt-10 md:pt-14"} pb-24`}>
        {!hero && <h1 className="mb-8 text-display">Corners</h1>}

        <section className={`${SECTION_GAP} space-y-5`} aria-label="Choose what fits">
          <ChipRow label="I have" options={DURATION_OPTIONS} value={picker.duration} onChange={(duration) => update({ duration })} />
          <ChipRow label="In the mood for" options={MOOD_OPTIONS} value={picker.mood} onChange={(mood) => update({ mood })} />
          <ChipRow label="I’m" options={SETTING_OPTIONS} value={picker.setting} onChange={(setting) => update({ setting })} />
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
              <h2 id={`row-${cat.slug}`} className="mb-3" style={displayStyle(26, { lineHeight: 1.1 })}>
                {cat.name}
              </h2>
              <HorizontalRow name={`corners.row.${cat.slug}`} label={cat.name}>
                {corners.map((x) => (
                  <CornerCard key={x.slug} corner={x} signal={cornerSignal(live?.get(x.slug))} />
                ))}
              </HorizontalRow>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
