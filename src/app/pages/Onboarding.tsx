import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { MediaAttachPicker } from "../components/MediaAttachPicker";
import { TagsField } from "../components/TagsField";
import { AvatarPicker } from "../components/AvatarPicker";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useContent } from "../context/ContentContext";
import { useCorners, cornerFollowKey } from "../context/CornersContext";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

const MOMENT_CAP = 5;

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
const SPRING = { type: "spring" as const, stiffness: 260, damping: 28 };

/**
 * One tag's optional first Moment, pre-tagged from step 1's picks — the same
 * lightweight shape as the old per-Space version (a Textarea,
 * MediaAttachPicker, addPost), just keyed by an open tag instead of a fixed
 * Hobby. Locks into a small "Added" confirmation once posted; never
 * re-openable from here — going back to change it is what /create is for
 * afterward.
 */
function MomentCard({
  tag,
  disabled,
  reduceMotion,
  onAdded,
}: {
  tag: string;
  disabled: boolean;
  reduceMotion: boolean;
  onAdded: () => void;
}) {
  const { addPost } = useContent();
  const { profile } = useAuth();
  const { resolveInterest } = useCorners();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [added, setAdded] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  const Chip = reduceMotion ? "span" : motion.span;
  const chipProps = reduceMotion
    ? {}
    : { layout: true, layoutId: `${TAG_LAYOUT_PREFIX}${tag}` };

  if (added) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--coral-deep)] text-white">
          <Check className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
            {tag}
          </p>
          <p className="text-xs text-[var(--ink-soft)]">Added to your Shelf.</p>
        </div>
      </div>
    );
  }

  // A photo says enough on its own — the thought is a nice-to-have next to
  // it, not a second thing required before either can be shared.
  const canSubmit = (!!body.trim() || !!media) && !posting;

  const submit = async () => {
    if (!canSubmit) return;
    setPosting(true);
    setBlockedError(null);
    try {
      // Resolves the tag to a real Corner — an existing one (exact or a
      // near-duplicate match) or a brand-new one, created here the same
      // way tagging-into-existence always has (see CornersContext's
      // resolveInterest). hobbySlug/subHobby are Category/Corner
      // plumbing the schema still requires; the tag itself is what every
      // caption, pill, and label on this Moment actually reads.
      const match = await resolveInterest(tag);
      if (match && "blocked" in match) {
        setBlockedError("Try a more general name, like Brick building.");
        return;
      }
      await addPost({
        hobbySlug: match?.spaceSlug ?? hobbies[0].slug,
        subHobby: match?.slug,
        corner: match?.slug,
        tags: [tag],
        type: media?.type.startsWith("video/") ? "video" : "photo",
        files: media ? [media] : undefined,
        creator: profile?.display_name?.trim() || "You",
        caption: body.trim(),
        visibility: "public",
      });
      setAdded(true);
      onAdded();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 ${disabled ? "opacity-50" : ""}`}
    >
      <Chip
        {...chipProps}
        className="mb-2 inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--ink)]"
      >
        {tag}
      </Chip>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Say something about it, or just add the photo`}
        className="min-h-16"
        maxLength={2000}
        disabled={disabled}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <MediaAttachPicker file={media} onChange={setMedia} label="Add a photo" />
        <Button variant="coral" size="sm" disabled={disabled || !canSubmit} onClick={submit}>
          {posting ? "Adding…" : "Add Moment"}
        </Button>
      </div>
      {blockedError && <p className="mt-2 text-[11px] text-[var(--coral-text)]">{blockedError}</p>}
      {disabled && (
        <p className="mt-2 text-[11px] text-[var(--ink-soft)]">
          You've added {MOMENT_CAP} for now. Add more anytime from Create.
        </p>
      )}
    </div>
  );
}

/**
 * Shown once, right after signup — see sql/onboarding-v2.sql and Root.tsx's
 * own guard for exactly when (both untouched by this rewrite; both correct
 * as-is). Three steps: open tags (replacing the old fixed Space grid), the
 * Studio-style cover itself (replacing the old bio-less flow entirely), and
 * a chance to write a first page or two before landing on the Shelf.
 */
