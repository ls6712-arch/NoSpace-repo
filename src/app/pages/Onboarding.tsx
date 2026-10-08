import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TagsField } from "../components/TagsField";
import { AvatarPicker } from "../components/AvatarPicker";
import { Log } from "./Log";
import { TermsCheckbox } from "../components/TermsCheckbox";
import { needsTermsAcceptance, recordTermsAcceptance } from "../lib/termsAcceptance";
import { onboardingUsesMainForm } from "../config";
import { FirstMomentStep } from "../components/FirstMomentStep";
import { OnboardingInviteCard } from "../components/OnboardingInviteCard";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useContent } from "../context/ContentContext";
import { useCorners, cornerFollowKey } from "../context/CornersContext";
import { useCategories } from "../context/CategoriesContext";
import { fetchInvitesLeft } from "../lib/invites";
import { Button } from "../components/ui/button";
import { ENTER } from "../lib/motion";
import { ERROR_LINE, OFFLINE_LINE } from "../lib/stateCopy";
import { DISPLAY_NAME_MAX, isEmailPrefixName, validateDisplayName } from "../lib/displayName";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

/** Every chip carried across the wizard shares this layoutId prefix, so
 * Motion can visibly travel a tag from step 1's field into step 2's quiet
 * summary row and step 3's pre-tagged Moment cards, rather than popping in
 * fresh at each stop. */
const TAG_LAYOUT_PREFIX = "onboarding-tag-";

/** Curated, neutral cover backgrounds for step 2 — built from the app's own
 * paper/ink tokens (theme.css's .ns-paper-theme block), not arbitrary color
 * or a stock-photo library, so a brand-new account's cover always looks
 * intentional and on-palette before a single real photo exists to use
 * instead (see Studio.tsx, which prefers a real pinned Moment once one
 * exists). Index 0 is the default a skip or an unmade choice falls back to. */
const COVER_TEXTURES = [
  {
    id: "warm-paper",
    css: "radial-gradient(120% 120% at 20% 15%, var(--paper-raised) 0%, var(--line) 45%, var(--ink-soft) 100%)",
  },
  {
    id: "moss-fade",
    css: "linear-gradient(155deg, var(--ink) 0%, var(--moss) 55%, var(--ink-faint) 100%)",
  },
  {
    id: "coral-dusk",
    css: "radial-gradient(140% 140% at 80% 10%, var(--coral-deep) 0%, var(--ink-soft) 55%, var(--ink) 100%)",
  },
];

/** Spring, not linear-ease, everywhere motion appears on this page — the
 * step transition, the tag chips traveling forward, and the cover's own
 * pieces settling into place in step 2. Nowhere else gets motion. */
// design-token-ignore: spring, not a fixed duration; every use below is switched off by reduceMotion
const SPRING = ENTER;

/**
 * Shown once, right after signup — see sql/onboarding-v2.sql and Root.tsx's
 * own guard for exactly when (both untouched by this rewrite; both correct
 * as-is). Three steps: Step 3's own "Add your first moment" (no questions
 * asked first), open tags (replacing the old fixed Space grid), and the
 * Studio-style cover itself (replacing the old bio-less flow entirely) —
 * finishing right from the cover step now. The old third step, a per-tag
 * "write a first page" gauntlet, is gone: it asked for up to five more
 * Moments right after the real first one, which is exactly the friction
 * Step 3 exists to remove from onboarding.
 *
 * After the cover saves, one optional invite card follows — only for someone
 * who still has an invite to give (see OnboardingInviteCard). Everyone else
 * goes straight on, exactly as before.
 */
