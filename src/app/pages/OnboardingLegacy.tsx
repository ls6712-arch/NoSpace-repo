import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { TermsCheckbox } from "../components/TermsCheckbox";
import { needsTermsAcceptance, recordTermsAcceptance } from "../lib/termsAcceptance";
import { OnboardingInviteCard } from "../components/OnboardingInviteCard";
import { MoodsCityForm } from "../components/interests/MoodsCityForm";
import { PersonAvatar } from "./CreatePursuit";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { joinTokenFrom } from "../lib/joinToken";
import { fetchInvitesLeft } from "../lib/invites";
import { cleanCity, useInterests } from "../lib/interests";
import { fetchInvitePreview, fetchPursuitAsProject, joinViaLink, type InvitePreview } from "../lib/pursuitsRemote";
import { addJoinedProject } from "../lib/journal";
import type { MoodId } from "../data/moods";
import { Button } from "../components/ui/button";
import { PillButton } from "../components/ui/PillButton";
import { PAGE_FROM, PAGE_TO, page } from "../lib/motionTokens";
import { ERROR_LINE, OFFLINE_LINE } from "../lib/stateCopy";
import { DISPLAY_NAME_MAX, isEmailPrefixName, validateDisplayName } from "../lib/displayName";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export { joinTokenFrom };

/**
 * The two-step onboarding the Soosh onboarding brief replaces. Still what
 * /onboarding shows until `sooshOnboardingEnabled` (config.ts) is on; it is
 * deleted when the last of the four onboarding PRs lands.
 *
 * Shown once, right after signup (Root.tsx's guard decides when). Two steps:
 * a name (and the Terms, when they have not been accepted yet), then "What do
 * you want more of?": the moods and the city, which is all Discover needs to
 * show what is on this week. One optional invite card follows for someone who
 * still has an invite to give.
 *
 * Arriving from a Pursuit invite link (`?redirect=/join/:token`), the inviter's
 * card sits on top of the second step and the button joins their Pursuit.
 */
