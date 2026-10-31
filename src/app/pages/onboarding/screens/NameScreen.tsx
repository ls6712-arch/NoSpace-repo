import { useEffect, useState } from "react";
import { TermsCheckbox } from "../../../components/TermsCheckbox";
import { PillButton } from "../../../components/ui/PillButton";
import { OnboardingField } from "../../../components/onboarding/OnboardingField";
import { useAuth } from "../../../context/AuthContext";
import { DISPLAY_NAME_MAX, isEmailPrefixName, validateDisplayName } from "../../../lib/displayName";
import { firstNameOf, isValidUsername, setUsername, suggestUsername, USERNAME_MAX, usernameFromName } from "../../../lib/onboardingRemote";
import { ERROR_LINE, OFFLINE_LINE } from "../../../lib/stateCopy";
import { needsTermsAcceptance, recordTermsAcceptance } from "../../../lib/termsAcceptance";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

type Availability = { state: "idle" } | { state: "free" } | { state: "taken"; suggestion: string | null };

/**
 * Screen 4: a first name, then a username made from it that can be edited.
 * A taken username is never an error dialog: the next free one is offered
 * under the field.
 */
export function NameScreen() {
  const { next, react } = useOnboarding();
  const { user, profile, updateProfile } = useAuth();

  const [first, setFirst] = useState("");
  const [firstTouched, setFirstTouched] = useState(false);
  const [username, setUsernameValue] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The name from Google, or one typed before; never the one made up from the email address.
  useEffect(() => {
    if (firstTouched) return;
    const fromGoogle = (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ?? (user?.user_metadata as { name?: string } | undefined)?.name;
    const stored = profile?.display_name && !isEmailPrefixName(profile.display_name, user?.email) ? profile.display_name : "";
    const known = firstNameOf(stored || fromGoogle || "");
    if (known) setFirst(known);
  }, [firstTouched, profile?.display_name, user?.email, user?.user_metadata]);

  // The username follows the first name until someone edits it.
  useEffect(() => {
    if (!usernameTouched) setUsernameValue(usernameFromName(first));
  }, [first, usernameTouched]);

  // Is it free? Asked a moment after the typing stops.
  useEffect(() => {
    if (!isValidUsername(username)) {
      setAvailability({ state: "idle" });
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      void suggestUsername(username).then((s) => {
        if (!live || s === null) return;
        setAvailability(s === username ? { state: "free" } : { state: "taken", suggestion: s });
      });
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [username]);

  // Anyone who got here without ticking the Terms box (a session from another device) is asked once.
  const [termsNeeded, setTermsNeeded] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void needsTermsAcceptance(user.id).then((needed) => live && setTermsNeeded(needed));
    return () => {
      live = false;
    };
  }, [user?.id]);

  const nameOk = validateDisplayName(first).ok;
  const ready = nameOk && isValidUsername(username) && (!termsNeeded || termsAgreed);

  const save = async () => {
    if (saving) return;
    const checked = validateDisplayName(first);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!isValidUsername(username)) {
      setError(`Use 3 to ${USERNAME_MAX} letters, numbers or underscores.`);
      return;
    }
    // Without an account (a local preview) there is nothing to save.
    if (!user) {
      next({ stamp: true });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (termsNeeded) {
        const recorded = await recordTermsAcceptance();
        if (recorded.error) {
          setError(ERROR_LINE);
          return;
        }
        setTermsNeeded(false);
      }
      const result = await setUsername(username);
      if (result === "taken") {
        react("shrug");
        setAvailability({ state: "taken", suggestion: await suggestUsername(username) });
        return;
      }
      if (result === "invalid") {
        setError(`Use 3 to ${USERNAME_MAX} letters, numbers or underscores.`);
        return;
      }
      if (result === "error") {
        setError(ERROR_LINE);
        return;
      }
      const { error: saveError } = await updateProfile({ display_name: checked.name });
      if (saveError) {
        setError(ERROR_LINE);
        return;
      }
      next({ stamp: true });
    } catch {
      setError(OFFLINE_LINE);
    } finally {
      setSaving(false);
    }
  };

  const takenHint =
    availability.state === "taken"
      ? availability.suggestion
        ? `@${username} is taken. @${availability.suggestion} is free.`
        : `@${username} is taken.`
      : availability.state === "free"
        ? `@${username} is free`
        : undefined;

  return (
    <ScreenFrame
      title="What should people call you?"
      hero={<StepStubby size={140} />}
      footer={
        <>
          {error && (
            <p role="alert" className="ob-label text-small">
              {error}
            </p>
          )}
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving || !ready}>
            {!nameOk ? "Add your first name" : "Next"}
          </PillButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <OnboardingField
          label="First name"
          autoComplete="given-name"
          autoFocus
          maxLength={DISPLAY_NAME_MAX}
          value={first}
          onChange={(e) => {
            setFirstTouched(true);
            setFirst(e.target.value);
            setError(null);
          }}
        />
        <OnboardingField
          label="Username"
          prefix="@"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          value={username}
          onChange={(e) => {
            setUsernameTouched(true);
            setUsernameValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            setAvailability({ state: "idle" });
            setError(null);
          }}
          hint={takenHint}
        />
        {availability.state === "taken" && availability.suggestion && (
          <button
            type="button"
            className="ob-suggestion self-start"
            onClick={() => {
              setUsernameTouched(true);
              setUsernameValue(availability.suggestion ?? "");
            }}
          >
            {`Use @${availability.suggestion}`}
          </button>
        )}
        {termsNeeded && <TermsCheckbox checked={termsAgreed} onChange={setTermsAgreed} id="onboarding-terms-late" />}
      </form>
    </ScreenFrame>
  );
}