export function Onboarding() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/you";
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const { isAdmin } = useCategories();
  const social = useSocial();
  const { refetchActiveHobbies } = useContent();
  const { resolveInterest } = useCorners();
  const reduceMotion = !!useReducedMotion();

  // 4 = the optional invite card, reached only after the cover has saved.
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [invitesLeft, setInvitesLeft] = useState<number | null>(0);
  const [tags, setTags] = useState<string[]>([]);

  // Avatar: AvatarPicker persists to profiles.avatar_url the moment a photo
  // is picked — its own established contract, unchanged here. This is just
  // the local mirror every other AvatarPicker call site already keeps.
  const [avatar, setAvatar] = useState<string | undefined>(profile?.avatar_url);

  // Title/tagline/photo: all deferred to finish() below, same as the tags
  // themselves — nothing here writes to profiles until Finish or Skip.
  // Never prefilled from the email: the name step below asks for it fresh.
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
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  useEffect(() => {
    if (!titleTouched && profile?.display_name) setTitle(profile.display_name);
  }, [profile?.display_name, titleTouched]);

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
      const { error } = await updateProfile({ display_name: checked.name });
      if (error) {
        setNameError(ERROR_LINE);
        return;
      }
      if (termsNeeded && user) await recordTermsAcceptance(user.id);
      setTitle(checked.name);
      setTitleTouched(true);
      goToStep(1);
    } catch {
      setNameError(OFFLINE_LINE);
    } finally {
      setSavingName(false);
    }
  };

  const [tagline, setTagline] = useState("");
  const [textureIndex, setTextureIndex] = useState(0);

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const goToStep = (next: 1 | 2 | 3) => setStep(next);

  /** A "blank page" cover is still a complete, on-brand one — never a hole
   * where a title or texture should be. Finishes onboarding directly now —
   * the cover step is the last one, so "skip the cover" and "skip the rest
   * of onboarding" are the same button. Passes the blank-page title/tagline
   * straight to finish() rather than through setTitle/setTagline first —
   * those are async state updates, and finish() reading its own still-stale
   * closure a moment later would send whatever title/tagline predated this
   * click instead of the blank-page values just chosen. */
  const skipCover = () => {
    const blankTitle = profile?.display_name?.trim() ?? "You";
    setTitle(blankTitle);
    setTagline("");
    setTextureIndex(0);
    void finish({ title: blankTitle, tagline: "" });
  };

  const finish = async (overrides?: { title: string; tagline: string }) => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    const finishTitle = overrides?.title ?? title;
    const finishTagline = overrides?.tagline ?? tagline;
    try {
      // Follows are derived from the open tags now, not written as each one
      // is picked — private Interests, Corner by Corner (spec change:
      // "Corners carry discovery" — nobody follows a whole Category
      // anymore). resolveInterest matches an existing Corner or creates
      // one (see CornersContext), so every real tag ends up followed, not
      // just the ones that happened to already be in the curated baseline.
      // Only the ones not already followed do any writing.
      for (const tag of tags) {
        const match = await resolveInterest(tag);
        // A blocked tag (trademarked name) already got its own friendly
        // message on the MomentCard step, if it went through one — here,
        // finishing onboarding shouldn't stall or error over it, just
        // silently skip the follow. The tag itself still exists as
        // freeform text on whatever Moment it was attached to.
        if (!match || "blocked" in match) continue;
        const key = cornerFollowKey(match.spaceSlug, match.slug);
        if (!social.isFollowingHobby(key)) {
          void social.toggleHobbyFollow(key, match.name);
        }
      }
      // Picked up by Root.tsx's guard and everywhere else that reads
      // activeHobbySlugs (feed relevance): without this, the follows just
      // written above wouldn't show up here until the next full sign-in.
      await refetchActiveHobbies();
      // This has to actually succeed before leaving — see the identical
      // reasoning this pattern already had before this rewrite. A failed
      // write here left onboarding_completed still false in the database,
      // and navigating away anyway just sent you straight into Root's own
      // guard, which bounces you right back to step one.
      const { error } = await updateProfile({
        onboarding_completed: true,
        cover_title: finishTitle.trim() || null,
        // One shared field at onboarding time — bio and cover_tagline can
        // diverge later from Settings or the cover editor, but they start
        // as the same input here rather than asking for both.
        bio: finishTagline.trim() || null,
        cover_tagline: finishTagline.trim() || null,
      });
      if (error) {
        setFinishError(ERROR_LINE);
        return;
      }
      // onboarding_completed is saved now, so the invite card below is
      // purely optional: leaving from it (or a failed read here) can't
      // bounce anyone back through Root's guard.
      const left = user
        ? await fetchInvitesLeft(user.id, profile?.invite_allowance ?? 0, isAdmin)
        : 0;
      if (left === null || left > 0) {
        setInvitesLeft(left);
        setStep(4);
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setFinishError(OFFLINE_LINE);
    } finally {
      setFinishing(false);
    }
  };

  const stepDirection = { 0: -1, 1: -1, 2: 0, 3: 1, 4: 1 } as const;
  const slideVariants = {
    enter: (dir: number) => (reduceMotion ? {} : { x: dir >= 0 ? 32 : -32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => (reduceMotion ? {} : { x: dir >= 0 ? -32 : 32, opacity: 0 }),
  };

  return (
    <div className="ns-paper-theme min-h-viewport bg-[var(--paper)] py-10 sm:py-14">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-[var(--coral-deep)]" : "bg-[var(--line)]"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={stepDirection[step]} initial={false}>
          <motion.div
            key={step}
            custom={stepDirection[step]}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : SPRING}
          >
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

            {step === 1 &&
              (onboardingUsesMainForm ? (
                <Log onboarding={{ onDone: () => goToStep(2) }} />
              ) : (
                <FirstMomentStep onContinue={() => goToStep(2)} />
              ))}

            {step === 2 && (
              <>
                <h1 className="mb-1 text-title sm:text-display" style={{ fontFamily: "var(--font-serif)" }}>
                  What are you into?
                </h1>
                <p className="mb-6 text-small text-[var(--ink-soft)]">
                  Add a few tags, as specific as you like.
                </p>

                <TagsField
                  value={tags}
                  onChange={setTags}
                  placeholder="Pottery, sourdough, bouldering"
                  chipLayoutIdPrefix={TAG_LAYOUT_PREFIX}
                />

                <div className="mt-8 flex justify-end">
                  <Button variant="coral" onClick={() => goToStep(3)}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <CoverStep
                avatar={avatar}
                onAvatarChange={setAvatar}
                title={title}
                onTitleChange={(v) => {
                  setTitleTouched(true);
                  setTitle(v);
                }}
                tagline={tagline}
                onTaglineChange={setTagline}
                textureIndex={textureIndex}
                onTextureChange={setTextureIndex}
                tags={tags}
                reduceMotion={reduceMotion}
                onContinue={() => void finish()}
                onSkip={skipCover}
                finishing={finishing}
                finishError={finishError}
              />
            )}

            {step === 4 && (
              <OnboardingInviteCard
                invitesLeft={invitesLeft}
                onDone={() => navigate(redirectTo, { replace: true })}
              />
            )}
          </motion.div>
        </AnimatePresence>
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
      <p className="mb-6 text-small text-[var(--ink-soft)]">This is how your name shows on your Shelf.</p>

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
      {error && <p className="mt-2 text-caption text-[var(--coral-text)]">{error}</p>}

      <div className="mt-6 rounded-card border border-[var(--line)] bg-[var(--paper-raised)] p-5" aria-live="polite">
        <p className="mb-1 text-caption text-[var(--ink-soft)]">Your Shelf</p>
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
        <Button busy={saving} type="submit" variant="coral" disabled={saving || (termsNeeded && !termsAgreed)}>
          Continue
        </Button>
      </div>
    </form>
  );
}

