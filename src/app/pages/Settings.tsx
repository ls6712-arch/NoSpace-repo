import { useTheme, type ThemePreference } from "../context/ThemeContext";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { SectionHeader } from "../components/ui/section-header";

/**
 * The brief's Settings.tsx (section 4): one centered column, each section
 * introduced with an "N · EYEBROW" + serif title, separated by a divider —
 * a plain hairline Separator for now, until a real hand-drawn SVG rule
 * exists as a design asset (brief section 1, "Shape and space").
 *
 * Only Appearance exists here so far (Task A, item 6). The AccountSettings
 * component, the Circles-visibility toggle, the followed-hobbies list and
 * private logs still live in You.tsx's own settings dialog — moving those
 * here, plus Profile/Account/Privacy/Notifications/Data/Danger-zone, is
 * Task C's job. The Circles-visibility toggle in particular can't just move:
 * it's plain component state read by the same page that renders it, and
 * relocating it here without first lifting it into localStorage or a
 * context would silently stop it doing anything.
 */
const APPEARANCE_OPTIONS: {
  value: ThemePreference;
  label: string;
  sublabel: string;
  swatch: { bg: string; card: string; ink: string };
}[] = [
  {
    value: "system",
    label: "System default",
    sublabel: "MATCHES YOUR DEVICE",
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

function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <section>
      <SectionHeader n={1} eyebrow="APPEARANCE" title="Appearance" />
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
                "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors " +
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
              {/* The radio's own indicator IS the terracotta dot the brief
                  asks for as the selected-state marker. */}
              <RadioGroupItem value={opt.value} id={`appearance-${opt.value}`} />
            </Label>
          );
        })}
      </RadioGroup>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Light is warm paper, dark is warm charcoal. Same identity in either.
      </p>
    </section>
  );
}

export function Settings() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-12">
      <h1 className="mb-8 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
        Settings
      </h1>
      <AppearanceSection />
      <Separator className="my-8" />
      {/* Profile, Account, Privacy, Notifications, Your data and Danger
          zone (brief sections 4.2–4.7) land here in Task C. */}
    </div>
  );
}
