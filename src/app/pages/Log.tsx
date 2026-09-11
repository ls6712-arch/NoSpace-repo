import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router";
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
  Users,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { hobbies, subHobbyLabel, findSpaceForInterest } from "../data/hobbies";
import { LOCATION_PRIVACY, LocationPrivacy } from "../data/participation";
import { Visibility } from "../data/posts";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useRewards } from "../context/RewardsContext";
import { startProject, useJournal } from "../lib/journal";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { attachPostToPursuit, mirrorPursuit } from "../lib/pursuitsRemote";
import { extractFirstUrl } from "../lib/linkPreview";
import {
  draftHasContent,
  MomentDraftFields,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
} from "../lib/draftStore";
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
import { InterestField } from "../components/InterestField";
import { CornerTagField } from "../components/CornerTagField";
import { PursuitField } from "../components/PursuitField";
import { CameraCapture } from "../components/CameraCapture";
import { PursuitDialog } from "../components/PursuitDialog";
import { LinkPreviewCard } from "../components/LinkPreviewCard";

/**
 * Logging, camera-first, matching what every other camera-first app already
 * trained people to expect: a live viewfinder is the front door, not a menu.
 *
 *   camera → caption → saved
 *
 * "Save this moment" and "Share this moment" used to be two competing paths
 * to the same private outcome — the caption screen is one screen now, with
 * one submit button whose label follows the audience picked on it. Starting
 * a Pursuit or adding an update are deliberate, non-quick-capture actions,
 * so they're their own one-tap entry points from the camera screen instead
 * of hiding behind a "more ways to create" menu — Start a Pursuit opens the
 * existing PursuitDialog, and Add an update routes into the existing
 * Pursuit-scoped menu below (?pursuit=<id>), both untouched by this redesign.
 */
type Screen = "camera" | "caption" | "saved" | "detail" | "pursuit-menu";

/** The considered path: four kinds of record, chosen up front. */
type Mode = "project" | "update" | "moment" | "private";

const MODES: { id: Mode; title: string; copy: string; icon: typeof Plus }[] = [
  { id: "project", title: "Start a Pursuit", copy: "Give a new thing a home", icon: Plus },
  { id: "update", title: "Add an update", copy: "Keep an existing Pursuit moving", icon: PenLine },
  { id: "moment", title: "Quick moment", copy: "A photo, win, question, or small discovery", icon: Sparkle },
  { id: "private", title: "Reflect privately", copy: "Keep a note just for you", icon: Lock },
];

/** The four audiences, widest privacy first, in the words the app uses everywhere. */
const AUDIENCE: {
  value: Visibility | "private";
  label: string;
  copy: string;
  icon: typeof Globe2;
}[] = [
  { value: "private", label: "Only you", copy: "Kept as a private log, nobody else ever sees it", icon: Lock },
  { value: "friends", label: "Connections", copy: "Only people you have connected with - both of you agreed", icon: UserRound },
  { value: "circle", label: "A Circle", copy: "Only members of one Circle you pick", icon: Users },
  { value: "public", label: "Everyone", copy: "Anyone browsing this space can find it", icon: Globe2 },
];

