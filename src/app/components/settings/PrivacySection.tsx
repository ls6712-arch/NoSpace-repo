import { useState } from "react";
import { useSettings, type DefaultVisibility } from "../../context/SettingsContext";
import { useSocial } from "../../context/SocialContext";
import { SectionHeader } from "../ui/section-header";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { SettingsPanel, SettingsRow, SavedFlash, useSavedFlash } from "./SettingsRow";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Who you've blocked, with Unblock. Follows (in either direction) are not
 * restored on unblock, per docs/communication-strategy.md's Phase 1
 * decisions. */
function BlockedPeopleSection() {
  const social = useSocial();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (social.blockedPeople.length === 0) {
    return (
      <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground sm:px-5">
        You haven't blocked anyone.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--hairline)]">
      {social.blockedPeople.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-8 shrink-0">
              {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
              <AvatarFallback className="text-[10px]">{initials(p.displayName)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{p.displayName}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busyId === p.id}
            onClick={async () => {
              setBusyId(p.id);
              await social.unblock(p.id);
              setBusyId(null);
            }}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

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

      <h2 className="mb-1 mt-8 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
        Blocked people
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        They can't message you, follow you, react, or comment on your Moments, and don't see your
        profile. Unblocking doesn't restore a follow.
      </p>
      <SettingsPanel>
        <BlockedPeopleSection />
      </SettingsPanel>
    </section>
  );
}
