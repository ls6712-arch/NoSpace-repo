import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Check } from "lucide-react";
import { Hobby, hobbies } from "../data/hobbies";
import { spacePhoto } from "../data/hobbyPhotos";
import { GeneratedArt } from "../components/GeneratedArt";
import { MediaAttachPicker } from "../components/MediaAttachPicker";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useContent } from "../context/ContentContext";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

/** Never enforced as a hard ceiling — see SpacePicker's own copy. Just what
 * the helper text suggests as a reasonable starting point. */
const SUGGESTED_SPACE_COUNT = "3–5";
const MOMENT_CAP = 5;

/**
 * The same photo-with-illustrated-fallback resolution HobbyCategoryCard and
 * Discover's own Space cards already use (hobbyPhotos.ts, GeneratedArt) —
 * reused verbatim rather than drawing anything new for this picker.
 */
function SpaceArt({ hobby }: { hobby: Hobby }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : spacePhoto(hobby.slug, 800);
  if (!photo) {
    return <GeneratedArt hobbySlug={hobby.slug} seed={hobby.slug} className="h-full w-full" />;
  }
  return (
    <img
      src={photo}
      alt=""
      loading="lazy"
      onError={() => setPhotoFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

function SpaceOption({
  hobby,
  selected,
  onToggle,
}: {
  hobby: Hobby;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border text-left transition-colors ${
        selected ? "border-[var(--coral-deep)]" : "border-border hover:border-[var(--coral-deep)]/60"
      }`}
    >
      <SpaceArt hobby={hobby} />
      <div className={`absolute inset-0 bg-gradient-to-t ${hobby.gradient} opacity-20 mix-blend-multiply`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/15 to-transparent" />
      {selected && <div className="absolute inset-0 bg-[var(--coral-deep)]/15" aria-hidden="true" />}
      <span
        className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border transition-colors ${
          selected
            ? "border-[var(--coral-deep)] bg-[var(--coral-deep)] text-white"
            : "border-white/60 bg-[var(--void)]/40 text-transparent"
        }`}
        aria-hidden="true"
      >
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-sm leading-tight text-white sm:text-base" style={{ fontFamily: "var(--font-serif)" }}>
          {hobby.shortName}
        </h3>
      </div>
    </button>
  );
}

/**
 * One Space's optional first Moment — the same shape as the quick-capture
 * pattern CircleComposer.tsx already uses (a Textarea, MediaAttachPicker,
 * addPost), stripped down further since onboarding needs none of that
 * composer's Circle-specific fields (visibility/circle/location) either.
 * Locks into a small "Added" confirmation once posted; never re-openable
 * from here — going back to change it is what /create is for afterward.
 */
function MomentCard({
  hobby,
  disabled,
  onAdded,
}: {
  hobby: Hobby;
  disabled: boolean;
  onAdded: () => void;
}) {
  const { addPost } = useContent();
  const { profile } = useAuth();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--coral-deep)] text-white">
          <Check className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
            {hobby.shortName}
          </p>
          <p className="text-xs text-muted-foreground">Added to your Shelf.</p>
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
    try {
      await addPost({
        hobbySlug: hobby.slug,
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
    <div className={`rounded-2xl border border-border bg-card p-4 ${disabled ? "opacity-50" : ""}`}>
      <p className="mb-2 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
        {hobby.shortName}
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Say something about it, or just add the photo (${hobby.shortName.toLowerCase()})`}
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
      {disabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          You've added {MOMENT_CAP} for now. Add more anytime from Create.
        </p>
      )}
    </div>
  );
}

/**
 * Shown once, right after signup — see sql/onboarding-v2.sql and Root.tsx's
 * own guard for exactly when. Step one picks the Spaces the feed should
 * personalize around (writes through toggleHobbyFollow, same persistence
 * every other Space follow in the app already uses); step two is a fully
 * skippable chance to post a first Moment or two before landing anywhere
 * else. Deliberately Space + Moment only — no Corner picking, no copy about
 * Pursuits/Clan/Corner — this is the onboarding path scoped down to exactly
 * those two terms.
 */
export function Onboarding() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/my-space";
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const social = useSocial();
  const { refetchActiveHobbies } = useContent();

  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const toggleSpace = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const goToStep2 = () => {
    for (const slug of selected) {
      const key = `space:${slug}`;
      if (!social.isFollowingHobby(key)) {
        const hobby = hobbies.find((h) => h.slug === slug);
        void social.toggleHobbyFollow(key, hobby?.shortName ?? slug);
      }
    }
    setStep(2);
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      // Picked up by Root.tsx's guard and everywhere else that reads
      // activeHobbySlugs (feed relevance): without this, the follows just
      // written above wouldn't show up here until the next full sign-in.
      await refetchActiveHobbies();
      // This has to actually succeed before leaving. It used to be fired
      // and forgotten, so a failed write (silently, every time, until this
      // was upsert instead of update — see AuthContext's updateProfile) left
      // onboarding_completed still false in the database; navigating away
      // anyway just sent you straight into Root's own guard, which sees the
      // same unfinished profile and bounces you right back to step one.
      const { error } = await updateProfile({ onboarding_completed: true });
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

  const selectedHobbies = hobbies.filter((h) => selected.has(h.slug));
  const capReached = addedCount >= MOMENT_CAP;

  return (
    <div className="min-h-screen bg-background py-10 sm:py-14">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 flex items-center gap-1.5" aria-hidden="true">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-[var(--coral-deep)]" : "bg-border"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="mb-1 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
              What are you into?
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Pick a few. {SUGGESTED_SPACE_COUNT} is a good start, but there's no wrong number. This
              shapes what shows up in My Space.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {hobbies.map((hobby) => (
                <SpaceOption
                  key={hobby.slug}
                  hobby={hobby}
                  selected={selected.has(hobby.slug)}
                  onToggle={() => toggleSpace(hobby.slug)}
                />
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <Button variant="coral" disabled={selected.size === 0} onClick={goToStep2}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mb-1 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
              Post a first Moment?
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Totally optional: a photo, a line about it, or both, for any of the Spaces you picked.
              Skip this if nothing comes to mind yet.
            </p>

            <div className="space-y-3">
              {selectedHobbies.map((hobby) => (
                <MomentCard
                  key={hobby.slug}
                  hobby={hobby}
                  disabled={capReached}
                  onAdded={() => setAddedCount((c) => c + 1)}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-end gap-2">
              {finishError && <p className="text-xs text-[var(--coral-text)]">{finishError}</p>}
              <Button variant="coral" disabled={finishing} onClick={finish}>
                {finishing ? "Finishing…" : addedCount > 0 ? "Finish" : "Skip for now"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
