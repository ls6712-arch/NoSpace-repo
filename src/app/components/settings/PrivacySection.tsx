import { useSettings, type DefaultVisibility } from "../../context/SettingsContext";
import { SectionHeader } from "../ui/section-header";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { SettingsPanel, SettingsRow, SavedFlash, useSavedFlash } from "./SettingsRow";

function DefaultVisibilityRow() {
  const { defaultVisibility, setDefaultVisibility, defaultVisibilityLoaded } = useSettings();
  const { saved, flash } = useSavedFlash();

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-0.5 text-sm">Default visibility for new Moments</div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        What a new Moment starts as in the composer — you can always change it there before sharing.
      </p>
      <RadioGroup
        value={defaultVisibility}
        onValueChange={(v) => {
          void setDefaultVisibility(v as DefaultVisibility).then((r) => {
            if (!r.error) flash();
          });
        }}
        className="flex flex-row flex-wrap gap-4"
      >
        {(
          [
            { value: "private", label: "Only you" },
            { value: "public", label: "Everyone" },
          ] as const
        ).map((opt) => (
          <Label
            key={opt.value}
            htmlFor={`default-visibility-${opt.value}`}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
          >
            <RadioGroupItem
              value={opt.value}
              id={`default-visibility-${opt.value}`}
              disabled={!defaultVisibilityLoaded}
            />
            {opt.label}
          </Label>
        ))}
      </RadioGroup>
      {saved && (
        <div className="mt-2">
          <SavedFlash show />
        </div>
      )}
    </div>
  );
}

export function PrivacySection() {
  const { circlesVisible, setCirclesVisible } = useSettings();

  return (
    <section>
      <SectionHeader n={4} eyebrow="PRIVACY" title="Privacy" />
      <p className="mb-4 text-sm text-muted-foreground">
        Who sees your Circles, and who sees what you make by default.
      </p>
      <SettingsPanel>
        <SettingsRow
          label="Show my Circles on my work"
          description={
            circlesVisible
              ? "Visible — anyone viewing your work can see which Circles you've joined."
              : "Hidden — only you can see which Circles you've joined."
          }
        >
          <Switch
            checked={circlesVisible}
            onCheckedChange={setCirclesVisible}
            aria-label="Show my Circles on my work"
          />
        </SettingsRow>
        <DefaultVisibilityRow />
      </SettingsPanel>
    </section>
  );
}
