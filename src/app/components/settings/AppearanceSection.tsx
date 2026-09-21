import { useTheme, type ThemePreference } from "../../context/ThemeContext";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { SectionHeader } from "../ui/section-header";

/** Three radio cards, individually bordered (not rows in one panel — the
 * spec calls these "radio cards" specifically, unlike every other
 * section's hairline-separated-rows-in-one-panel structure). Applies
 * instantly with ThemeContext's own 400ms cross-fade (skipped under
 * reduced motion) and saves to both localStorage and
 * profiles.theme_preference — all already built into ThemeContext, not
 * new here. */
const APPEARANCE_OPTIONS: {
  value: ThemePreference;
  label: string;
  sublabel: string;
  swatch: { bg: string; card: string; ink: string };
}[] = [
  {
    value: "system",
    label: "System default",
    sublabel: "FOLLOWS YOUR DEVICE",
    swatch: { bg: "#F6F1E7", card: "#1C1816", ink: "#9A4A34" },
  },
  {
    value: "light",
    label: "Light",
    sublabel: "WARM PAPER",
    swatch: { bg: "#F6F1E7", card: "#FBF8F1", ink: "#9A4A34" },
  },
  {
    value: "dark",
    label: "Dark",
    sublabel: "WARM CHARCOAL",
    swatch: { bg: "#1C1816", card: "#26211D", ink: "#C8674D" },
  },
];

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <section>
      <SectionHeader n={1} eyebrow="APPEARANCE" title="Appearance" />
      <p className="mb-4 text-sm text-muted-foreground">
        Light is warm paper, dark is warm charcoal. Same identity in either.
      </p>
      <RadioGroup
        value={preference}
        onValueChange={(v) => setPreference(v as ThemePreference)}
        className="gap-3"
      >
        {APPEARANCE_OPTIONS.map((opt) => {
          const selected = preference === opt.value;
          return (
            <Label
              key={opt.value}
              htmlFor={`appearance-${opt.value}`}
              className={
                "flex min-h-11 cursor-pointer items-center gap-4 rounded-btn border p-4 transition-colors " +
                (selected ? "border-accent" : "border-border hover:border-muted-foreground")
              }
            >
              <span
                className="flex h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border"
                aria-hidden="true"
              >
                <span className="h-full w-1/2" style={{ backgroundColor: opt.swatch.bg }} />
                <span className="h-full w-1/2" style={{ backgroundColor: opt.swatch.card }} />
              </span>
              <span className="flex-1">
                <span className="block" style={{ fontFamily: "var(--font-serif)" }}>
                  {opt.label}
                </span>
                <span className="ns-section-kicker block text-muted-foreground">
                  {opt.sublabel}
                </span>
              </span>
              {/* The radio's own indicator IS the accent dot the spec asks
                  for as the selected-state marker. */}
              <RadioGroupItem value={opt.value} id={`appearance-${opt.value}`} />
            </Label>
          );
        })}
      </RadioGroup>
    </section>
  );
}