export function Onboarding() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/you";
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const social = useSocial();
  const { refetchActiveHobbies } = useContent();
  const { resolveInterest } = useCorners();
  const reduceMotion = !!useReducedMotion();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tags, setTags] = useState<string[]>([]);

  // Avatar: AvatarPicker persists to profiles.avatar_url the moment a photo
  // is picked — its own established contract, unchanged here. This is just
  // the local mirror every other AvatarPicker call site already keeps.
  const [avatar, setAvatar] = useState<string | undefined>(profile?.avatar_url);

  // Title/tagline/photo: all deferred to finish() below, same as the tags
  // themselves — nothing here writes to profiles until Finish or Skip.
  const [title, setTitle] = useState(profile?.display_name?.trim() ?? "");
  const [titleTouched, setTitleTouched] = useState(false);
  useEffect(() => {
    if (!titleTouched && profile?.display_name) setTitle(profile.display_name);
  }, [profile?.display_name, titleTouched]);

  const [tagline, setTagline] = useState("");
  const [textureIndex, setTextureIndex] = useState(0);

  const [addedCount, setAddedCount] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const goToStep = (next: 1 | 2 | 3) => setStep(next);

  /** A "blank page" cover is still a complete, on-brand one — never a hole
   * where a title or texture should be. */
  const skipCover = () => {
    setTitle(profile?.display_name?.trim() ?? "You");
    setTagline("");
    setTextureIndex(0);
    goToStep(3);
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
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
        cover_title: title.trim() || null,
        // One shared field at onboarding time — bio and cover_tagline can
        // diverge later from Settings or the cover editor, but they start
        // as the same input here rather than asking for both.
        bio: tagline.trim() || null,
        cover_tagline: tagline.trim() || null,
      });
      if (error) {
        setFinishError("Couldn't finish setting up. Try again in a moment.");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setFinishError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setFinishing(false);
    }
  };

  const capReached = addedCount >= MOMENT_CAP;

  const stepDirection = { 1: -1, 2: 0, 3: 1 } as const;
  const slideVariants = {
    enter: (dir: number) => (reduceMotion ? {} : { x: dir >= 0 ? 32 : -32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => (reduceMotion ? {} : { x: dir >= 0 ? -32 : 32, opacity: 0 }),
  };

  return (
    <div className="ns-paper-theme min-h-screen bg-[var(--paper)] py-10 sm:py-14">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 flex items-center gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
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
            {step === 1 && (
              <>
                <h1 className="mb-1 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                  What are you into?
                </h1>
                <p className="mb-6 text-sm text-[var(--ink-soft)]">
                  Add a few tags — anything you like, however specific. There's no fixed list and no
                  wrong number.
                </p>

                <TagsField
                  value={tags}
                  onChange={setTags}
                  placeholder="Pottery, sourdough, bouldering…"
                  chipLayoutIdPrefix={TAG_LAYOUT_PREFIX}
                />

                <div className="mt-8 flex justify-end">
                  <Button variant="coral" onClick={() => goToStep(2)}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
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
                onContinue={() => goToStep(3)}
                onSkip={skipCover}
              />
            )}

            {step === 3 && (
              <>
                <h1 className="mb-1 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Write your first page
                </h1>
                <p className="mb-6 text-sm text-[var(--ink-soft)]">
                  Totally optional: a photo, a line about it, or both, for any of the tags you picked.
                  Skip this if nothing comes to mind yet.
                </p>

                {tags.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--line)] px-5 py-9 text-center text-sm text-[var(--ink-soft)]">
                    No tags picked yet — nothing to pre-fill here. Skip ahead; you can log a Moment
                    anytime from Create.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {tags.map((tag) => (
                      <MomentCard
                        key={tag}
                        tag={tag}
                        disabled={capReached}
                        reduceMotion={reduceMotion}
                        onAdded={() => setAddedCount((c) => c + 1)}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-8 flex flex-col items-end gap-2">
                  {finishError && <p className="text-xs text-[var(--coral-text)]">{finishError}</p>}
                  <Button variant="coral" disabled={finishing} onClick={finish}>
                    {finishing ? "Finishing…" : addedCount > 0 ? "Finish" : "Skip for now"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
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
    <div className="relative overflow-hidden rounded-3xl border border-[var(--line)]">
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
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(42,36,29,0.75) 0%, rgba(42,36,29,0.2) 45%, rgba(42,36,29,0.1) 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <motion.div {...settle(0)} className="mb-4 inline-block rounded-2xl bg-[var(--paper-raised)]/90 p-2.5 backdrop-blur-sm">
            <AvatarPicker compact name={displayName} url={avatar} onChange={onAvatarChange} />
          </motion.div>

          <motion.p {...settle(0.05)} className="mb-1 text-xs uppercase tracking-[0.16em] text-white/70">
            Let's set the scene
          </motion.p>

          <motion.div {...settle(0.1)}>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="w-full max-w-lg border-none bg-transparent text-3xl leading-tight text-white outline-none placeholder:text-white/50 sm:text-5xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            />
          </motion.div>

          <motion.div {...settle(0.15)}>
            <input
              value={tagline}
              onChange={(e) => onTaglineChange(e.target.value)}
              placeholder="What's this about? (optional)"
              maxLength={160}
              className={`mt-2 w-full max-w-md border-b border-dashed bg-transparent text-base italic text-white outline-none placeholder:text-white/60 focus:border-white/70 sm:text-lg ${
                tagline ? "border-transparent" : "border-white/40"
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
                  className="rounded-full border border-white/30 bg-black/20 px-2.5 py-1 text-[11px] text-white/85"
                >
                  {tag}
                </Chip>
              ))}
            </motion.div>
          )}

          <motion.div {...settle(0.25)} className="mt-5">
            <p className="mb-1.5 text-[11px] text-white/70">Background</p>
            <div className="flex gap-2">
              {COVER_TEXTURES.map((texture, i) => (
                <button
                  key={texture.id}
                  type="button"
                  onClick={() => onTextureChange(i)}
                  className="h-12 w-[72px] shrink-0 overflow-hidden rounded"
                  style={{
                    background: texture.css,
                    border: textureIndex === i ? "2px solid var(--coral-deep)" : "1px solid rgba(255,255,255,0.4)",
                  }}
                  aria-label={`Use this background`}
                  aria-pressed={textureIndex === i}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--line)] bg-[var(--paper-raised)] p-4 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={onSkip}>
          Start with a blank page
        </Button>
        <Button variant="coral" size="lg" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
