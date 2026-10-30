import { PaperStamp } from "../components/corners/MomentStamp";
import { formatDate } from "../lib/dates";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router";
import { supabase } from "../../lib/supabase";
import {
  ArrowLeft,
  Camera,
  Check,
  Clock,
  FolderPlus,
  Globe2,
  Images,
  Lock,
  NotebookPen,
  PenLine,
  Plus,
  Sparkle,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { hobbies, subHobbyLabel, findSpaceForInterest, defaultSpaceSlug } from "../data/hobbies";
import { useCategories } from "../context/CategoriesContext";
import { LOCATION_PRIVACY, LocationPrivacy } from "../data/participation";
import { Visibility } from "../data/posts";
import { classifyMomentType } from "../lib/momentType";
import { convertHeicFiles, convertHeicIfNeeded, isHeicFile } from "../lib/heicConversion";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useSettings } from "../context/SettingsContext";
import { useRewards } from "../context/RewardsContext";
import { addProgress, removeProgress, startProject, useJournal } from "../lib/journal";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { attachPostToPursuit, deleteRemoteProgress, mirrorProgress, mirrorPursuit } from "../lib/pursuitsRemote";
import { formatAmount, hasMeasure, stepFor, summarize, targetText, unitFor } from "../lib/pursuitProgress";
import { AmountStepper, SoftPanel, Toggle } from "../components/pursuit/ui";
import { uploadMomentFile } from "../lib/momentMedia";
import { isInFlightSkipped } from "../lib/inFlightGuard";
import { extractFirstUrl } from "../lib/linkPreview";
import {
  draftHasContent,
  MomentDraftFields,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
} from "../lib/draftStore";
import { withFirstFrame } from "../lib/mediaUrl";
import { saveDraftMedia, loadDraftMedia, clearDraftMedia } from "../lib/draftMedia";
import { mirrorDraft, fetchRemoteDraft, clearRemoteDraft } from "../lib/draftRemote";
import { archiveKey } from "../components/HobbyShelf";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { GeneratedArt } from "../components/GeneratedArt";
import { TagsField } from "../components/TagsField";
import { CornerTagField } from "../components/CornerTagField";
import { PursuitField } from "../components/PursuitField";
import { CameraCapture } from "../components/CameraCapture";
import { LinkPreviewCard } from "../components/LinkPreviewCard";
import { ENTER } from "../lib/motion";
import { UPLOAD_COPY } from "../lib/stateCopy";
import { ERROR_LINE } from "../lib/stateCopy";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { BottomSheet } from "../components/ui/BottomSheet";
import { Switch } from "../components/ui/switch";
import { PillButton } from "../components/ui/PillButton";
import { Segmented } from "../components/ui/Segmented";
import { PostedScreen, LOG_PHOTO_LAYOUT_ID, type PostedAudience } from "../components/log/PostedScreen";
import { haptic, shared as sharedSpring, sheet as sheetSpring } from "../lib/motionTokens";
import { withLine } from "../lib/withLine";
import { MAX_CORNER_SUGGESTIONS, type CornerSuggestion, cornersPostedIn, fetchCityCornerCounts, followedCornerKeys, rankCornerSuggestions, topCityCorners } from "../lib/cornerSuggestions";
import { useInterests } from "../lib/interests";
import { Camera as CameraGlyph, ChevronRight } from "lucide-react";

/**
 * Logging (core loop v1, screens 6 and 7):
 *
 *   camera → caption → posted
 *       └──────┘ ("text only" skips the camera)
 *
 * A full-screen sheet that springs up from the + tab. A first visit with
 * nothing yet opens the camera straight away (or a plain "pick a file" screen
 * where a camera cannot work). The caption screen is the form: photo, caption,
 * the Corner it is about, the Pursuit it counts toward, who it is with, and who
 * sees it (Group, Followers, Everyone, Only you). One button posts it. A shared
 * Moment lands on the Posted screen, where a Moment that counts toward a
 * Pursuit shows the Stub it earned; Only you saves a private log and lands on
 * the old Saved screen, as does a post that did not reach the database.
 */
type Screen = "camera" | "caption" | "posted" | "saved";

/** The four audiences, widest privacy first, in the words the app uses everywhere. */
const AUDIENCE: {
  value: Visibility | "private";
  label: string;
  copy: string;
  icon: typeof Globe2;
}[] = [
  { value: "private", label: "Only you", copy: "Only you can see it", icon: Lock },
  { value: "followers", label: "Followers", copy: "People who follow you, once you’ve accepted them", icon: UserRound },
  { value: "public", label: "Everyone", copy: "Anyone can find it", icon: Globe2 },
];

const THOUGHT_LIMIT = 300;
const MAX_PHOTOS = 8;

/**
 * The one hard rule for a Moment's media, applied everywhere a file gets
 * added — the camera screen's initial pick and the caption screen's own
 * "+" add-more tile alike: a video is never mixed with photos, and wins
 * alone if it's anywhere in the new selection. Otherwise photos accumulate
 * in the order picked, capped at MAX_PHOTOS.
 */
function pickFiles(current: File[], incoming: File[]): { files: File[]; type: "photo" | "video" } {
  const video = incoming.find((f) => f.type.startsWith("video"));
  if (video) return { files: [video], type: "video" };
  const currentPhotos = current.filter((f) => !f.type.startsWith("video"));
  return { files: [...currentPhotos, ...incoming].slice(0, MAX_PHOTOS), type: "photo" };
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}

function Shell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  // bare: inside onboarding, whose own page already provides the frame.
  if (bare) return <>{children}</>;
  return (
    <div className="min-h-viewport bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-lg px-4">{children}</div>
    </div>
  );
}

/**
 * The Log sheet: it covers the screen and springs up from the bottom (the
 * `sheet` token; instant under reduced motion). Inside onboarding it stays
 * plain, because that page already provides the frame.
 */
function SheetShell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  if (bare) return <>{children}</>;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={sheetSpring}
      className="ns-afterhours fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background"
    >
      <div className="mx-auto min-h-full max-w-md px-4 pb-32">{children}</div>
    </motion.div>
  );
}

function Preview({
  url,
  type,
  hobbySlug,
  seed,
  className = "",
}: {
  url: string | null;
  type: "photo" | "video";
  hobbySlug: string;
  seed: number;
  className?: string;
}) {
  if (!url) return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
  return type === "video" ? (
    <video src={withFirstFrame(url)} className={`${className} object-cover`} muted playsInline preload="metadata" />
  ) : (
    <ImageWithFallback src={url} alt="" className={`${className}`} />
  );
}

// Copy TBD by product — this placeholder is deliberately easy to find and swap.
const SALE_COMING_SOON_COPY = "Marketplace is coming soon.";

/**
 * "Offer this for sale" used to open a live price/title form with no real
 * commerce behind it (no payments, fees, tax, refunds, or seller identity) —
 * so a published listing looked real but wasn't. Disabled at the point of
 * entry rather than removed: still visible, so it reads as planned rather
 * than gone, but no longer reachable. The underlying forSale state, price
 * field, and addPost plumbing are all untouched below — this only stops the
 * UI from ever setting forSale to true.
 */
