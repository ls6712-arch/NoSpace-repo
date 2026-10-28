import { useId } from "react";
import { motion } from "motion/react";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { MOODS, type MoodId } from "../../data/moods";
import { CITY_MAX, suggestCities } from "../../lib/interests";
import { PAGE_FROM, PAGE_TO, page, staggerDelay } from "../../lib/motionTokens";

/**
 * "What do you want more of?": the 8 moods as chips (pick one or more) and the
 * city. Used by onboarding and by the sheet that changes the choice later.
 */
export function MoodsCityForm({
  moods,
  city,
  onMoods,
  onCity,
  autoFocusCity = false,
}: {
  moods: readonly MoodId[];
  city: string;
  onMoods: (next: MoodId[]) => void;
  onCity: (next: string) => void;
  autoFocusCity?: boolean;
}) {
  const cityId = useId();
  const suggestions = suggestCities(city);
  const toggle = (id: MoodId) => onMoods(moods.includes(id) ? moods.filter((m) => m !== id) : [...moods, id]);

  return (
    <div className="flex flex-col gap-8">
      <div role="group" aria-label="What you want more of" className="flex flex-wrap gap-x-2 gap-y-3">
        {MOODS.map((m, i) => (
          <motion.div key={m.id} initial={PAGE_FROM} animate={PAGE_TO} transition={{ ...page, delay: 0.2 + staggerDelay(i) }}>
            <Chip selected={moods.includes(m.id)} onClick={() => toggle(m.id)}>
              {m.label}
            </Chip>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={cityId} className="text-small text-muted-foreground">
          Your city
        </Label>
        <Input
          id={cityId}
          value={city}
          maxLength={CITY_MAX}
          autoComplete="address-level2"
          autoFocus={autoFocusCity}
          onChange={(e) => onCity(e.target.value)}
          className="h-12 text-body"
        />
        {suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="City suggestions">
            {suggestions.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onCity(c)}
                  className="min-h-11 rounded-full px-3 text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
