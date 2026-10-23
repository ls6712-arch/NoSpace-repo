import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MOOD_CHIPS, moodCards, type MoodChipId } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { SECTION_GAP, TITLE_GAP } from "../../lib/pageGrid";
import { PRESS_SCALE, springs } from "../../lib/springs";
import { tieNumbers } from "../../lib/typography";
import { useHistoryState, useRowScrollMemory } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";

/**
 * "What are you in the mood for?" on Discover (spec v1.1): a row of chips and,
 * under it, a row of Corner cards for the chosen one. "15 minutes" is the
 * default and lists the Corners whose first step fits in about 15 minutes
 * (the old "Got 15 minutes?" row); the others are moods from moods.ts, built
 * from facts the activity library records. A mood names what you'd be doing,
 * never what it will do for you. No counts, nothing saved to the database.
 *
 * Changing chip cross-fades the cards (150ms opacity) and scrolls them back to
 * the start. The chosen chip comes back after Back.
 */
export function MoodRow() {
  const [chip, setChip] = useHistoryState<MoodChipId>("discover.mood", "quick");
  const row = useRowScrollMemory("discover.moodCards");
  const cardsRef = useRef<HTMLUListElement | null>(null);
  // `shown` trails `chip` by one 150ms fade, so the row fades out, swaps, scrolls to the start and fades in.
  const [shown, setShown] = useState(chip);
  const items = moodCards(shown);

  useEffect(() => {
    if (shown === chip) return;
    const t = window.setTimeout(() => {
      setShown(chip);
      cardsRef.current?.scrollTo({ left: 0 });
    }, 150);
    return () => window.clearTimeout(t);
  }, [chip, shown]);

  return (
    <section className={SECTION_GAP} aria-labelledby="mood-title">
      <h2 id="mood-title" className={`${TITLE_GAP} text-title`}>
        What are you in the mood for?
      </h2>
      <ul className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-8 md:px-8" aria-label="Moods">
        {MOOD_CHIPS.map((m) => {
          const on = m.id === chip;
          return (
            <li key={m.id} className="shrink-0">
              <motion.button
                type="button"
                aria-pressed={on}
                onClick={() => setChip(m.id)}
                whileTap={{ scale: PRESS_SCALE }}
                transition={springs.press}
                className={`h-10 whitespace-nowrap rounded-control border px-4 text-small font-semibold ${
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground"
                }`}
              >
                {m.label}
              </motion.button>
            </li>
          );
        })}
      </ul>
      <motion.ul
        {...row}
        ref={(el: HTMLUListElement | null) => {
          cardsRef.current = el;
          row.ref(el);
        }}
        animate={{ opacity: shown === chip ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:gap-4 md:px-8 md:scroll-px-8"
      >
          {items.map((q, i) => (
            <li key={`${q.spaceSlug}-${q.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(q.spaceSlug, q.cornerSlug)}>
              <Reveal index={i}>
                <PressLink
                  to={`/corner/${q.cornerSlug}`}
                  className="relative flex h-[176px] w-[248px] flex-col justify-between overflow-hidden rounded-card border border-border bg-card p-5 shadow-card md:h-[184px] md:w-[280px]"
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-[var(--cat)]" aria-hidden="true" />
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
                    <span className="truncate text-caption text-foreground">{q.label}</span>
                  </span>
                  <span className="text-lead text-foreground">{tieNumbers(q.guide.step)}</span>
                </PressLink>
              </Reveal>
            </li>
          ))}
      </motion.ul>
    </section>
  );
}