const THOUGHT_LIMIT = 300;

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-lg px-4">{children}</div>
    </div>
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
    <video src={url} className={`${className} object-cover`} muted playsInline />
  ) : (
    <img src={url} alt="" className={`${className} object-cover`} />
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
    <div className={`rounded-2xl border border-dashed border-border bg-surface p-4 opacity-60 ${className}`}>
      {/* Not aria-disabled: the control still responds to a tap — it just
          answers with a coming-soon notice instead of the old toggle
          behavior, so it needs to stay a normal, focusable, clickable
          button rather than one assistive tech and automation would both
          treat as truly inert. "Disabled" here is conveyed visually (muted
          colors, a static badge instead of a switch), not by blocking
          interaction outright. */}
      <button
        type="button"
        aria-label="Offer this for sale — coming soon"
        title={SALE_COMING_SOON_COPY}
        onClick={() => setShowNotice((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-sm">Offer this for sale</span>
          <span className="block text-xs text-muted-foreground">
            The physical piece, a digital download, or a course
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Clock className="size-3" />
          Coming soon
        </span>
      </button>
      {showNotice && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{SALE_COMING_SOON_COPY}</p>
      )}
    </div>
  );
}

export function Log() {
  const [searchParams] = useSearchParams();
  const { addPost, mediaError, clearMediaError, saveError, clearSaveError } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const rewards = useRewards();
  const { add: addPrivateLog } = usePrivateLogs();
  const journal = useJournal();

  // "Add progress" on a Pursuit links here with ?pursuit=<id> — resolve it
  // before any state so the very first screen can skip the generic capture
  // and "more ways to create" choosers entirely for this entry path, going
  // straight to a Pursuit-scoped menu instead.
  const initialPursuitId = searchParams.get("pursuit") ?? "";
  const initialPursuit = initialPursuitId
    ? journal.projects.find((p) => p.id === initialPursuitId)
    : undefined;
  // True only when this visit came from a specific Pursuit's own "Add
  // progress" button — the Space, Corner, and Pursuit are already known,
  // so the detail form's own picker for all three stays hidden too.
  const pursuitScoped = !!initialPursuit;

  const [screen, setScreen] = useState<Screen>(pursuitScoped ? "pursuit-menu" : "camera");
  const [mode, setMode] = useState<Mode | null>(null);
  const [pursuitDialogOpen, setPursuitDialogOpen] = useState(false);
  const navigate = useNavigate();

  const hobbyParam = searchParams.get("hobby");
  const initialHobby = hobbyParam ?? initialPursuit?.hobbySlug ?? hobbies[0].slug;
  const [hobbySlug, setHobbySlug] = useState(initialHobby);
  // Whether hobbySlug reflects something the person actually chose or typed,
  // versus just the untouched default (hobbies[0], or a ?hobby= link). A
  // private "Save this moment" never shows any Space UI at all, so filing it
  // under an unseen default Space silently mistagged private logs — this
  // flag lets that path save untagged instead when nothing was ever set.
  const [spaceSet, setSpaceSet] = useState(!!hobbyParam || !!initialPursuit?.hobbySlug);
  const [subHobby, setSubHobby] = useState<string>(searchParams.get("sub") ?? initialPursuit?.subHobby ?? "");
  const [projectId, setProjectId] = useState<string>(initialPursuitId);
  const [projectTitle, setProjectTitle] = useState("");
  const [type, setType] = useState<"photo" | "video">("photo");
  const [interest, setInterest] = useState(initialPursuit?.interest ?? "");
  // A Space is a place to put something, not a gate in front of making it.
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [thought, setThought] = useState("");
  const [progress, setProgress] = useState("");
  const [changed, setChanged] = useState("");
  const [reflection, setReflection] = useState("");
  // Private by default — matches the product's "Private by default"
  // positioning: hitting Share without ever touching this selector must
  // actually save privately, not just show "Only you" pre-highlighted.
  const [audience, setAudience] = useState<Visibility | "private">("private");
  const [circleId, setCircleId] = useState<number | undefined>(undefined);
  const [forSale, setForSale] = useState(false);
  const [saleTitle, setSaleTitle] = useState("");
  const [salePrice, setSalePrice] = useState("25");
  const [saleType, setSaleType] = useState<"physical" | "digital" | "course">("digital");
  const [isActivity, setIsActivity] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>("neighborhood");
  const [savedAs, setSavedAs] = useState<null | "shared" | "private">(null);
  const [seed] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when a Private Log's write to Supabase actually failed — the
  // saved screen below needs to tell "it saved" apart from "it didn't,"
  // rather than showing success just because the call finished.
  const [privateSaveError, setPrivateSaveError] = useState<string | null>(null);

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

  // Who posted this always follows the account's display name now — no
  // separate "Posting as" field to fill in or forget to update.

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // "Add an update" on the camera screen picks a Pursuit and jumps straight
  // into its existing scoped menu below — same URL shape as arriving from
  // that Pursuit's own "Add progress" button, just reached from here
  // instead. React Router doesn't remount this component for a search-param
  // change on the same route, so the initial-screen choice above needs this
  // to actually follow along.
  useEffect(() => {
    if (pursuitScoped) setScreen("pursuit-menu");
  }, [initialPursuitId]);

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
    setHobbySlug(hobbyParam ?? initialPursuit?.hobbySlug ?? hobbies[0].slug);
    setSpaceSet(!!hobbyParam || !!initialPursuit?.hobbySlug);
  }, [hobbyParam, initialPursuit?.hobbySlug]);

  // Picking the dedicated "Reflect privately" mode still forces the
  // audience to private (so a person who'd already changed it can't end up
  // on that screen sharing by accident). It used to also do the reverse —
  // bounce audience back to "friends" the moment any other mode was picked
  // — which made sense back when "friends" was the initial default, but
  // now silently overwrote the new private default the instant a mode was
  // chosen. Audience should only ever change here, or by the person's own
  // click on the selector below.
  useEffect(() => {
    if (mode === "private") setAudience("private");
  }, [mode]);

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
    setHobbySlug(draftPrompt.hobbySlug || hobbies[0].slug);
    setSubHobby(draftPrompt.subHobby);
    setInterest(draftPrompt.interest);
    setSpaceSet(draftPrompt.spaceSet);
    setAudience(draftPrompt.audience as Visibility | "private");
    setCircleId(draftPrompt.circleId);
    setIsActivity(draftPrompt.isActivity);
    setStartsAt(draftPrompt.startsAt);
    setLocationName(draftPrompt.locationName);
    setLocationPrivacy(draftPrompt.locationPrivacy as LocationPrivacy);
    setProjectId(draftPrompt.projectId);
    setProjectTitle(draftPrompt.projectTitle);
    if (draftPromptMedia) {
      setFile(draftPromptMedia.file);
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
      spaceSet,
      audience,
      circleId,
      isActivity,
      startsAt,
      locationName,
      locationPrivacy,
      projectId,
      projectTitle,
      mediaType: file ? type : null,
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
    spaceSet,
    audience,
    circleId,
    isActivity,
    startsAt,
    locationName,
    locationPrivacy,
    projectId,
    projectTitle,
    file,
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
    if (file) void saveDraftMedia(file, type);
    else void clearDraftMedia();
  }, [file, type]);

  // Exit confirmation: only while the caption screen actually holds
  // something that would be lost — an unused, blank composer never prompts.
  const hasUnsavedChanges =
    screen === "caption" &&
    (thought.trim().length > 0 ||
      !!file ||
      audience !== "private" ||
      interest.trim().length > 0 ||
      isActivity ||
      !!projectId ||
      projectTitle.trim().length > 0);

  const blocker = useBlocker(hasUnsavedChanges);

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
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Discard this moment?</DialogTitle>
          <DialogDescription>Leaving now won't keep what you've added.</DialogDescription>
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

  const hobby = hobbies.find((h) => h.slug === hobbySlug)!;
  const hobbyCircles = circlesByHobby(hobbySlug);
  // Normally only open Pursuits are offered here — but if we arrived via
  // "Add progress" on a finished one, it needs to still appear as the
  // selected option (attaching an Update to it reopens it; see
  // attachEntry in lib/journal.ts) rather than showing a blank picker.
  const openProjects = journal.projects.filter(
    (p) => !p.finishedAt || p.id === initialPursuitId,
  );
  // What the post is about, in the person's own words where they gave them.
  const tagLabel =
    interest.trim() ||
    (subHobby ? (subHobbyLabel(subHobby) ?? subHobby) : hobby.shortName);

  /** Whatever the camera screen produced — a live capture, a recent pick, or
   * a fresh library file — always lands here the same way. */
  const handleCaptured = (picked: File, capturedType: "photo" | "video") => {
    setFile(picked);
    setType(capturedType);
    setScreen("caption");
  };

  /** Keeps the record without publishing any of it. */
  const saveAsPrivateLog = async () => {
    const note = [thought.trim(), progress.trim(), changed.trim(), reflection.trim()]
      .filter(Boolean)
      .join("\n\n");
    if (!note && !file) return;
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
    const result = await addPrivateLog({
      note: note || `A ${tagLabel.toLowerCase()} moment`,
      projectId: linkTo || undefined,
      // The picture is the point of a wordless capture. It used to be dropped
      // here and replaced with a generated placeholder, which read as the app
      // losing the moment you'd just taken.
      media: filePreviewUrl
        ? {
            url: filePreviewUrl,
            type: type === "video" ? "video" : "image",
            // Only tag it with a Space the person actually saw and chose (or
            // typed their way into via the interest field) — "Save this
            // moment" from the Your moment screen never shows any Space UI,
            // so filing it under whatever Space happens to be first in the
            // list silently mistagged private logs. Untagged is honest;
            // "Food & Cooking" when nobody chose that is not.
            hobbySlug: spaceSet ? hobbySlug : undefined,
          }
        : undefined,
    });

    // An honest failure here matters more than almost anywhere else in this
    // app: a private log has no public copy anywhere to fall back on, so if
    // this didn't actually land, "Saved." would be a straightforward lie
    // about the one thing this feature promises. Still moves to the saved
    // screen either way — same shape as the public-post path below, which
    // shows "Not saved." there rather than staying put.
    if (!result.data) {
      setPrivateSaveError(result.error || "This didn't save.");
      setSavedAs("private");
      setScreen("saved");
      return;
    }
    setPrivateSaveError(null);

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

  const publish = async () => {
    if (saving) return;
    if (audience === "private") {
      await saveAsPrivateLog();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const caption =
        [thought.trim(), progress.trim(), changed.trim()].filter(Boolean).join(". ") ||
        `A ${tagLabel.toLowerCase()} moment`;

      const entry = await addPost({
        hobbySlug,
        subHobby: subHobby || undefined,
        interest: interest.trim() || undefined,
        type,
        file: file ?? undefined,
        creator: profile?.display_name?.trim() || "You",
        caption,
        reflection: reflection.trim() || undefined,
        visibility: audience,
        circleId: audience === "circle" ? circleId : undefined,
        startsAt: isActivity && startsAt ? new Date(startsAt).getTime() : undefined,
        locationName: isActivity && locationName.trim() ? locationName.trim() : undefined,
        locationPrivacy: isActivity ? locationPrivacy : undefined,
        forSale: forSale
          ? {
              name: saleTitle.trim() || caption.slice(0, 40),
              price: Number(salePrice) || 0,
              type: saleType,
            }
          : undefined,
      });

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
      if (!pursuitScoped) clearDraft();
      setSavedAs("shared");
      setScreen("saved");
    } catch {
      setError("Something went wrong saving that. Mind trying again?");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    clearMediaError();
    clearSaveError();
    setPrivateSaveError(null);
    setThought("");
    setProgress("");
    setChanged("");
    setReflection("");
    setForSale(false);
    setSaleTitle("");
    setInterest("");
    setSpaceOpen(false);
    setProjectTitle("");
    setProjectId("");
    setCircleId(undefined);
    setFile(null);
    setError(null);
    setSavedAs(null);
    setMode(null);
    setScreen("camera");
  };

  const requiresLogin =
    isConfigured && !user && screen !== "camera" && audience !== "private" && mode !== "private";

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
        url={filePreviewUrl}
        type={type}
        hobbySlug={hobbySlug}
        seed={seed}
        className={className}
      />
    ),
    [filePreviewUrl, type, hobbySlug, seed],
  );

  // ── 1 · Camera ──────────────────────────────────────────────────────────
  if (screen === "camera") {
    return (
      <Shell>
        <CameraCapture
          onCaptured={handleCaptured}
          onTextOnly={() => {
            setFile(null);
            setScreen("caption");
          }}
          onStartPursuit={() => setPursuitDialogOpen(true)}
          onAddUpdate={(id) => navigate(`/create?pursuit=${id}`)}
          openProjects={openProjects}
        />
        <PursuitDialog open={pursuitDialogOpen} onOpenChange={setPursuitDialogOpen} />

        {/* Never dismissed by clicking outside or Escape — resuming or
            discarding has to be an actual choice, not an accidental
            dismissal that quietly leaves an old draft sitting around. */}
        <Dialog open={!!draftPrompt}>
          <DialogContent
            showCloseButton={false}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Resume your last draft?</DialogTitle>
              <DialogDescription>
                You started a Moment you didn't finish.
              </DialogDescription>
            </DialogHeader>
            {draftPrompt && (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-3.5 text-sm text-muted-foreground">
                {draftPrompt.thought.trim() ? (
                  <p className="line-clamp-3 text-foreground">"{draftPrompt.thought.trim()}"</p>
                ) : (
                  <p>No caption yet.</p>
                )}
                {draftPrompt.mediaType && !draftPromptMedia && (
                  <p className="mt-2 text-xs">
                    A {draftPrompt.mediaType} was attached on another device — not available here.
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
      </Shell>
    );
  }

  // ── Pursuit-scoped menu: reached only via a Pursuit's own "Add progress"
  // button, entirely bypassing Capture and "More ways to create" — the
  // Pursuit is already known, so the only real choice left is whether this
  // is visible or private. ─────────────────────────────────────────────────
  if (screen === "pursuit-menu" && initialPursuit) {
    return (
      <Shell>
        <Link
          to={`/pursuit/${initialPursuit.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          Add progress
        </h1>
        <p className="mt-1.5 text-muted-foreground">{initialPursuit.title}</p>

        <ul className="mt-8 space-y-3">
          <li>
            <button
              type="button"
              onClick={() => {
                setMode("update");
                setScreen("detail");
              }}
              className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] hover:shadow-[0_14px_28px_-18px_rgba(11,62,46,0.5)]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground transition-colors group-hover:bg-[var(--coral-deep)] group-hover:text-white">
                <PenLine className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base" style={{ fontFamily: "var(--font-serif)" }}>
                  Add an update
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  A photo, video, or note — shown per whatever audience you pick.
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMode("private");
                setScreen("detail");
              }}
              className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] hover:shadow-[0_14px_28px_-18px_rgba(11,62,46,0.5)]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground transition-colors group-hover:bg-[var(--coral-deep)] group-hover:text-white">
                <Lock className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base" style={{ fontFamily: "var(--font-serif)" }}>
                  Reflect privately
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  Only you will ever see this note, not shown to anyone else viewing this Pursuit.
                </span>
              </span>
            </button>
          </li>
        </ul>
      </Shell>
    );
  }

  if (requiresLogin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center">
          <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full text-white [background-color:var(--coral-deep)]">
            <NotebookPen className="size-7" />
          </span>
          <h2 className="mb-2 text-2xl">Log in to keep your work</h2>
          <p className="mb-6 text-muted-foreground">
            Your moments are tied to your account, so they're still here next
            time, not just in this browser tab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login?redirect=/create">
              <Button variant="coral">Log in or sign up</Button>
            </Link>
            <Button variant="outline" onClick={saveAsPrivateLog}>
              Just keep it for myself
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
      <Shell>
        <div className="rounded-3xl border border-border bg-card px-6 py-10 text-center">
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

          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            {anySaveError ? "Not saved." : "Saved."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {interest.trim() ? `${tagLabel} · ${hobby.name}` : hobby.name}
          </p>
          {!anySaveError && (
            <p className="mx-auto mt-3 max-w-[16rem] border-t border-[var(--hairline)] pt-3 text-sm">
              {savedAs === "private" ? "Kept just for you." : "Another one made."}
            </p>
          )}

          <div className="mx-auto my-6 w-40 overflow-hidden rounded-xl border border-border">
            <MediaPreview className="aspect-square w-full" />
          </div>

          {/* An honest failure beats a cheerful lie: the post is on screen but
              only in this tab, and it will be gone after a reload. */}
          {anySaveError && (
            <p className="mx-auto mb-5 max-w-xs rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-left text-xs leading-relaxed text-foreground">
              {anySaveError} Nothing you wrote is lost yet. Try again before you
              close this tab.
            </p>
          )}

          {mediaError && (
            <p className="mx-auto mb-5 max-w-xs rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-left text-xs leading-relaxed text-foreground">
              {mediaError}
            </p>
          )}

          <div className="space-y-2">
            <Link
              to={
                savedAs === "private"
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
              className="w-full py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Create another
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── 2 · Caption + audience — one screen, whatever the capture was ────────
  if (screen === "caption") {
    const hasSomething = !!file || thought.trim().length > 0;
    const detectedUrl = extractFirstUrl(thought);
    return (
      <Shell>
        <Back to="camera" />
        <h1 className="mb-6 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          Your moment
        </h1>

        {file && (
          <div className="relative mb-4 overflow-hidden rounded-2xl border border-border">
            <MediaPreview className="aspect-[4/3] w-full" />
            <button
              type="button"
              onClick={() => setFile(null)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[var(--void)]/65 text-white"
              aria-label="Remove this photo"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="mb-6">
          <Label htmlFor="thought" className="sr-only">
            Add a thought
          </Label>
          <Textarea
            id="thought"
            value={thought}
            maxLength={THOUGHT_LIMIT}
            onChange={(e) => setThought(e.target.value)}
            placeholder={file ? "Add a thought…" : "What happened? Even a sentence counts."}
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">
            {thought.length}/{THOUGHT_LIMIT}
          </div>
          {/* Passive detection: no "add a link" field to fill out on
              purpose. Typing or pasting a URL is enough. */}
          {detectedUrl && (
            <div className="mt-2">
              <LinkPreviewCard url={detectedUrl} />
            </div>
          )}
        </div>

        {/* Everything below used to live inside a collapsed "Share this
            moment" accordion behind its own "Save this moment" alternative
            — one screen now, always expanded, one outcome decided by the
            audience picked below rather than by which button was tapped. */}
        <div className="mb-6 space-y-6">
          {/* One merged field: typing a known hobby ("Pottery") tags the
              Moment AND sets its Space in one step, instead of asking
              "what's this about" and "which Space" separately. Picking
              something that isn't a recognized hobby just leaves the Space
              on its default — nothing here blocks posting. */}
          <div>
            <h2 className="mb-2 text-sm">
              <label htmlFor="interest">What is it about?</label>
            </h2>
            <InterestField
              value={interest}
              onChange={(next) => {
                setInterest(next);
                const match = findSpaceForInterest(next);
                if (match) {
                  setHobbySlug(match.hobbySlug);
                  setSubHobby(match.slug);
                  setSpaceSet(true);
                }
              }}
              placeholder="Search or type a hobby or interest..."
            />
            {!spaceOpen ? (
              <button
                type="button"
                onClick={() => setSpaceOpen(true)}
                className="mt-1.5 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                In {hobby.name} · change
              </button>
            ) : (
              <div className="mt-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm">Choose a Space</span>
                  <button
                    type="button"
                    onClick={() => setSpaceOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Done
                  </button>
                </div>
                <Select
                  value={hobbySlug}
                  onValueChange={(v) => {
                    setHobbySlug(v);
                    setSubHobby("");
                    setCircleId(undefined);
                    setSpaceSet(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Space…" />
                  </SelectTrigger>
                  <SelectContent>
                    {hobbies.map((h) => (
                      <SelectItem key={h.slug} value={h.slug}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {hobby.plainLabel}: {hobby.tagline.toLowerCase()}
                </p>
              </div>
            )}
          </div>

          {/* Only a thing that happens at a time needs a time. */}
          <div className="rounded-2xl border border-border bg-surface px-4 py-3.5">
            <button
              type="button"
              onClick={() => setIsActivity((v) => !v)}
              aria-pressed={isActivity}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="text-left">
                <span className="block text-sm">This is something happening</span>
                <span className="block text-xs text-muted-foreground">
                  A walk, a workshop, a meetup, a challenge: people can join in
                </span>
              </span>
              <span
                className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                  isActivity
                    ? "justify-end [background-color:var(--violet-electric)]"
                    : "justify-start bg-surface-muted"
                }`}
              >
                <span className="size-5 rounded-full bg-white" />
              </span>
            </button>

            {isActivity && (
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="startsAt" className="mb-1.5 block text-xs">
                    When
                  </Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="place" className="mb-1.5 block text-xs">
                    Where
                  </Label>
                  <Input
                    id="place"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g. Prospect Park, Brooklyn"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">How precisely to show it</Label>
                  <Select
                    value={locationPrivacy}
                    onValueChange={(v) => setLocationPrivacy(v as LocationPrivacy)}
                  >
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
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Neighborhood by default. Exact is never assumed.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm">Choose who sees this</h2>
            <ul className="space-y-2">
              {AUDIENCE.map((opt) => {
                const active = audience === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setAudience(opt.value);
                        if (opt.value !== "circle") setCircleId(undefined);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-[var(--coral-deep)] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface-elevated))]"
                          : "border-border bg-surface hover:border-[var(--foreground)]/30"
                      }`}
                    >
                      <opt.icon className="size-4 shrink-0 text-foreground" />
                      <span className="min-w-0 flex-1 text-sm">{opt.label}</span>
                      {active && <Check className="size-4 shrink-0 text-[var(--coral-deep)]" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {audience === "circle" && (
              <div className="mt-3">
                {hobbyCircles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No Circles exist for this space yet.
                  </p>
                ) : (
                  <Select
                    value={circleId ? String(circleId) : undefined}
                    onValueChange={(v) => setCircleId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a Circle" />
                    </SelectTrigger>
                    <SelectContent>
                      {hobbyCircles.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                          {c.location ? ` · ${c.location}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Only a public Moment could become a listing — Connections and
                Circle audiences couldn't be sold to anyway, same rule the
                Pursuit-scoped flow's own version of this control uses. */}
            {audience === "public" && <ForSaleComingSoon className="mt-3" />}

            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              {audience === "private"
                ? "This stays a private log. Nobody else will see it."
                : `This will appear in ${
                    audience === "public"
                      ? `${hobby.name}`
                      : audience === "circle"
                        ? "that Circle"
                        : "My Space for people you've connected with"
                  }${interest.trim() ? ` and be tagged ${tagLabel}.` : "."}`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <FolderPlus className="size-4 shrink-0 text-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">Add to a Pursuit</span>
                <span className="block text-xs text-muted-foreground">
                  Keep an ongoing thing together.
                </span>
              </span>
            </div>
            <div className="mt-3">
              <PursuitField
                projects={openProjects}
                projectId={projectId}
                projectTitle={projectTitle}
                onSelectExisting={(id) => {
                  setProjectId(id);
                  setProjectTitle("");
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
            </div>
          </div>
        </div>

        {error && <p className="mb-3 text-center text-xs text-[var(--coral-text)]">{error}</p>}

        {/* One button, one outcome, decided by the audience above — not a
            separate "Save this moment" that produced the same private
            result as "Share this moment → Only you". */}
        <Button
          variant="coral"
          size="lg"
          className="w-full"
          disabled={!hasSomething || saving || (audience === "circle" && !circleId)}
          onClick={publish}
        >
          {saving ? "Saving…" : audience === "private" ? "Keep it private" : "Share"}
        </Button>

        {!hasSomething && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Add a photo, video, or a line of text to continue.
          </p>
        )}

        {discardDialog}
      </Shell>
    );
  }


  // ── The considered form, reached from "More ways to create" or "Add details" ─
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[2];
  const isPrivateOnly = mode === "private";

  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-2xl px-4">
        <Back to={pursuitScoped ? "pursuit-menu" : "camera"} />

        <h1 className="mb-2 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          {activeMode.title}
        </h1>
        <p className="mb-9 text-muted-foreground">
          {pursuitScoped ? initialPursuit!.title : activeMode.copy}
        </p>

        <div className="space-y-7 rounded-3xl border border-border bg-card p-6 md:p-8">
          {!isPrivateOnly && (
            <>
              {!pursuitScoped && (
                <section>
                  <h2 className="mb-1 text-sm">What are you working on?</h2>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {mode === "update"
                      ? "Choose the Pursuit this belongs to."
                      : mode === "project"
                        ? "Give it a name you'll recognise in six months."
                        : "Where does this sit?"}
                  </p>

                  {mode === "update" ? (
                    <PursuitField
                      projects={openProjects}
                      projectId={projectId}
                      projectTitle={projectTitle}
                      onSelectExisting={(id) => {
                        setProjectId(id);
                        setProjectTitle("");
                      }}
                      onCreateNew={(title) => {
                        setProjectTitle(title);
                        setProjectId("");
                      }}
                      onClear={() => {
                        setProjectId("");
                        setProjectTitle("");
                      }}
                      placeholder="Choose a Pursuit"
                    />
                  ) : (
                    mode === "project" && (
                      <Input
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        placeholder="e.g. Six matching mugs"
                      />
                    )
                  )}

                  <div className="mt-3">
                    <Label className="mb-2 block text-xs">Space</Label>
                    <Select
                      value={hobbySlug}
                      onValueChange={(v) => {
                        setHobbySlug(v);
                        setCircleId(undefined);
                        setSubHobby("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hobbies.map((h) => (
                          <SelectItem key={h.slug} value={h.slug}>
                            {h.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-3">
                    <CornerTagField
                      spaceSlug={hobbySlug}
                      value={subHobby}
                      onChange={(slug) => setSubHobby(slug)}
                    />
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-1 text-sm">Show your progress</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Add a photo, video, or short note.
                </p>

                <div className="mb-3 flex items-center gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border">
                    <MediaPreview className="h-full w-full" />
                    {file && (
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[var(--void)]/70 text-white"
                        aria-label="Remove file"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                  <div>
                    <input
                      ref={detailFileRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const picked = e.target.files?.[0];
                        if (!picked) return;
                        setFile(picked);
                        setType(picked.type.startsWith("video") ? "video" : "photo");
                      }}
                    />
                    <div className="mb-2 flex gap-2">
                      <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {type === "video" ? (
                          <Video className="size-3.5" />
                        ) : (
                          <Camera className="size-3.5" />
                        )}
                        {type === "video" ? "Video" : "Photo"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => detailFileRef.current?.click()}
                    >
                      <Images className="size-3.5" />
                      {file ? "Choose a different file" : "Add a photo or video"}
                    </Button>
                  </div>
                </div>

                <Textarea
                  id="progress"
                  placeholder="Where it's at right now"
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                />
              </section>

              <section>
                <h2 className="mb-1 text-sm">What changed?</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  A small win, a lesson, a question, or what comes next.
                </p>
                <Textarea
                  id="changed"
                  placeholder="Centred it on the third try, next time, wetter hands"
                  value={changed}
                  onChange={(e) => setChanged(e.target.value)}
                />
              </section>
            </>
          )}

          <section>
            <h2 className="mb-1 text-sm">Private reflection</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              What do you want to remember for yourself?
            </p>
            <Textarea
              id="reflection"
              placeholder="Never shown to anyone, this part is only ever yours"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </section>

          {!isPrivateOnly && (
            <section>
              <h2 className="mb-3 text-sm">Choose who sees this</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AUDIENCE.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setAudience(opt.value);
                      if (opt.value !== "circle") setCircleId(undefined);
                    }}
                    aria-pressed={audience === opt.value}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
                      audience === opt.value
                        ? "border-transparent text-white [background-color:var(--coral-deep)]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <opt.icon className="size-4" />
                    <span className="text-[11px] leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {AUDIENCE.find((o) => o.value === audience)?.copy}
              </p>

              {audience === "circle" && (
                <div className="mt-3">
                  {hobbyCircles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No Circles exist for this space yet.
                    </p>
                  ) : (
                    <Select
                      value={circleId ? String(circleId) : undefined}
                      onValueChange={(v) => setCircleId(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a Circle" />
                      </SelectTrigger>
                      <SelectContent>
                        {hobbyCircles.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                            {c.location ? ` · ${c.location}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </section>
          )}

          {!isPrivateOnly && audience === "public" && <ForSaleComingSoon />}

          {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="coral"
              size="lg"
              className="flex-1"
              disabled={saving}
              onClick={publish}
            >
              <PenLine className="size-4" />
              {saving ? "Saving…" : "Create"}
            </Button>
            {!isPrivateOnly && (
              <Button
                variant="outline"
                size="lg"
                className="shrink-0"
                onClick={saveAsPrivateLog}
                disabled={saving}
              >
                <Lock className="size-4" />
                Save as private log
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
