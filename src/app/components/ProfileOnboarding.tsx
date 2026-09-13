import { useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { markLocalOnboardingDone } from "../lib/onboardingLocal";
import { AvatarPicker } from "./AvatarPicker";
import { InterestField } from "./InterestField";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const STEP_COUNT = 3;

function interestLabel(key: string) {
  return key
    .slice("interest:".length)
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * First-run guided setup: photo + name, at least one interest, then an
 * optional tagline. Shown once, in place of the normal /you page — see
 * You.tsx's own check against profile.onboarding_completed_at for exactly
 * when. Every field saves through the same mechanisms the profile page
 * itself already uses (AvatarPicker's self-contained upload,
 * updateProfile, toggleHobbyFollow), so nothing here is a separate,
 * parallel data path that could drift from the real profile.
 */
export function ProfileOnboarding({ onDone }: { onDone: () => void }) {
  const { profile, updateProfile } = useAuth();
  const social = useSocial();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile?.avatar_url);
  const [name, setName] = useState(profile?.display_name?.trim() ?? "");
  const [interestInput, setInterestInput] = useState("");
  const [tagline, setTagline] = useState(profile?.tagline ?? "");
  const [saving, setSaving] = useState(false);

  const interests = social.followedHobbies.filter((k) => k.startsWith("interest:"));

  const addInterest = () => {
    const label = interestInput.trim();
    if (!label) return;
    void social.toggleHobbyFollow(`interest:${label.toLowerCase()}`, label);
    setInterestInput("");
  };

  const finish = async () => {
    setSaving(true);
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== profile?.display_name?.trim()) {
      await updateProfile({ display_name: trimmedName });
    }
    const trimmedTagline = tagline.trim();
    if (trimmedTagline !== (profile?.tagline ?? "")) {
      await updateProfile({ tagline: trimmedTagline || undefined });
    }
    await updateProfile({ onboarding_completed_at: new Date().toISOString() });
    markLocalOnboardingDone();
    setSaving(false);
    onDone();
  };

  const next = () => {
    if (step < STEP_COUNT) setStep((s) => (s + 1) as 1 | 2 | 3);
    else void finish();
  };

  const hasContentThisStep =
    step === 1 ? name.trim().length > 0 || !!avatarUrl : step === 3 ? tagline.trim().length > 0 : true;
  const blocked = step === 2 && interests.length === 0;
  const buttonLabel = saving
    ? "Saving…"
    : step === STEP_COUNT
      ? hasContentThisStep
        ? "Done"
        : "Skip"
      : hasContentThisStep || step === 2
        ? "Continue"
        : "Skip";

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto max-w-md px-4">
        <div className="mb-8 flex items-center gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-[var(--coral-deep)]" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          {step === 1 && (
            <>
              <h1 className="mb-1 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                A photo and a name
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Both optional — change either any time from your profile.
              </p>
              <div className="mb-6">
                <AvatarPicker name={name.trim() || "You"} url={avatarUrl} onChange={setAvatarUrl} />
              </div>
              <label htmlFor="onboarding-name" className="mb-1.5 block text-xs">
                Name
              </label>
              <Input
                id="onboarding-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should people call you?"
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mb-1 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                Pick your interests
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                At least one — this is what your feed and profile build around.
              </p>
              {/* Side by side, not stacked: InterestField's suggestion
                  dropdown renders directly beneath the input and would
                  otherwise sit on top of an "Add" button placed below it,
                  blocking clicks on it while the dropdown is open. */}
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <InterestField
                    id="onboarding-interest"
                    value={interestInput}
                    onChange={setInterestInput}
                    placeholder="Pottery, bouldering, sourdough…"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!interestInput.trim()}
                  onClick={addInterest}
                >
                  + Add interest
                </Button>
              </div>

              {interests.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {interests.map((key) => {
                    const label = interestLabel(key);
                    return (
                      <span
                        key={key}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs"
                      >
                        <Check className="size-3" />
                        {label}
                        <button
                          type="button"
                          onClick={() => void social.toggleHobbyFollow(key, label)}
                          aria-label={`Remove ${label}`}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mb-1 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                Add a tagline
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Optional — a short line under your name. Skip it if nothing comes to mind.
              </p>
              <Input
                value={tagline}
                maxLength={80}
                onChange={(e) => setTagline(e.target.value)}
                placeholder={`"Same person, more hobbies."`}
              />
            </>
          )}

          <div className="mt-8 flex justify-end">
            <Button variant={hasContentThisStep ? "coral" : "outline"} disabled={blocked || saving} onClick={next}>
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