/**
 * Step 2, rendered as the actual cover layout — full-bleed background, name
 * and tagline overlaid at the bottom, exactly like Studio.tsx's own cover
 * state — rather than a form with labeled boxes. The one screen in
 * onboarding meant to feel considered: each piece (avatar, background,
 * title, tagline) settles into place with a small spring as it's filled in,
 * instead of the page just snapping into its final state.
 */
function CoverStep({
  avatar,
  onAvatarChange,
  title,
  onTitleChange,
  tagline,
  onTaglineChange,
  textureIndex,
  onTextureChange,
  tags,
  reduceMotion,
  onContinue,
  onSkip,
  finishing,
  finishError,
}: {
  avatar: string | undefined;
  onAvatarChange: (next: string | undefined) => void;
  title: string;
  onTitleChange: (next: string) => void;
  tagline: string;
  onTaglineChange: (next: string) => void;
  textureIndex: number;
  onTextureChange: (next: number) => void;
  tags: string[];
  reduceMotion: boolean;
  onContinue: () => void;
  onSkip: () => void;
  finishing: boolean;
  finishError: string | null;
}) {
  const displayName = title.trim() || "You";
  const Chip = reduceMotion ? "span" : motion.span;
  const chipProps = (tag: string) =>
    reduceMotion ? {} : { layout: true, layoutId: `${TAG_LAYOUT_PREFIX}${tag}` };

  // Assembling entrance: avatar, then title, then tagline, then the texture
  // picker — a short stagger so the cover visibly comes together rather
  // than appearing all at once. Skipped entirely under reduced motion.
  const settle = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { ...SPRING, delay },
        };

  return (
    <div className="relative overflow-hidden rounded-card border border-[var(--line)]">
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/10]">
        <AnimatePresence mode="wait">
          <motion.div
            key={textureIndex}
            className="absolute inset-0"
            style={{ background: COVER_TEXTURES[textureIndex].css }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-scrim" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <motion.div {...settle(0)} className="mb-4 inline-block rounded-card bg-[var(--paper-raised)]/90 p-2.5 backdrop-blur-sm">
            <AvatarPicker compact name={displayName} url={avatar} onChange={onAvatarChange} />
          </motion.div>

          <motion.p {...settle(0.05)} className="mb-1 text-caption tracking-[0.16em] text-on-media/90">
            Let’s set the scene
          </motion.p>

          <motion.div {...settle(0.1)}>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="w-full max-w-lg border-none bg-transparent text-display leading-tight text-on-media outline-none placeholder:text-on-media/50"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            />
          </motion.div>

          <motion.div {...settle(0.15)}>
            <input
              value={tagline}
              onChange={(e) => onTaglineChange(e.target.value)}
              placeholder="What’s this about? (optional)"
              maxLength={160}
              className={`mt-2 w-full max-w-md border-b border-dashed bg-transparent text-body italic text-on-media outline-none placeholder:text-on-media/60 focus:border-on-media/70 sm:text-lead ${
                tagline ? "border-transparent" : "border-on-media/40"
              }`}
              style={{ fontFamily: "var(--font-serif)" }}
            />
          </motion.div>

          {tags.length > 0 && (
            <motion.div {...settle(0.2)} className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  {...chipProps(tag)}
                  className="rounded-control border border-on-media/30 bg-scrim-solid/20 px-2.5 py-1 text-caption text-on-media/90"
                >
                  {tag}
                </Chip>
              ))}
            </motion.div>
          )}

          <motion.div {...settle(0.25)} className="mt-5">
            <p className="mb-1.5 text-caption text-on-media/90">Background</p>
            <div className="flex gap-2">
              {COVER_TEXTURES.map((texture, i) => (
                <button
                  key={texture.id}
                  type="button"
                  onClick={() => onTextureChange(i)}
                  className={`h-12 w-[72px] shrink-0 overflow-hidden rounded-control ${
                    textureIndex === i ? "border-2 border-coral-deep" : "border border-on-media/40"
                  }`}
                  style={{ background: texture.css }}
                  aria-label={`Use this background`}
                  aria-pressed={textureIndex === i}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 border-t border-[var(--line)] bg-[var(--paper-raised)] p-4">
        {finishError && <p className="text-caption text-[var(--coral-text)]">{finishError}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="lg" disabled={finishing} onClick={onSkip}>
            Start with a blank page
          </Button>
          <Button busy={finishing} variant="coral" size="lg" disabled={finishing} onClick={onContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