export function OnboardingLegacy() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/discover";
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const { isAdmin } = useCategories();
  const interests = useInterests();

  // 0 = name, 1 = moods and city, 2 = the optional invite card (after onboarding is saved).
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [invitesLeft, setInvitesLeft] = useState<number | null>(0);
  const [moods, setMoods] = useState<MoodId[]>([]);
  const [city, setCity] = useState("");
  const [cityTouched, setCityTouched] = useState(false);
  useEffect(() => {
    if (!cityTouched && interests.city) setCity(interests.city);
  }, [interests.city, cityTouched]);

  const joinToken = joinTokenFrom(redirectTo);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  useEffect(() => {
    if (!joinToken) return;
    let live = true;
    void fetchInvitePreview(joinToken).then((p) => live && setInvite(p));
    return () => {
      live = false;
    };
  }, [joinToken]);

  const [nameInput, setNameInput] = useState("");
  // A name typed at sign-up carries over for a quick confirm; one the
  // database made up from the email address never does.
  const [nameTouched, setNameTouched] = useState(false);
  useEffect(() => {
    if (nameTouched || !profile?.display_name) return;
    if (!isEmailPrefixName(profile.display_name, user?.email)) setNameInput(profile.display_name);
  }, [profile?.display_name, user?.email, nameTouched]);
  // Anyone who got here without ticking the sign-up box (confirmed the email
  // on another device, or Google from the log in form) is asked once here.
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const saveName = async () => {
    if (savingName) return;
    if (termsNeeded && !termsAgreed) return;
    const checked = validateDisplayName(nameInput);
    if (!checked.ok) {
      setNameError(checked.error);
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      if (termsNeeded) {
        const recorded = await recordTermsAcceptance();
        if (recorded.error) {
          setNameError(ERROR_LINE);
          return;
        }
        setTermsNeeded(false);
      }
      const { error } = await updateProfile({ display_name: checked.name });
      if (error) {
        setNameError(ERROR_LINE);
        return;
      }
      setStep(1);
    } catch {
      setNameError(OFFLINE_LINE);
    } finally {
      setSavingName(false);
    }
  };

  const [landing, setLanding] = useState(redirectTo);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const finish = async () => {
    if (finishing || moods.length === 0) return;
    setFinishing(true);
    setFinishError(null);
    try {
      // Saved on this device and, once the profile columns exist, on the profile.
      // A failed profile write does not hold anyone back: the device copy drives Discover.
      await interests.save({ city: cleanCity(city), moods });
      // This has to actually succeed before leaving: a failed write left
      // onboarding_completed false, and Root's guard sent people straight back here.
      const title = profile?.display_name?.trim() || null;
      const { error } = await updateProfile({ onboarding_completed: true, cover_title: title });
      if (error) {
        setFinishError(ERROR_LINE);
        return;
      }
      // The button said "Join {name}'s Pursuit", so join it now; if that fails
      // the invite page is the fallback and shows the reason.
      let target = redirectTo;
      if (joinToken && invite) {
        const joined = await joinViaLink(joinToken);
        if (joined.pursuitId) {
          target = `/pursuit/${joined.pursuitId}`;
          const project = await fetchPursuitAsProject(joined.pursuitId);
          if (project) addJoinedProject({ ...project, role: project.ownerId === user?.id ? "owner" : "member" });
        }
      }
      setLanding(target);
      const left = user ? await fetchInvitesLeft(user.id, profile?.invite_allowance ?? 0, isAdmin) : 0;
      if (left === null || left > 0) {
        setInvitesLeft(left);
        setStep(2);
        return;
      }
      navigate(target, { replace: true });
    } catch {
      setFinishError(OFFLINE_LINE);
    } finally {
      setFinishing(false);
    }
  };

  const joinLabel = invite ? `Join ${invite.ownerName.slice(0, 40)}’s Pursuit` : null;

  return (
    <div className="ns-afterhours min-h-viewport bg-background">
      <div className="mx-auto flex min-h-viewport max-w-md flex-col px-4 pt-10 pb-6">
        {step === 0 && (
          <NameStep
            value={nameInput}
            onChange={(v) => {
              setNameTouched(true);
              setNameInput(v);
              setNameError(null);
            }}
            error={nameError}
            saving={savingName}
            termsNeeded={termsNeeded}
            termsAgreed={termsAgreed}
            onTermsChange={setTermsAgreed}
            onContinue={() => void saveName()}
          />
        )}

        {step === 1 && (
          <>
            <motion.p initial={PAGE_FROM} animate={PAGE_TO} transition={page} className="font-[family-name:var(--font-display)] text-lead font-extrabold text-accent-text">
              Soosh
            </motion.p>

            {invite && (
              <motion.div
                initial={PAGE_FROM}
                animate={PAGE_TO}
                transition={page}
                className="mt-6 flex items-center gap-3 rounded-card border border-accent bg-card p-4"
              >
                <PersonAvatar name={invite.ownerName} src={invite.ownerAvatar} size="size-12" />
                <p className="text-body font-semibold">{`${invite.ownerName.slice(0, 60)} invited you to ${invite.title.slice(0, 150)}`}</p>
              </motion.div>
            )}

            <motion.h1
              initial={PAGE_FROM}
              animate={PAGE_TO}
              transition={page}
              className="mt-8 font-[family-name:var(--font-display)] text-display font-extrabold"
            >
              What do you want more of?
            </motion.h1>
            <p className="mt-3 mb-6 text-body text-muted-foreground">Pick a few. We’ll show you things to do this week, and who’s doing them.</p>

            <MoodsCityForm moods={moods} city={city} onMoods={setMoods} onCity={(c) => { setCityTouched(true); setCity(c); }} />

            <div className="sticky bottom-0 mt-auto flex flex-col items-center gap-3 bg-background pt-8 pb-[max(0.5rem,var(--safe-bottom,0px))]">
              {finishError && (
                <p role="alert" className="text-caption text-accent-text">
                  {finishError}
                </p>
              )}
              {moods.length === 0 && <p className="text-caption text-muted-foreground">Pick at least one</p>}
              <PillButton className="w-full" disabled={moods.length === 0 || finishing} onClick={() => void finish()}>
                {joinLabel ?? "Show me what to do"}
              </PillButton>
              <p className="text-caption text-muted-foreground">Takes 10 seconds. Change it any time.</p>
            </div>
          </>
        )}

        {step === 2 && <OnboardingInviteCard invitesLeft={invitesLeft} onDone={() => navigate(landing, { replace: true })} />}
      </div>
    </div>
  );
}

/** The first step: a required name, shown as it will read on a Shelf. */
function NameStep({
  value,
  onChange,
  error,
  saving,
  termsNeeded,
  termsAgreed,
  onTermsChange,
  onContinue,
}: {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  saving: boolean;
  termsNeeded: boolean;
  termsAgreed: boolean;
  onTermsChange: (next: boolean) => void;
  onContinue: () => void;
}) {
  const shown = value.replace(/\s+/g, " ").trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <h1 className="mb-1 text-title sm:text-display" style={{ fontFamily: "var(--font-serif)" }}>
        What should people call you?
      </h1>
      <p className="mb-6 text-small text-[var(--muted-foreground)]">This is how your name shows on your Shelf.</p>

      <Label htmlFor="onboarding-name" className="mb-2 block">
        Name
      </Label>
      <Input
        id="onboarding-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="name"
        autoFocus
        aria-invalid={!!error}
      />
      {error && <p className="mt-2 text-caption text-[var(--accent-text)]">{error}</p>}

      <div className="mt-6 rounded-card border border-[var(--border)] bg-[var(--card)] p-5" aria-live="polite">
        <p className="mb-1 text-caption text-[var(--muted-foreground)]">Your Shelf</p>
        <p className="break-words text-title leading-tight" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
          {shown || "Your name"}
        </p>
      </div>

      {termsNeeded && (
        <div className="mt-6">
          <TermsCheckbox checked={termsAgreed} onChange={onTermsChange} id="onboarding-terms" />
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button busy={saving} type="submit" variant="default" disabled={saving || (termsNeeded && !termsAgreed)}>
          Continue
        </Button>
      </div>
    </form>
  );
}