function ForSaleComingSoon({ className = "" }: { className?: string }) {
  const [showNotice, setShowNotice] = useState(false);
  return (
    <div className={`rounded-card border border-dashed border-border bg-surface p-4 opacity-60 ${className}`}>
      {/* Not aria-disabled: the control still responds to a tap — it just
          answers with a coming-soon notice instead of the old toggle
          behavior, so it needs to stay a normal, focusable, clickable
          button rather than one assistive tech and automation would both
          treat as truly inert. "Disabled" here is conveyed visually (muted
          colors, a static badge instead of a switch), not by blocking
          interaction outright. */}
      <button
        type="button"
        aria-label="Offer this for sale (coming soon)"
        title={SALE_COMING_SOON_COPY}
        onClick={() => setShowNotice((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-small">Offer this for sale</span>
          <span className="block text-caption text-muted-foreground">
            The physical piece, a digital download, or a course
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-control border border-[var(--hairline)] bg-surface-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
          <Clock className="size-3" />
          Coming soon
        </span>
      </button>
      {showNotice && (
        <p className="mt-3 text-caption leading-relaxed text-muted-foreground">{SALE_COMING_SOON_COPY}</p>
      )}
    </div>
  );
}

export function Log({ onboarding }: { onboarding?: { onDone: () => void } } = {}) {
  const [searchParams] = useSearchParams();
  const { addPost, updatePost, myPosts, deletePost, mediaError, clearMediaError, saveError, clearSaveError } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const { defaultVisibility, defaultVisibilityLoaded } = useSettings();
  const rewards = useRewards();
  const { add: addPrivateLog, remove: removePrivateLog } = usePrivateLogs();
  const journal = useJournal();

  // "Add progress" on a Pursuit links here with ?pursuit=<id> — resolve it
  // before any state so the very first screen can skip the generic capture
  // and "more ways to create" choosers entirely for this entry path, going
  // straight to a Pursuit-scoped menu instead.
  const initialPursuitId = searchParams.get("pursuit") ?? "";
  const initialPursuit = initialPursuitId
    ? journal.projects.find((p) => p.id === initialPursuitId)
    : undefined;
  // "Log a new Moment" from a Space's own Add from my Moments dialog (when the
  // member has no existing Moments to pick from) links here with
  // ?space=<space id>. No Pursuit-style scoped menu for this one — the
  // whole rest of the composer stays exactly as it is; only publish()
  // gains one more side effect once the new post exists.
  const initialSpaceId = searchParams.get("space") ?? "";
  // True only when this visit came from a specific Pursuit's own "Add
  // progress" button — the Space, Corner, and Pursuit are already known,
  // so the detail form's own picker for all three stays hidden too.
  const pursuitScoped = !!initialPursuit;

  // A Pursuit's own "Log a Moment" opens the form directly. There used to
  // be a chooser first ("Add an update" vs "Reflect privately"), but the
  // form already has a private reflection section and an "Only you"
  // audience, so that screen was a step that decided nothing.
  const [screen, setScreen] = useState<Screen>(pursuitScoped || onboarding ? "caption" : "camera");
  // Where the caption screen's Back link returns to — "camera" when a photo
  // or video was actually captured/picked there, "choose" when "Write a
  // moment" skipped the camera entirely. Getting this wrong would mean
  // Back, from a text-only moment, silently re-requesting camera access —
  // exactly the thing this redesign exists to stop doing by default.
  const [captionBackTo, setCaptionBackTo] = useState<"camera">("camera");
  const navigate = useNavigate();

  const hobbyParam = searchParams.get("hobby");
  const initialHobby = hobbyParam ?? initialPursuit?.hobbySlug ?? defaultSpaceSlug();
  const [hobbySlug, setHobbySlug] = useState(initialHobby);
  // Whether hobbySlug reflects something the person actually chose or typed,
  // versus just the untouched default (hobbies[0], or a ?hobby= link). A
  // private "Save this moment" never shows any Space UI at all, so filing it
  // under an unseen default Space silently mistagged private logs — this
  // flag lets that path save untagged instead when nothing was ever set.
  const [spaceSet, setSpaceSet] = useState(!!hobbyParam || !!initialPursuit?.hobbySlug);
  // Admin Space changes load a moment after the app starts. If the untouched
  // default turns out to be a Space the admin has hidden, move to one that
  // isn't — a post should never file itself under a Space nobody can see.
  const { spaceRows } = useCategories();
  useEffect(() => {
    if (spaceSet) return;
    if (hobbies.find((h) => h.slug === hobbySlug)?.hidden) setHobbySlug(defaultSpaceSlug());
  }, [spaceRows, spaceSet, hobbySlug]);
  const [subHobby, setSubHobby] = useState<string>(searchParams.get("sub") ?? initialPursuit?.subHobby ?? "");
  // Independent of subHobby — a Moment can be tagged Woodwork (subHobby,
  // still set above via TagsField's Corner-name matching) and filed under
  // the Gift-making Corner (this) at once.
  //
  // Optional. Set by something the person chose that carries a Corner: the
  // Activity row, a Pursuit (picked in Counts toward, or the one Log was opened
  // from), a Corner's own "create" link (?sub=), or a chip on Posted. Never
  // guessed from tags or the last Moment.
  const [corner, setCorner] = useState<string>(() => {
    if (initialPursuit?.subHobby) return initialPursuit.subHobby;
    return searchParams.get("sub") ?? "";
  });
  const [projectId, setProjectId] = useState<string>(initialPursuitId);
  const [projectTitle, setProjectTitle] = useState("");
  // A Pursuit with a measure (10 loaves, 5 paintings) can take an amount from
  // the same form: how much this Moment moved it forward.
  const selectedProject = journal.projects.find((p) => p.id === projectId);
  const selectedMeasure = selectedProject && hasMeasure(selectedProject) ? selectedProject.measure : undefined;
  const groupPursuit = !!selectedProject && (selectedProject.mode ?? "solo") !== "solo" && !!user;
  const [amount, setAmount] = useState<number>(1);
  const [counts, setCounts] = useState(true);
  useEffect(() => {
    setAmount(selectedMeasure?.defaultAmount ?? 1);
    setCounts(true);
  }, [selectedMeasure?.defaultAmount, projectId]);
  const loggedAmount = selectedMeasure && counts ? amount : 0;
  const [savedProgressLine, setSavedProgressLine] = useState<string | null>(null);
  // The type actually sent to addPost is computed at publish time from
  // whether a file is attached (see publish() below), not read straight
  // from this — this only tracks which of photo/video the picked file(s)
  // were, same as always.
  const [type, setType] = useState<"photo" | "video">("photo");
  // Open, multiple tags — the caption screen's actual "what's this about"
  // now (TagsField), replacing the old single interest field plus its own
  // separate Space picker. Arriving from a Space or Corner's own "create"
  // link (?hobby=/&sub=) still seeds a starting tag the same way it used to
  // seed a starting Space — just as an editable, removable tag now, not a
  // silent default nobody sees. hobbySlug/subHobby (declared above, and
  // still used as-is by the separate "detail" screen's own Space picker for
  // Pursuits) get set from whichever of these tags happens to match a known
  // Corner — see the TagsField onChange below.
  const [tags, setTags] = useState<string[]>(() => {
    if (initialPursuit?.interest) return [initialPursuit.interest];
    const subParam = searchParams.get("sub");
    const subLabel = subParam ? subHobbyLabel(subParam) : undefined;
    if (subLabel) return [subLabel];
    if (hobbyParam) {
      const seeded = hobbies.find((h) => h.slug === hobbyParam);
      if (seeded) return [seeded.name];
    }
    return [];
  });
  // Read-only alias so the many existing "what's this about, in one word"
  // call sites below (the default caption, the Pursuit-attach copy, the
  // confirmation line) don't each need to know tags is now a list.
  const interest = tags[0] ?? "";
  const [thought, setThought] = useState("");
  const [progress, setProgress] = useState("");
  const [changed, setChanged] = useState("");
  // Starts at the account's own default (Settings → Privacy → "Default
  // visibility for new Moments"), "Only you" unless changed there. Falls
  // back to private for the instant before that setting has loaded.
  // Core loop v1: the default is Group when the Moment counts toward a group
  // Pursuit, else Followers (visibility "followers"). A saved default of Everyone
  // is kept; an "Only you" default is not, so a Moment is shared unless the
  // person picks Only you here.
  const initialAudience = (): Visibility | "private" => (defaultVisibilityLoaded && defaultVisibility === "public" ? "public" : "followers");
  const [audience, setAudience] = useState<Visibility | "private">(initialAudience);
  // A Moment is held back from everyone else for 2 hours; this releases it at once.
  const [shareNow, setShareNow] = useState(false);
  /** Posting to the Pursuit's group instead of to followers. Stored as visibility "just_me" with audience "group". */
  const [toGroup, setToGroup] = useState(false);
  // Sticks once the person (or a resumed draft, or "Reflect privately")
  // has actually decided an audience, so the default-visibility setting
  // loading in afterward never overwrites a real choice.
  const audienceDecidedRef = useRef(false);
  const chooseAudience = (v: Visibility | "private") => {
    audienceDecidedRef.current = true;
    setAudience(v);
  };
  useEffect(() => {
    if (audienceDecidedRef.current || !defaultVisibilityLoaded) return;
    setAudience(defaultVisibility === "public" ? "public" : "followers");
  }, [defaultVisibilityLoaded, defaultVisibility]);
  // Group is the default while a group Pursuit is picked, and only offered then.
  useEffect(() => {
    if (!groupPursuit) setToGroup(false);
    else if (!audienceDecidedRef.current) setToGroup(true);
  }, [groupPursuit, projectId]);
  const [rowSheet, setRowSheet] = useState<null | "activity" | "counts" | "details">(null);
  type Circle = "group" | "friends" | "everyone" | "private";
  const circle: Circle = audience === "private" ? "private" : toGroup ? "group" : audience === "public" ? "everyone" : "friends";
  const chooseCircle = (c: Circle) => {
    audienceDecidedRef.current = true;
    setToGroup(c === "group");
    setAudience(c === "private" ? "private" : c === "everyone" ? "public" : "followers");
  };
  const [forSale, setForSale] = useState(false);
  const [saleTitle, setSaleTitle] = useState("");
  const [salePrice, setSalePrice] = useState("25");
  const [saleType, setSaleType] = useState<"physical" | "digital" | "course">("digital");
  const [isActivity, setIsActivity] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  // The Moment's city defaults to the author's own; removing the chip saves no city.
  const [cityRemoved, setCityRemoved] = useState(false);
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>("neighborhood");
  const [savedAs, setSavedAs] = useState<null | "shared" | "private">(null);
  // The just-created Moment's id, for the "Saved." screen's own shared-
  // layout morph into its Shelf-grid styling — see WorkGrid.tsx, which
  // tracks the same layoutId for the real tile.
  const [savedPostId, setSavedPostId] = useState<number | null>(null);
  // What Undo takes back, whichever way in the Moment was saved: the post or
  // private log itself, plus the Pursuit amount logged with it, if any.
  const [undoTarget, setUndoTarget] = useState<null | {
    postId?: number;
    logId?: number;
    progressId?: string;
  }>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  // Two stages on the "Saved." screen: the big composer-style preview,
  // then — a beat later — the same box morphing (via layout/layoutId) into
  // the small square the Shelf grid actually shows it as. Reduced motion
  // skips straight to the settled stage: no morph, no delay.
  const [savedTileSettled, setSavedTileSettled] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (screen !== "saved" || savedAs !== "shared") {
      setSavedTileSettled(false);
      return;
    }
    if (reduceMotion) {
      setSavedTileSettled(true);
      return;
    }
    setSavedTileSettled(false);
    const t = setTimeout(() => setSavedTileSettled(true), 700);
    return () => clearTimeout(t);
  }, [screen, savedAs, reduceMotion]);
  const [seed] = useState(() => Date.now());
  // 1-8 photos, or exactly 1 video — never mixed. See pickFiles below for
  // the one rule that keeps that true everywhere a file gets added.
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when a Private Log's write to Supabase actually failed — the
  // saved screen below needs to tell "it saved" apart from "it didn't,"
  // rather than showing success just because the call finished.
  const [privateSaveError, setPrivateSaveError] = useState<string | null>(null);
  // Set only when convertHeicFiles/convertHeicIfNeeded hands back a file
  // that's still HEIC-shaped — conversion silently failed and, unfixed,
  // that file would go on to become a Moment nobody but a Safari user could
  // ever see (see heicConversion.ts's own comment on why this is worth
  // surfacing rather than swallowing).
  const [heicWarning, setHeicWarning] = useState<string | null>(null);

  // A saved draft found on entry, offered before anything else happens —
  // never auto-loaded, since silently dropping someone into an old draft
  // when they meant to start something new would be its own kind of data
  // loss. Resolved (resumed or discarded) before the camera screen's own
  // autosave effects below are allowed to touch storage.
  const [draftPrompt, setDraftPrompt] = useState<MomentDraftFields | null>(null);
  const [draftPromptMedia, setDraftPromptMedia] = useState<{ file: File; type: "photo" | "video" } | null>(
    null,
  );
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const draftReadyRef = useRef(false);

  const detailFileRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Who posted this always follows the account's display name now — no
  // separate "Posting as" field to fill in or forget to update.

  useEffect(() => {
    if (files.length === 0) {
      setFilePreviewUrls([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setFilePreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // "Add an update" on the camera screen picks a Pursuit and jumps straight
  // into its existing scoped menu below — same URL shape as arriving from
  // that Pursuit's own "Add progress" button, just reached from here
  // instead. React Router doesn't remount this component for a search-param
  // change on the same route, so the initial-screen choice above needs this
  // to actually follow along.
  //
  // pursuitScoped also turns true late: arriving on /create?pursuit=<id> from
  // a link or a new device, the Pursuit is restored from the database a moment
  // after first render. The Pursuit's Corner and name come along then too.
  const pursuitReady = !!initialPursuit;
  useEffect(() => {
    if (!pursuitScoped) return;
    setScreen((s) => (s === "camera" ? "caption" : s));
    setProjectId(initialPursuitId);
    if (initialPursuit?.subHobby) setCorner((c) => c || initialPursuit.subHobby!);
    if (initialPursuit?.interest) setTags((t) => (t.length ? t : [initialPursuit.interest!]));
  }, [initialPursuitId, pursuitReady]);

  // Same reason as the resync above: React Router doesn't remount this
  // component for a search-param change on the same route, so a later
  // navigation to a different ?hobby= link (or a different Pursuit's "Add
  // progress") was silently ignored — hobbySlug stayed frozen at whatever
  // this component last mounted with. Re-reads the exact same priority
  // order the initial value used. spaceSet resets alongside it: a hobby
  // that only arrived because of a stale earlier visit's URL was never
  // actually chosen just now, so a leftover "this was chosen" flag can't
  // survive next to the corrected value.
  useEffect(() => {
    setHobbySlug(hobbyParam ?? initialPursuit?.hobbySlug ?? defaultSpaceSlug());
    setSpaceSet(!!hobbyParam || !!initialPursuit?.hobbySlug);
  }, [hobbyParam, initialPursuit?.hobbySlug]);

  // ── Draft recovery: checked once, on entry, before anything else touches
  // storage. Never applies to a Pursuit-scoped visit — that flow's own
  // "Add progress" menu is a different, already-scoped thing. ─────────────
  useEffect(() => {
    if (pursuitScoped) {
      draftReadyRef.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      const local = loadLocalDraft();
      const remote = user ? await fetchRemoteDraft(user.id) : null;
      if (cancelled) return;
      const winner =
        !local ? remote : !remote ? local : remote.updatedAt > local.updatedAt ? remote : local;
      if (winner && draftHasContent(winner)) {
        const media = await loadDraftMedia();
        if (cancelled) return;
        setDraftPrompt(winner);
        setDraftPromptMedia(media);
      }
      draftReadyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Checked once on mount — a later sign-in shouldn't retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearDraft = () => {
    clearLocalDraft();
    void clearDraftMedia();
    if (user) void clearRemoteDraft(user.id);
  };

  const resumeDraft = () => {
    if (!draftPrompt) return;
    setThought(draftPrompt.thought);
    setHobbySlug(draftPrompt.hobbySlug || defaultSpaceSlug());
    setSubHobby(draftPrompt.subHobby);
    // A draft saved before tags existed only has the old single interest
    // field — recovers as one tag rather than losing it.
    setTags(draftPrompt.tags ?? (draftPrompt.interest ? [draftPrompt.interest] : []));
    setSpaceSet(draftPrompt.spaceSet);
    audienceDecidedRef.current = true;
    setAudience(draftPrompt.audience as Visibility | "private");
    setIsActivity(draftPrompt.isActivity);
    setStartsAt(draftPrompt.startsAt);
    setLocationName(draftPrompt.locationName);
    setLocationPrivacy(draftPrompt.locationPrivacy as LocationPrivacy);
    setProjectId(draftPrompt.projectId);
    setProjectTitle(draftPrompt.projectTitle);
    if (draftPromptMedia) {
      // A resumed draft only ever recovers its first photo (or its video) —
      // see saveDraftMedia below, which only ever persists one file.
      setFiles([draftPromptMedia.file]);
      setType(draftPromptMedia.type);
    }
    setDraftPrompt(null);
    setDraftPromptMedia(null);
    setScreen("caption");
  };

  const discardDraftPrompt = () => {
    clearDraft();
    setDraftPrompt(null);
    setDraftPromptMedia(null);
  };

  // Debounced autosave: caption, audience, Corner/Pursuit, and event fields,
  // a few seconds after the person stops changing them — not on every
  // keystroke. Attached media is saved separately, immediately, below.
  useEffect(() => {
    if (screen !== "caption") return;
    const fields: MomentDraftFields = {
      thought,
      hobbySlug,
      subHobby,
      interest,
      tags,
      spaceSet,
      audience,
      isActivity,
      startsAt,
      locationName,
      locationPrivacy,
      projectId,
      projectTitle,
      mediaType: files.length > 0 ? type : null,
      updatedAt: Date.now(),
    };
    if (!draftHasContent(fields)) return;
    const timer = setTimeout(() => {
      saveLocalDraft(fields);
      if (user) void mirrorDraft(user.id, fields);
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    screen,
    thought,
    hobbySlug,
    subHobby,
    interest,
    tags,
    spaceSet,
    audience,
    isActivity,
    startsAt,
    locationName,
    locationPrivacy,
    projectId,
    projectTitle,
    files,
    type,
    user,
  ]);

  // A capture is already a deliberate, discrete action — no need to debounce
  // saving it the way typed text is. Removing the attached file clears the
  // saved copy too, so an emptied composer doesn't quietly keep an orphaned
  // photo around. Held off until the draft-recovery check above has
  // resolved, so this can't wipe a saved draft's media before it's even
  // been offered.
  useEffect(() => {
    if (!draftReadyRef.current) return;
    // Only the first file is ever persisted here — draft media recovery
    // was never more than a single-file safety net, and a resumed draft
    // reflects that (see resumeDraft above).
    if (files[0]) void saveDraftMedia(files[0], type);
    else void clearDraftMedia();
  }, [files, type]);

  // Exit confirmation: only while the caption screen actually holds
  // something that would be lost — an unused, blank composer never prompts.
  const hasUnsavedChanges =
    screen === "caption" &&
    (thought.trim().length > 0 ||
      files.length > 0 ||
      audienceDecidedRef.current ||
      interest.trim().length > 0 ||
      isActivity ||
      !!projectId ||
      projectTitle.trim().length > 0);

  const blocker = useBlocker(hasUnsavedChanges && !onboarding);

  useEffect(() => {
    if (blocker.state === "blocked") setDiscardPromptOpen(true);
  }, [blocker.state]);

  // Covers what useBlocker can't: an actual tab close or hard reload. The
  // browser shows its own un-customizable prompt here, and if the person
  // goes through with leaving there's no chance to run cleanup code — which
  // is exactly why autosave already ran continuously above, rather than
  // only at the moment of leaving.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const stayInComposer = () => {
    setDiscardPromptOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  };

  const discardAndLeave = () => {
    clearDraft();
    setDiscardPromptOpen(false);
    if (blocker.state === "blocked") blocker.proceed();
  };

  // Rendered from more than one early-return branch below (the caption
  // screen itself, and the "log in to keep this" screen a non-private
  // audience can land on without ever leaving screen === "caption") — a
  // shared element rather than a component, since neither branch needs it
  // to keep any identity across renders. A fast, in-the-moment safety net
  // against an accidental misclick; autosave above is the durable backstop
  // for what this can't catch (an actual tab close, or a crash), where a
  // leftover draft is exactly what makes those recoverable next time. This
  // dialog's own "Discard" is a deliberate choice, so it clears the draft
  // rather than leaving one behind.
  const discardDialog = (
    <Dialog open={discardPromptOpen} onOpenChange={(o) => !o && stayInComposer()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Discard this Moment?</DialogTitle>
          <DialogDescription>Leaving now won’t keep what you’ve added.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={stayInComposer}>
            Keep writing
          </Button>
          <Button variant="destructive" onClick={discardAndLeave}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Normally only open Pursuits are offered here — but if we arrived via
  // "Add progress" on a finished one, it needs to still appear as the
  // selected option (attaching an Update to it reopens it; see
  // attachEntry in lib/journal.ts) rather than showing a blank picker.
  const openProjects = journal.projects.filter(
    (p) => !p.finishedAt || p.id === initialPursuitId,
  );
  // What the post is about, in the person's own words where they gave them —
  // the open tags the person actually typed (TagsField) take priority over
  // the Category, which was never itself a claim about what the Moment is
  // about (and is internal-only now regardless — see cornerLabel below for
  // what's actually shown). `null` (never a Category-flavored guess) when
  // nothing was actually chosen — the callers below fall back to a
  // neutral, honest default instead.
  const tagLabel: string | null =
    tags[0] || interest.trim() || (subHobby ? (subHobbyLabel(subHobby) ?? subHobby) : null);
  // The Corner this Moment is actually filed under — Category never
  // appears in this copy (spec change: "Corners carry discovery"). corner
  // is required now, so this always has a real value by publish time.
  const cornerLabel = subHobbyLabel(corner) ?? corner;

  /** Whatever the camera screen produced — a live capture, a recent pick, or
   * a single fresh library file — always lands here the same way. */
  const handleCaptured = (picked: File, capturedType: "photo" | "video") => {
    setFiles([picked]);
    setType(capturedType);
    setCaptionBackTo("camera");
    setScreen("caption");
  };

  /** A library pick with more than one file selected — routed here instead
   * of handleCaptured, which stays single-file. */
  const handlePickedLibrary = (picked: File[]) => {
    const result = pickFiles([], picked);
    setFiles(result.files);
    setType(result.type);
    setCaptionBackTo("camera");
    setScreen("caption");
  };

  /** Keeps the record without publishing any of it. This is reached two
   * ways — publish()'s own private branch below, and the "Just keep it for
   * myself" button on the signed-out screen further down — so the
   * saving/disabled guard lives here rather than in either caller, and
   * covers both. Without it, a slow photo upload left the Save button
   * looking idle (no disabled state, no "Saving…") for as long as the
   * upload took, and a few taps during that window each ran this whole
   * function again — the exact bug that put a moment's photo into
   * private_logs three times over one upload. */
  const saveAsPrivateLog = async () => {
    const note = [thought.trim(), progress.trim(), changed.trim()]
      .filter(Boolean)
      .join("\n\n");
    if (!note && files.length === 0) return;
    if (saving) return;
    setSaving(true);
    try {
      await saveAsPrivateLogImpl(note);
    } finally {
      setSaving(false);
    }
  };

  const saveAsPrivateLogImpl = async (note: string) => {
    // A project named on the moment screen used to be dropped entirely when
    // you kept the moment private — the name was typed, then silently lost.
    let linkTo = projectId;
    if (!linkTo && projectTitle.trim()) {
      linkTo = startProject({
        title: projectTitle.trim(),
        hobbySlug: spaceSet ? hobbySlug : undefined,
        subHobby: spaceSet ? subHobby || undefined : undefined,
      }).id;
    }

    // The picture is the point of a wordless capture. It used to be dropped
    // here and replaced with a generated placeholder, which read as the app
    // losing the moment you'd just taken. Private logs stay single-image
    // for now, so only the first photo of a multi-photo selection carries over.
    //
    // Step 1: a signed-in owner's photo goes to the private moment-media
    // bucket, same as any other Moment's — filePreviewUrls[0] (an in-tab
    // `blob:` URL) is only ever a display preview, never something that
    // could survive being written to the row and read back later (that was
    // the dead-photo bug docs/private-media-plan.md described). Signed out,
    // there's no durable storage to upload to at all (moment-media's own
    // upload policy requires a real user folder), so the local-only
    // fallback keeps using the blob URL for this tab's session, same as
    // before.
    let media: { path: string; type: "image" | "video"; hobbySlug?: string } | undefined;
    if (files[0]) {
      // Only tag it with a Space the person actually saw and chose (or
      // typed their way into via the interest field) — "Save this moment"
      // from the Your moment screen never shows any Space UI, so filing it
      // under whatever Space happens to be first in the list silently
      // mistagged private logs. Untagged is honest; "Food & Cooking" when
      // nobody chose that is not.
      const mediaHobbySlug = spaceSet ? hobbySlug : undefined;
      const mediaType = type === "video" ? "video" : "image";
      if (user) {
        const { path, error: uploadError } = await uploadMomentFile(user.id, files[0]);
        if (uploadError || !path) {
          setPrivateSaveError("Your photo didn’t upload. Try again.");
          setSavedAs("private");
          setScreen("saved");
          return;
        }
        media = { path, type: mediaType, hobbySlug: mediaHobbySlug };
      } else if (filePreviewUrls[0]) {
        media = { path: filePreviewUrls[0], type: mediaType, hobbySlug: mediaHobbySlug };
      }
    }

    const result = await addPrivateLog({
      note,
      projectId: linkTo || undefined,
      media,
    });
    // A guard-rejected concurrent call, not a failure — the call that's
    // actually in flight is still on track to succeed, so this one leaves
    // the screen alone rather than showing an error or a premature "Saved."
    if (result.skipped) return;

    // An honest failure here matters more than almost anywhere else in this
    // app: a private log has no public copy anywhere to fall back on, so if
    // this didn't actually land, "Saved." would be a straightforward lie
    // about the one thing this feature promises. Still moves to the saved
    // screen either way — same shape as the public-post path below, which
    // shows "Not saved." there rather than staying put.
    if (!result.data) {
      setPrivateSaveError(result.error || "This didn’t save.");
      setSavedAs("private");
      setScreen("saved");
      return;
    }
    setPrivateSaveError(null);
    lastProgressId.current = undefined;
    setSavedProgressLine(recordProgress(undefined, result.data.id, note));
    setUndoTarget({ logId: result.data.id, progressId: lastProgressId.current });
    setUndoError(null);

    // Quiet Milestones count every real Moment, private ones included — this
    // is the only recording call a private log ever reaches, since it never
    // touches ContentContext.addPost (which records shared Moments on its
    // own). Without this, "Private by default" meant most real logging
    // silently never counted toward a milestone at all.
    rewards.recordPostCreated(spaceSet ? subHobby || `space:${hobbySlug}` : undefined);
    // A committed Moment isn't "in progress" anymore — only the top-level
    // camera-first draft this feature tracks, never the Pursuit-scoped
    // "Add progress" flow's own private reflection, which was never this
    // draft to begin with.
    if (!pursuitScoped) clearDraft();
    setSavedAs("private");
    setScreen("saved");
  };

  /** Logs the amount toward the chosen Pursuit's measure and returns the line
   * the saved screen shows ("+1 painting · 3 of 5 paintings"). */
  const lastProgressId = useRef<string | undefined>(undefined);
  const recordProgress = (postId?: number, logId?: number, note?: string): string | null => {
    if (!selectedProject || !selectedMeasure || loggedAmount <= 0) return null;
    const entry = addProgress({
      projectId: selectedProject.id,
      amount: loggedAmount,
      userId: user?.id,
      postId,
      logId,
      note: note || undefined,
    });
    if (user) void mirrorProgress(user.id, entry);
    lastProgressId.current = entry.id;
    const mine = (journal.progress ?? []).filter((e) => e.projectId === selectedProject.id);
    const sum = summarize(selectedMeasure, [...mine, entry]);
    return `+${formatAmount(loggedAmount)} ${unitFor(selectedMeasure, loggedAmount)} · ${formatAmount(sum.current)} of ${targetText(selectedMeasure)}`;
  };

  // Chips for Posted when the Moment has no Corner: Corners you have posted in,
  // then ones you follow, then your city's most-posted this week.
  const social = useSocial();
  const { city: myCity } = useInterests();
  const [cornerChoices, setCornerChoices] = useState<CornerSuggestion[]>([]);
  useEffect(() => {
    if (screen !== "posted" || corner) return;
    let live = true;
    const postedIn = cornersPostedIn(myPosts);
    const followed = followedCornerKeys(social.followedHobbies);
    const rank = (inCity: string[]) => rankCornerSuggestions({ postedIn, followed, inCity });
    setCornerChoices(rank([]));
    // The city list only matters when the first two do not fill three chips.
    if (postedIn.length + followed.length < MAX_CORNER_SUGGESTIONS && myCity) {
      void fetchCityCornerCounts(myCity).then((counts) => live && setCornerChoices(rank(topCityCorners(counts))));
    }
    return () => {
      live = false;
    };
    // Chips are decided once, when Posted appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const publish = async () => {
    if (saving) return;
    if (audience === "private") {
      await saveAsPrivateLog();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // No caption typed means no caption stored (a photo can stand alone).
      const typedCaption = [thought.trim(), progress.trim(), changed.trim()].filter(Boolean).join(". ");
      const caption =
        typedCaption ||
        (loggedAmount > 0 && selectedMeasure && selectedProject
          ? `+${formatAmount(loggedAmount)} ${unitFor(selectedMeasure, loggedAmount)} on ${selectedProject.title}`
          : "");

      // Decided from the actual attached files, not the `type` state (which
      // only ever reflects whichever single pick set it last) — video wins
      // over any photos in the same submission, same rule
      // lib/momentType.ts's own backfill-migration counterpart uses for
      // existing rows. "written" whenever nothing was actually attached,
      // regardless of caption length; the real photo/video type whenever
      // something was, also regardless of caption length. Computed here
      // rather than kept in `type` itself so every entry point ("Write a
      // moment", the camera's own "text only", or picking then removing
      // every file) lands on the same answer without each having to set it.
      const effectiveType = classifyMomentType(files);

      const entry = await addPost({
        hobbySlug,
        subHobby: subHobby || undefined,
        corner: corner || undefined,
        interest: interest.trim() || undefined,
        tags,
        type: effectiveType,
        files: files.length ? files : undefined,
        creator: profile?.display_name?.trim() || "You",
        caption,
        visibility: toGroup ? "just_me" : audience,
        audience: toGroup ? "group" : audience === "public" ? "everyone" : "friends",
        city: circle === "private" || cityRemoved || !myCity.trim() ? null : myCity.trim(),
        shareNow: circle !== "private" && shareNow,
        // Saved with the Pursuit from the start, so the group can read it and the Stub is issued at once.
        pursuitId: projectId || undefined,
        // GUARD (docs/tickets/posts-column-privacy.md): posts.starts_at and posts.location_name
        // are readable by everyone today. Only the existing Activity fields may write them;
        // do not add an exact place or time for a plain Moment until that ticket is done.
        // Log.guard.test.ts fails if this changes.
        startsAt: isActivity && startsAt ? new Date(startsAt).getTime() : undefined,
        locationName: locationName.trim() ? locationName.trim() : undefined,
        locationPrivacy: locationName.trim() ? locationPrivacy : undefined,
        forSale: forSale
          ? {
              name: saleTitle.trim() || caption.slice(0, 40),
              price: Number(salePrice) || 0,
              type: saleType,
            }
          : undefined,
      });
      if (isInFlightSkipped(entry)) return;

      // Create (or attach to) the Pursuit only after the post exists, so a
      // brand-new Pursuit can use this Moment's own photo as its cover —
      // starting the Pursuit first meant it never learned which photo to
      // show, and every new Pursuit fell back to the generic illustration
      // even when a real picture had just been uploaded alongside it.
      // A new Pursuit's name can come from the "Start a Pursuit" mode's own
      // title field or from typing "Create new" in the Pursuit autocomplete
      // elsewhere on this screen — either way, no existing Pursuit was
      // already chosen (linkTo empty) and there's a title to give it.
      let linkTo = projectId;
      if (!linkTo && projectTitle.trim()) {
        linkTo = startProject({
          title: projectTitle.trim(),
          hobbySlug,
          subHobby: subHobby || undefined,
          inspiredByPostId: entry.id,
        }).id;
      }

      if (linkTo) {
        const targetProject = journal.projects.find((p) => p.id === linkTo);
        void attachPostToPursuit(entry.id, linkTo);
        if (targetProject?.finishedAt && user) {
          void mirrorPursuit(user.id, { ...targetProject, finishedAt: undefined });
        }
      }
      // Same direct insert AddMomentToSpaceDialog uses for an existing
      // Moment — space_moments' own "the poster or a host links/unlinks"
      // policy already allows it, no RPC needed. Best-effort: a brand-new
      // Moment is still saved either way even if this side link doesn't
      // land.
      if (initialSpaceId && supabase) {
        void supabase.from("space_moments").insert({ space_id: initialSpaceId, post_id: entry.id });
      }
      lastProgressId.current = undefined;
      setSavedProgressLine(recordProgress(entry.id, undefined, typedCaption));
      setUndoTarget({ postId: entry.id, progressId: lastProgressId.current });
      setUndoError(null);
      if (!pursuitScoped) clearDraft();
      setSavedAs("shared");
      setSavedPostId(entry.id);
      haptic();
      // A post that did not reach the database keeps the honest "Not saved" screen.
      setScreen(entry.unsaved ? "saved" : "posted");
    } catch {
      setError(ERROR_LINE);
    } finally {
      setSaving(false);
    }
  };

  /** Takes back the Moment just saved (and any amount logged with it), then
   * returns to the form with everything still filled in. */
  const undoSave = async () => {
    if (!undoTarget || undoing) return;
    setUndoing(true);
    setUndoError(null);
    try {
      if (undoTarget.postId !== undefined) await deletePost(undoTarget.postId);
      else if (undoTarget.logId !== undefined) await removePrivateLog(undoTarget.logId);
      if (undoTarget.progressId) {
        removeProgress(undoTarget.progressId);
        if (user) void deleteRemoteProgress(undoTarget.progressId);
      }
      setUndoTarget(null);
      setSavedPostId(null);
      setSavedAs(null);
      setSavedProgressLine(null);
      setSavedTileSettled(false);
      setScreen("caption");
    } catch {
      setUndoError(ERROR_LINE);
    } finally {
      setUndoing(false);
    }
  };

  const reset = () => {
    setUndoTarget(null);
    setUndoError(null);
    clearMediaError();
    clearSaveError();
    setPrivateSaveError(null);
    setThought("");
    setProgress("");
    setChanged("");
    setForSale(false);
    setSaleTitle("");
    setTags([]);
    setProjectTitle("");
    setProjectId(pursuitScoped ? initialPursuitId : "");
    setFiles([]);
    setError(null);
    setSavedAs(null);
    setSavedPostId(null);
    setSavedProgressLine(null);
    // Without these, posting an activity with a location and then logging
    // another (plain) Moment right after silently carried both over onto
    // the new post — a pre-existing gap that location being always visible
    // now makes much easier to actually hit.
    setIsActivity(false);
    setStartsAt("");
    setLocationName("");
    setLocationPrivacy("neighborhood");
    setCityRemoved(false);
    setScreen(pursuitScoped ? "caption" : "camera");
    audienceDecidedRef.current = false;
    setToGroup(false);
    setAudience(initialAudience());
    setShareNow(false);
  };

  const requiresLogin =
    isConfigured &&
    !user &&
    screen !== "camera" &&
    screen !== "posted" &&
    audience !== "private";

  // Both of these are declared inside Log(), so they get a new component
  // identity on every render and React remounts their subtree. For Back that
  // costs nothing, but MediaPreview wraps a <video>, which reloads from the
  // start each time — so a captured video restarted on every keystroke while
  // someone typed the caption beside it. useCallback keeps the identity
  // stable between renders that don't change the preview.
  const Back = useCallback(
    ({ to }: { to: Screen }) => <BackLink onClick={() => setScreen(to)} />,
    [],
  );
  const MediaPreview = useCallback(
    ({ className = "" }: { className?: string }) => (
      <Preview
        url={filePreviewUrls[0] ?? null}
        type={type}
        hobbySlug={hobbySlug}
        seed={seed}
        className={className}
      />
    ),
    [filePreviewUrls, type, hobbySlug, seed],
  );

  // The resume-a-draft prompt. Shown on whichever screen is up when a saved draft turns out to exist.
  // Never dismissed by clicking outside: resuming or discarding has to be an
  // actual choice, not a stray tap. Escape resumes, the answer that loses nothing.
  const draftDialog = (
        <Dialog open={!!draftPrompt}>
          <DialogContent
            showCloseButton={false}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              resumeDraft();
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Resume your last draft?</DialogTitle>
              <DialogDescription>
                You started a Moment you didn’t finish.
              </DialogDescription>
            </DialogHeader>
            {draftPrompt && (
              <div className="rounded-card border border-dashed border-border bg-surface p-3.5 text-small text-muted-foreground">
                {draftPrompt.thought.trim() ? (
                  <p className="line-clamp-3 text-foreground" title={draftPrompt.thought.trim()}>“{draftPrompt.thought.trim()}”</p>
                ) : (
                  <p>No caption yet.</p>
                )}
                {draftPrompt.mediaType && !draftPromptMedia && (
                  <p className="mt-2 text-caption">
                    A {draftPrompt.mediaType} was attached on another device and is not available here.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={discardDraftPrompt}>
                Discard
              </Button>
              <Button variant="coral" onClick={resumeDraft}>
                Resume draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );

  // ── 1 · Camera — reached only once "Photo or video" is actually tapped ──
  if (screen === "camera") {
    return (
      <SheetShell bare={!!onboarding}>
        <div className="pt-4">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="mb-4 inline-flex min-h-11 items-center text-body text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <CameraCapture
            onCaptured={handleCaptured}
            onPickedLibrary={handlePickedLibrary}
            onTextOnly={() => {
              setCaptionBackTo("camera");
              setFiles([]);
              setScreen("caption");
            }}
          />
        </div>
        {draftDialog}
        {discardDialog}
      </SheetShell>
    );
  }

  if (requiresLogin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md rounded-card border border-border bg-card p-10 text-center">
          <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full text-on-brand [background-color:var(--coral-deep)]">
            <NotebookPen className="size-7" />
          </span>
          <h2 className="mb-2 text-title">Log in to keep your Moments</h2>
          <p className="mb-6 text-muted-foreground">
            Your Moments are saved to your account and are here next time you log in.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login?redirect=/create">
              <Button variant="coral">Log in or sign up</Button>
            </Link>
            <Button busy={saving} variant="outline" disabled={saving} onClick={saveAsPrivateLog}>
              Keep it private
            </Button>
          </div>
        </div>
        {discardDialog}
      </div>
    );
  }

  // ── 4 · Saved ───────────────────────────────────────────────────────────
  if (screen === "saved") {
    // Two independent write paths land here — the public post path
    // (ContentContext's saveError) and the Private Log path (this
    // component's own privateSaveError) — either one failing means this
    // screen has to say so, not just whichever one happened to be checked.
    const anySaveError = saveError || privateSaveError;
    return (
      <Shell bare={!!onboarding}>
        <div className="rounded-card border border-border bg-card px-6 py-10 text-center">
          <span className="relative mx-auto mb-5 flex size-16 items-center justify-center">
            {/* A small burst, not confetti */}
            <svg
              viewBox="0 0 80 80"
              className="absolute inset-0 size-full text-[var(--yellow)]"
              aria-hidden="true"
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1="40"
                  y1="6"
                  x2="40"
                  y2="14"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 40 40)`}
                />
              ))}
            </svg>
            <span
              className="flex size-12 items-center justify-center rounded-full border-2"
              style={{ borderColor: "var(--yellow)", color: "var(--success)" }}
            >
              {savedAs === "private" ? <Lock className="size-5" /> : <Check className="size-6" />}
            </span>
          </span>

          <h1 className="text-display" style={{ fontFamily: "var(--font-serif)" }}>
            {anySaveError ? "Not saved" : "Saved"}
          </h1>
          <p className="mt-1 text-small text-muted-foreground">
            {interest.trim() ? `${tagLabel} · ${cornerLabel}` : cornerLabel}
          </p>
          {!anySaveError && (
            <p className="mx-auto mt-3 max-w-[16rem] border-t border-[var(--hairline)] pt-3 text-small">
              {savedAs === "private" ? "Only you can see it." : "Moment logged."}
            </p>
          )}

          <PaperStamp title={cornerLabel} date={formatDate(Date.now())} rotate={-3} className="mx-auto my-6 w-fit max-w-[16rem]">
          <motion.div
            layout={!reduceMotion}
            // Same layoutId WorkGrid.tsx gives the real tile — when both are
            // tracked at once, this box hands itself off into position on
            // the Shelf instead of the grid tile just appearing cold.
            layoutId={!reduceMotion && savedPostId ? `moment-${savedPostId}` : undefined}
            // design-token-ignore: spring, not a fixed duration; layout/layoutId are off under reduced motion
            transition={ENTER}
            className={
              savedTileSettled
                ? "w-24 overflow-hidden border border-[var(--hairline)] bg-[var(--cream)]"
                : "w-40 overflow-hidden rounded-card border border-border"
            }
          >
            <MediaPreview className="aspect-square w-full" />
          </motion.div>
          </PaperStamp>
          {savedProgressLine && !anySaveError && (
            <p className="-mt-3 mb-3 text-small tabular-nums">{savedProgressLine}</p>
          )}
          {savedAs === "shared" && !anySaveError && (
            <p
              className={`-mt-3 mb-3 text-caption text-muted-foreground transition-opacity duration-base ${
                savedTileSettled ? "opacity-100" : "opacity-0"
              }`}
            >
              Now on your Shelf.
            </p>
          )}

          {/* An honest failure beats a cheerful lie: the post is on screen but
              only in this tab, and it will be gone after a reload. */}
          {anySaveError && (
            <p className="mx-auto mb-5 max-w-xs rounded-card border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-left text-caption leading-relaxed text-foreground">
              {anySaveError} Nothing you wrote is lost yet. Try again before you
              close this tab.
            </p>
          )}

          {mediaError && (
            <p className="mx-auto mb-5 max-w-xs rounded-card border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-left text-caption leading-relaxed text-foreground">
              {mediaError}
            </p>
          )}

          {undoTarget && !anySaveError && (
            <div
              role="status"
              className="fixed inset-x-4 bottom-20 z-50 mx-auto flex h-12 max-w-sm items-center justify-between rounded-control border border-border bg-card px-4 text-small shadow-overlay"
            >
              <span>{undoError ?? "Saved."}</span>
              <button
                type="button"
                disabled={undoing}
                onClick={() => void undoSave()}
                className="min-h-11 px-2 text-[var(--coral-text)] hover:opacity-80 disabled:opacity-50"
              >
                Undo
              </button>
            </div>
          )}

          <div className="space-y-2">
            {onboarding ? (
              <Button variant="coral" className="w-full" onClick={onboarding.onDone}>
                Continue
              </Button>
            ) : (
              <>
                <Link
                  to={
                    pursuitScoped
                      ? `/pursuit/${initialPursuitId}`
                      : savedAs === "private"
                        ? "/you"
                        : `/you/work/${archiveKey({ subSlug: subHobby || undefined, hobbySlug })}`
                  }
                >
                  <Button variant="coral" className="w-full">
                    Done
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full py-1 text-small text-muted-foreground transition-colors hover:text-foreground"
                >
                  Log another
                </button>
              </>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── 4 · Posted — a shared Moment, with the Stub it earned ──────────────
  if (screen === "posted") {
    const toWhom: PostedAudience = toGroup ? "group" : audience === "public" ? "everyone" : "friends";
    const others = (selectedProject?.members ?? [])
      .filter((m) => m.status === "joined" && m.userId !== user?.id)
      .map((m) => m.displayName);
    const done = selectedProject
      ? (journal.progress ?? []).filter((e) => e.projectId === selectedProject.id && (e.userId ?? user?.id) === user?.id).length
      : 0;
    const cornerInfo = corner ? { spaceSlug: hobbySlug, slug: corner, name: cornerLabel } : undefined;
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <PostedScreen
          postId={savedPostId}
          audience={toWhom}
          corner={cornerInfo}
          pursuit={
            selectedProject
              ? { id: selectedProject.id, done: Math.max(1, done), total: selectedMeasure?.target ?? 0, otherNames: others }
              : undefined
          }
          place={locationName.trim() || undefined}
          cornerChoices={corner ? [] : cornerChoices}
          onAddCorner={async (c) => {
            if (savedPostId == null) return false;
            const ok = await updatePost(savedPostId, { corner: c.slug, subHobby: c.slug, hobbySlug: c.spaceSlug });
            if (ok) {
              setCorner(c.slug);
              setHobbySlug(c.spaceSlug);
              setSpaceSet(true);
            }
            return ok;
          }}
          undo={undoTarget ? { onUndo: () => void undoSave(), busy: undoing, error: undoError } : undefined}
        />
      </div>
    );
  }

  // ── 2 · Caption + audience — one screen, whatever the capture was ────────
  if (screen === "caption") {
    const hasSomething = files.length > 0 || thought.trim().length > 0 || loggedAmount > 0;
    const detectedUrl = extractFirstUrl(thought);
    const doneSoFar = selectedProject
      ? (journal.progress ?? []).filter((e) => e.projectId === selectedProject.id && (e.userId ?? user?.id) === user?.id).length
      : 0;
    const countsValue = selectedProject
      ? selectedMeasure
        ? `${selectedProject.title.slice(0, 40)} · #${doneSoFar + 1}`
        : selectedProject.title.slice(0, 50)
      : projectTitle.trim()
        ? projectTitle.trim().slice(0, 50)
        : "Nothing";
    const withNames = (selectedProject?.members ?? [])
      .filter((m) => m.status === "joined" && m.userId !== user?.id)
      .map((m) => m.displayName.split(" ")[0]);
    const circleOptions = [
      ...(groupPursuit ? [{ value: "group" as const, label: "Group" }] : []),
      { value: "friends" as const, label: "Followers" },
      { value: "everyone" as const, label: "Everyone" },
      { value: "private" as const, label: "Only you" },
    ];
    const rowClass = "flex min-h-14 w-full items-center justify-between gap-3 rounded-card bg-card px-4 py-3 text-left";
    return (
      <SheetShell bare={!!onboarding}>
        <header className="grid grid-cols-[1fr_auto_1fr] items-center py-3">
          {onboarding ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => void navigate(pursuitScoped ? `/pursuit/${initialPursuitId}` : -1 as never)}
              className="inline-flex min-h-11 items-center justify-self-start text-body text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
          <h1 className="text-body font-semibold">Log a Moment</h1>
          <span />
        </header>

        {/* The photo: it grows into the stub on the next screen. A video is always exactly one file. */}
        {files.length > 0 ? (
          <motion.div
            layoutId={LOG_PHOTO_LAYOUT_ID}
            transition={sharedSpring}
            className="relative mb-4 aspect-[4/5] overflow-hidden rounded-card bg-card"
          >
            <MediaPreview className="absolute inset-0 size-full" />
            <button
              type="button"
              onClick={() => setFiles((prev) => (type === "video" ? [] : prev.slice(1)))}
              className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-scrim-solid/80 text-on-media"
              aria-label={type === "video" ? "Remove this video" : "Remove this photo"}
            >
              <X className="size-4" />
            </button>
            {type === "photo" && files.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-full bg-scrim-solid/80 px-4 text-small font-semibold text-on-media"
              >
                Add photo
              </button>
            )}
            {type === "photo" && files.length > 1 && (
              <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center rounded-full bg-scrim-solid/80 px-4 text-small font-semibold text-on-media">
                {`+ ${files.length - 1} more`}
              </span>
            )}
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCaptionBackTo("camera");
              setScreen("camera");
            }}
            className="mb-4 flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-card bg-card text-muted-foreground"
          >
            <CameraGlyph className="size-6" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-small font-semibold">Add a photo</span>
          </button>
        )}
        <input
          ref={addMoreInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const rawPicked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (rawPicked.length === 0) return;
            setHeicWarning(null);
            // Same HEIC normalization as the camera screen's own library pick.
            const converted = await convertHeicFiles(rawPicked);
            const picked = converted.filter((f) => !isHeicFile(f));
            const failedCount = converted.length - picked.length;
            if (failedCount > 0) setHeicWarning(UPLOAD_COPY.heicMany(failedCount));
            if (picked.length === 0) return;
            setFiles(pickFiles(files, picked).files);
          }}
        />

        {heicWarning && (
          <p className="mb-4 rounded-card border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-left text-caption leading-relaxed text-foreground">
            {heicWarning}
          </p>
        )}

        <div className="mb-4">
          <Label htmlFor="thought" className="sr-only">
            Add a thought
          </Label>
          <Textarea
            id="thought"
            value={thought}
            maxLength={THOUGHT_LIMIT}
            onChange={(e) => setThought(e.target.value)}
            placeholder={files.length > 0 ? "Add a thought" : "What happened? Even a sentence counts."}
            className="min-h-24 rounded-card bg-card"
          />
          <div className="mt-1 text-right text-caption text-muted-foreground">
            {thought.length}/{THOUGHT_LIMIT}
          </div>
          {detectedUrl && (
            <div className="mt-2">
              <LinkPreviewCard url={detectedUrl} />
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <button type="button" className={rowClass} onClick={() => setRowSheet("activity")}>
            <span className="text-small text-muted-foreground">Activity</span>
            <span className="flex min-w-0 items-center gap-1 text-body font-semibold">
              <span className="truncate">{corner ? cornerLabel : "Pick one"}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </span>
          </button>
          <button type="button" className={rowClass} onClick={() => setRowSheet("counts")}>
            <span className="text-small text-muted-foreground">Counts toward</span>
            <span className="flex min-w-0 items-center gap-1 text-body font-semibold">
              <span className="truncate">{countsValue}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </span>
          </button>
          {withNames.length > 0 && (
            <div className={rowClass}>
              <span className="text-small text-muted-foreground">With</span>
              <span className="truncate text-body font-semibold">{withLine(withNames).replace(/^With /, "")}</span>
            </div>
          )}
          <button type="button" className={rowClass} onClick={() => setRowSheet("details")}>
            <span className="text-small text-muted-foreground">Details</span>
            <span className="flex min-w-0 items-center gap-1 text-body font-semibold">
              <span className="truncate">{[tags[0], locationName.trim(), isActivity ? "Something happening" : ""].filter(Boolean).join(" · ") || "Add"}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </span>
          </button>
        </div>

        {circle !== "private" && !cityRemoved && myCity.trim() && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setCityRemoved(true)}
              aria-label={`Remove ${myCity.trim()} from this Moment`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-small text-foreground"
            >
              <span className="truncate">{myCity.trim()}</span>
              <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        )}

        <Segmented label="Who sees this" value={circle} onChange={chooseCircle} options={circleOptions} className="mb-2" />
        <p className="mb-4 text-center text-caption text-muted-foreground">
          {circle === "private"
            ? "Only you can see this."
            : circle === "group"
              ? "People in your Pursuit can see this."
              : circle === "everyone"
                ? `Anyone can find this in ${cornerLabel || "Discover"}.`
                : "People who follow you can see this."}
        </p>

        {circle !== "private" && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-card bg-card px-4 py-3">
            <div>
              <Label htmlFor="share-now" className="text-body font-semibold">Share now</Label>
              <p id="share-now-help" className="text-caption text-muted-foreground">Shows this Moment to others right away.</p>
            </div>
            <Switch id="share-now" aria-describedby="share-now-help" checked={shareNow} onCheckedChange={setShareNow} />
          </div>
        )}

        {error && (
          <p role="alert" className="mb-3 text-center text-caption text-accent-text">
            {error}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
          <div className="mx-auto max-w-md px-4 pt-3 pb-[max(1rem,var(--safe-bottom,0px))]">
            <PillButton className="w-full" disabled={!hasSomething || saving} onClick={() => void publish()}>
              {saving ? "One sec…" : circle === "private" ? "Keep it private" : "Post"}
            </PillButton>
          </div>
        </div>

        {/* Activity: the Corner this Moment is filed under. */}
        <BottomSheet open={rowSheet === "activity"} onOpenChange={(o) => !o && setRowSheet(null)} title="Activity" description="Where this shows up when someone browses by Corner.">
          <div className="pt-2">
            <CornerTagField
              spaceSlug={spaceSet ? hobbySlug : undefined}
              value={corner}
              onChange={(slug, _name, resolvedSpaceSlug) => {
                setCorner(slug);
                if (slug) {
                  setHobbySlug(resolvedSpaceSlug);
                  setSpaceSet(true);
                }
              }}
            />
          </div>
        </BottomSheet>

        {/* Counts toward: the Pursuit, and how much it moves it forward. */}
        <BottomSheet open={rowSheet === "counts"} onOpenChange={(o) => !o && setRowSheet(null)} title="Counts toward" description="Keep an ongoing thing together.">
          <div className="flex flex-col gap-4 pt-2">
            <PursuitField
              projects={openProjects}
              projectId={projectId}
              projectTitle={projectTitle}
              onSelectExisting={(id) => {
                setProjectId(id);
                setProjectTitle("");
                const picked = journal.projects.find((p) => p.id === id);
                // Choosing a Pursuit that has a Corner counts as picking that
                // Corner, unless one was already picked on the Activity row.
                if (picked?.subHobby && !corner) {
                  setCorner(picked.subHobby);
                  if (picked.hobbySlug) {
                    setHobbySlug(picked.hobbySlug);
                    setSpaceSet(true);
                  }
                }
              }}
              onCreateNew={(title) => {
                setProjectTitle(title);
                setProjectId("");
              }}
              onClear={() => {
                setProjectId("");
                setProjectTitle("");
              }}
            />
            {selectedMeasure && selectedProject && (
              <SoftPanel>
                <p className="text-small">How much did this move it forward?</p>
                <div className="mt-3">
                  <AmountStepper
                    value={amount}
                    onChange={setAmount}
                    step={stepFor(selectedMeasure)}
                    unit={unitFor(selectedMeasure, amount)}
                    allowDecimals={selectedMeasure.allowDecimals || selectedMeasure.allowPartial}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-caption text-muted-foreground">Count toward Pursuit progress</span>
                  <Toggle checked={counts} onChange={setCounts} label="Count toward Pursuit progress" />
                </div>
              </SoftPanel>
            )}
          </div>
        </BottomSheet>

        {/* Details: tags, something happening, and where. */}
        <BottomSheet open={rowSheet === "details"} onOpenChange={(o) => !o && setRowSheet(null)} title="Details">
          <div className="flex flex-col gap-6 pt-2">
            <div>
              <h2 className="mb-2 text-small">
                <label htmlFor="tags">What is it about?</label>
              </h2>
              <TagsField
                value={tags}
                onChange={(next) => {
                  setTags(next);
                  for (const t of next) {
                    const match = findSpaceForInterest(t);
                    if (match) {
                      setHobbySlug(match.hobbySlug);
                      setSubHobby(match.slug);
                      setSpaceSet(true);
                      break;
                    }
                  }
                }}
              />
            </div>

            <div className="rounded-card bg-card px-4 py-3.5">
              <button
                type="button"
                onClick={() => setIsActivity((v) => !v)}
                aria-pressed={isActivity}
                className="flex w-full min-h-11 items-center justify-between gap-3"
              >
                <span className="text-left">
                  <span className="block text-small">This is something happening</span>
                  <span className="block text-caption text-muted-foreground">A walk, a workshop, a meetup, a challenge: people can join in</span>
                </span>
                <span className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${isActivity ? "justify-end [background-color:var(--violet-electric)]" : "justify-start bg-surface-muted"}`}>
                  <span className="size-5 rounded-full bg-background" />
                </span>
              </button>
              {isActivity && (
                <div className="mt-4">
                  <Label htmlFor="startsAt" className="mb-1.5 block text-caption">
                    When
                  </Label>
                  <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
              )}
            </div>

            <div className="rounded-card bg-card px-4 py-3.5">
              <Label htmlFor="place" className="mb-1.5 block text-caption">
                Where (optional)
              </Label>
              <Input id="place" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Prospect Park, Brooklyn" />
              {locationName.trim() && (
                <div className="mt-3">
                  <Label className="mb-1.5 block text-caption">How precisely to show it</Label>
                  <Select value={locationPrivacy} onValueChange={(v) => setLocationPrivacy(v as LocationPrivacy)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_PRIVACY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}: {o.copy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-caption text-muted-foreground">Neighborhood by default.</p>
                </div>
              )}
            </div>
          </div>
        </BottomSheet>

        {draftDialog}
        {discardDialog}
      </SheetShell>
    );
  }

  return null;
}
