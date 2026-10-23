import { motion } from "motion/react";
import { MOOD_CHIPS, type MoodChipId } from "../../data/moodCards";
import { displayStyle } from "../../lib/doorList";
import { SECTION_GAP } from "../../lib/pageGrid";
import { PRESS_SCALE, springs } from "../../lib/springs";

/**
 * "What are you in the mood for?": the nine doors as a two-column grid (3 by 3 from
 * 1024px, beside the cover) of equal 48px buttons, labels left-aligned. On: the foreground colour fills it. Off:
 * the surface colour with a border. The greeting sits under the title.
 */
export function MoodGrid({
  value,
  onPick,
  greeting,
}: {
  value: MoodChipId;
  onPick: (id: MoodChipId) => void;
  greeting: string;
}) {
  return (
    <section className={`${SECTION_GAP} lg:col-span-5`} aria-labelledby="mood-title">
      <h2 id="mood-title" style={displayStyle(40, { lineHeight: 1.05 })}>
        What are you in the mood for?
      </h2>
      <p className="mb-4 mt-2 text-body text-muted-foreground">{greeting}</p>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3" aria-label="Moods">
        {MOOD_CHIPS.map((m, i) => {
          const on = m.id === value;
          return (
            // 9 doors: 2 columns on a phone (the last takes the whole row), 3 by 3 from lg.
            <li key={m.id} className={i === MOOD_CHIPS.length - 1 && MOOD_CHIPS.length % 2 === 1 ? "col-span-2 lg:col-span-1" : ""}>
              <motion.button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(m.id)}
                whileTap={{ scale: PRESS_SCALE }}
                transition={springs.press}
                className={`h-12 w-full rounded-control border px-4 text-left text-small font-semibold ${
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground"
                }`}
              >
                {m.label}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
