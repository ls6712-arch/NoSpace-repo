import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  FolderPlus,
  Globe2,
  Images,
  Lock,
  NotebookPen,
  PenLine,
  Plus,
  Send,
  Sparkle,
  Users,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { LOCATION_PRIVACY, LocationPrivacy } from "../data/participation";
import { Visibility } from "../data/posts";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { addPrivateLog, attachEntry, startProject, useJournal } from "../lib/journal";
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
import { GeneratedArt } from "../components/GeneratedArt";
import { InterestField } from "../components/InterestField";

/**
 * Logging, in the order the act actually happens: capture the thing first,
 * decide what it is second. The old version asked you to classify before you
 * had anything to classify, which is backwards for someone standing at a wheel
 * with clay on their hands.
 *
 *   capture → moment → (save | share → saved)
 *
 * "More ways to log" opens the deliberate four-option chooser — start a
 * project, add an update, quick moment, reflect privately — for when you know
 * what you're doing before you start. Both roads lead to the same record.
 */
type Screen = "capture" | "moment" | "share" | "saved" | "ways" | "detail";

/** The considered path: four kinds of record, chosen up front. */
type Mode = "project" | "update" | "moment" | "private";

const MODES: { id: Mode; title: string; copy: string; icon: typeof Plus }[] = [
  { id: "project", title: "Start a project", copy: "Give a new thing a home", icon: Plus },
  { id: "update", title: "Add an update", copy: "Keep an existing project moving", icon: PenLine },
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
  { value: "private", label: "Only you", copy: "Kept as a private log — nobody else ever sees it", icon: Lock },
  { value: "friends", label: "People you follow", copy: "Visible to the makers you follow", icon: UserRound },
  { value: "circle", label: "A Circle", copy: "Only members of one Circle you pick", icon: Users },
  { value: "public", label: "Everyone", copy: "Anyone browsing this space can find it", icon: Globe2 },
];

const THOUGHT_LIMIT = 300;

/** The small growing thing on the capture screen. Nothing here is a mascot. */
function Sprout() {
  return (
    <svg width="60" height="46" viewBox="0 0 60 46" aria-hidden="true" className="mx-auto">
      <path d="M30 44V24" stroke="var(--forest)" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M30 27c-2-9-9-13-19-12 0 10 9 15 19 12ZM30 22c2-9 9-13 19-12 0 10-9 15-19 12Z"
        fill="var(--forest)"
        opacity=".85"
      />
      <ellipse cx="30" cy="44" rx="13" ry="2.4" fill="var(--forest)" opacity=".18" />
      <path d="M46 8l1.6 4.4L52 14l-4.4 1.6L46 20l-1.6-4.4L40 14l4.4-1.6z" fill="var(--yellow)" />
    </svg>
  );
}

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

export function Log() {
  const [searchParams] = useSearchParams();
  const { addPost, mediaError, clearMediaError, saveError, clearSaveError } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const journal = useJournal();

  const [screen, setScreen] = useState<Screen>("capture");
  const [mode, setMode] = useState<Mode | null>(null);

  const initialHobby = searchParams.get("hobby") ?? hobbies[0].slug;
  const [hobbySlug, setHobbySlug] = useState(initialHobby);
  const [subHobby, setSubHobby] = useState<string>(searchParams.get("sub") ?? "");
  const [projectId, setProjectId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("");
  const [type, setType] = useState<"photo" | "video">("photo");
  const [creator, setCreator] = useState("You");
  const [interest, setInterest] = useState("");
  const [thought, setThought] = useState("");
  const [progress, setProgress] = useState("");
  const [changed, setChanged] = useState("");
  const [reflection, setReflection] = useState("");
  const [audience, setAudience] = useState<Visibility | "private">("friends");
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

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);

  // Fill the name in from the profile, but never overwrite what someone has
  // already typed — on a slow connection the profile used to arrive mid-edit
  // and silently replace their input.
  const creatorTouched = useRef(false);
  useEffect(() => {
    if (profile?.display_name && !creatorTouched.current) setCreator(profile.display_name);
  }, [profile?.display_name]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (mode === "private") setAudience("private");
    else if (mode) setAudience((a) => (a === "private" ? "friends" : a));
  }, [mode]);

  const hobby = hobbies.find((h) => h.slug === hobbySlug)!;
  const hobbyCircles = circlesByHobby(hobbySlug);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);
  // What the post is about, in the person's own words where they gave them.
  const tagLabel =
    interest.trim() ||
    (subHobby ? (subHobbyLabel(subHobby) ?? subHobby) : hobby.shortName);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setType(picked.type.startsWith("video") ? "video" : "photo");
    setScreen("moment");
  };

  /** Keeps the record without publishing any of it. */
  const saveAsPrivateLog = () => {
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
        hobbySlug,
        subHobby: subHobby || undefined,
      }).id;
    }
    addPrivateLog(
      note || `A ${tagLabel.toLowerCase()} moment`,
      linkTo || undefined,
      // The picture is the point of a wordless capture. It used to be dropped
      // here and replaced with a generated placeholder, which read as the app
      // losing the moment you'd just taken.
      filePreviewUrl
        ? {
            url: filePreviewUrl,
            type: type === "video" ? "video" : "image",
            hobbySlug,
          }
        : undefined,
    );
    setSavedAs("private");
    setScreen("saved");
  };

  const publish = async () => {
    if (saving) return;
    if (audience === "private") {
      saveAsPrivateLog();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let linkTo = projectId;
      if (mode === "project" && projectTitle.trim()) {
        linkTo = startProject({
          title: projectTitle.trim(),
          hobbySlug,
          subHobby: subHobby || undefined,
        }).id;
      }

      const caption =
        [thought.trim(), progress.trim(), changed.trim()].filter(Boolean).join(" — ") ||
        `A ${tagLabel.toLowerCase()} moment`;

      const entry = await addPost({
        hobbySlug,
        subHobby: subHobby || undefined,
        interest: interest.trim() || undefined,
        type,
        file: file ?? undefined,
        creator: creator.trim() || "You",
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

      if (linkTo) attachEntry(entry.id, linkTo);
      setSavedAs("shared");
      setScreen("saved");
    } catch {
      setError("Something went wrong saving that — mind trying again?");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    clearMediaError();
    clearSaveError();
    setThought("");
    setProgress("");
    setChanged("");
    setReflection("");
    setForSale(false);
    setSaleTitle("");
    setInterest("");
    setProjectTitle("");
    setProjectId("");
    setCircleId(undefined);
    setFile(null);
    setError(null);
    setSavedAs(null);
    setMode(null);
    setScreen("capture");
  };

  const requiresLogin =
    isConfigured && !user && screen !== "capture" && audience !== "private" && mode !== "private";

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

  // ── 1 · Capture ─────────────────────────────────────────────────────────
  if (screen === "capture") {
    return (
      <Shell>
        <h1 className="text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          Log a moment
        </h1>
        <p className="mt-1.5 text-muted-foreground">A little progress counts.</p>

        <div className="my-9">
          <Sprout />
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={pickFile}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={pickFile}
        />

        <div className="space-y-3">
          <Button
            variant="coral"
            size="lg"
            className="w-full"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-4" />
            Take a photo
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => libraryRef.current?.click()}
          >
            <Images className="size-4" />
            Choose from library
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              setFile(null);
              setScreen("moment");
            }}
          >
            <PenLine className="size-4" />
            Write a quick note
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setScreen("ways")}
          className="mx-auto mt-7 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          More ways to log
          <ArrowRight className="size-3.5" />
        </button>
      </Shell>
    );
  }

  // ── More ways: the deliberate four-option chooser ───────────────────────
  if (screen === "ways") {
    return (
      <Shell>
        <Back to="capture" />
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          Log your progress
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          A photo, a note, or a small update counts.
        </p>

        <h2 className="mb-4 mt-8 text-sm text-muted-foreground">What are you logging?</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODES.map(({ id, title, copy, icon: Icon }) => {
            const disabled = id === "update" && openProjects.length === 0;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setMode(id);
                    setScreen("detail");
                  }}
                  className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] hover:shadow-[0_14px_28px_-18px_rgba(11,62,46,0.5)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:shadow-none"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-[var(--forest)] transition-colors group-hover:bg-[var(--coral-deep)] group-hover:text-white group-disabled:bg-surface-muted group-disabled:text-[var(--forest)]">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
                    {title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {disabled ? "Start a project first, then updates go here" : copy}
                  </span>
                </button>
              </li>
            );
          })}
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
            time — not just in this browser tab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login?redirect=/log">
              <Button variant="coral">Log in or sign up</Button>
            </Link>
            <Button variant="outline" onClick={saveAsPrivateLog}>
              Just keep it for myself
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── 4 · Saved ───────────────────────────────────────────────────────────
  if (screen === "saved") {
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
              style={{ borderColor: "var(--yellow)", color: "var(--forest)" }}
            >
              {savedAs === "private" ? <Lock className="size-5" /> : <Check className="size-6" />}
            </span>
          </span>

          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            {saveError ? "Not saved." : "Saved."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {interest.trim() ? `${tagLabel} · ${hobby.name}` : hobby.name}
          </p>
          {!saveError && (
            <p className="mx-auto mt-3 max-w-[16rem] border-t border-[var(--hairline)] pt-3 text-sm">
              {savedAs === "private" ? "Kept just for you." : "Another one made."}
            </p>
          )}

          <div className="mx-auto my-6 w-40 overflow-hidden rounded-xl border border-border">
            <MediaPreview className="aspect-square w-full" />
          </div>

          {/* An honest failure beats a cheerful lie: the post is on screen but
              only in this tab, and it will be gone after a reload. */}
          {saveError && (
            <p className="mx-auto mb-5 max-w-xs rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--cream))] px-4 py-3 text-left text-xs leading-relaxed text-foreground">
              {saveError} Nothing you wrote is lost yet — try again before you
              close this tab.
            </p>
          )}

          {mediaError && (
            <p className="mx-auto mb-5 max-w-xs rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--cream))] px-4 py-3 text-left text-xs leading-relaxed text-foreground">
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
              onClick={() => {
                setMode("moment");
                setScreen("detail");
              }}
              className="w-full py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Add details
            </button>
            <button
              type="button"
              onClick={reset}
              className="w-full py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Log another
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── 2 · Your moment ─────────────────────────────────────────────────────
  if (screen === "moment") {
    const hasSomething = !!file || thought.trim().length > 0;
    return (
      <Shell>
        <Back to="capture" />
        <h1 className="mb-6 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          Your moment
        </h1>

        {file && (
          <div className="relative mb-4 overflow-hidden rounded-2xl border border-border">
            <MediaPreview className="aspect-[4/3] w-full" />
            <button
              type="button"
              onClick={() => setFile(null)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[var(--forest-ink)]/65 text-white"
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
        </div>

        {/* What to do with it. Keeping it is the first option, on purpose. */}
        <ul className="space-y-2.5">
          <li>
            <button
              type="button"
              disabled={!hasSomething}
              onClick={saveAsPrivateLog}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[var(--coral-deep)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border"
            >
              <Bookmark className="size-4 shrink-0 text-[var(--forest)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">Save this moment</span>
                <span className="block text-xs text-muted-foreground">
                  Keep it in your space. Only you can see it.
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled={!hasSomething}
              onClick={() => setScreen("share")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[var(--coral-deep)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border"
            >
              <Send className="size-4 shrink-0 text-[var(--forest)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">Share this moment</span>
                <span className="block text-xs text-muted-foreground">
                  Add a hobby tag and choose who sees it.
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
          <li>
            <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-3">
                <FolderPlus className="size-4 shrink-0 text-[var(--forest)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">Add to a project</span>
                  <span className="block text-xs text-muted-foreground">
                    Keep an ongoing thing together.
                  </span>
                </span>
              </div>
              {openProjects.length === 0 ? (
                <Input
                  className="mt-3"
                  value={projectTitle}
                  onChange={(e) => {
                    setProjectTitle(e.target.value);
                    setMode(e.target.value.trim() ? "project" : null);
                  }}
                  placeholder="Name a new project, e.g. Six matching mugs"
                />
              ) : (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-3">
                    <SelectValue placeholder="Choose a project — optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {openProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </li>
        </ul>

        {!hasSomething && (
          <p className="mt-4 text-xs text-muted-foreground">
            Add a photo or a line of text and these open up.
          </p>
        )}
      </Shell>
    );
  }

  // ── 3 · Tag, then audience ──────────────────────────────────────────────
  if (screen === "share") {
    return (
      <Shell>
        <Back to="moment" />
        <h1 className="mb-6 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          Share this moment
        </h1>

        {/* Two questions, in the order people actually think:
            what it's about, then where it goes. No taxonomy quiz. */}
        <h2 className="mb-2 text-sm">
          <label htmlFor="interest">What is it about?</label>
        </h2>
        <InterestField value={interest} onChange={setInterest} />

        <h2 className="mb-2 mt-7 text-sm">Which Space?</h2>
        <Select
          value={hobbySlug}
          onValueChange={(v) => {
            setHobbySlug(v);
            setSubHobby("");
            setCircleId(undefined);
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
        <p className="mb-7 mt-1.5 text-xs text-muted-foreground">
          {hobby.plainLabel} — {hobby.tagline.toLowerCase()}
        </p>

        {/* Only a thing that happens at a time needs a time. */}
        <div className="mb-7 rounded-2xl border border-border bg-card px-4 py-3.5">
          <button
            type="button"
            onClick={() => setIsActivity((v) => !v)}
            aria-pressed={isActivity}
            className="flex w-full items-center justify-between gap-3"
          >
            <span className="text-left">
              <span className="block text-sm">This is something happening</span>
              <span className="block text-xs text-muted-foreground">
                A walk, a workshop, a meetup, a challenge — people can join in
              </span>
            </span>
            <span
              className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                isActivity
                  ? "justify-end [background-color:var(--forest)]"
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
                        {o.label} — {o.copy}
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
                      ? "border-[var(--coral-deep)] bg-[color-mix(in_srgb,var(--coral)_10%,var(--cream))]"
                      : "border-border bg-card hover:border-[var(--foreground)]/30"
                  }`}
                >
                  <opt.icon className="size-4 shrink-0 text-[var(--forest)]" />
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

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          {audience === "private"
            ? "This stays a private log. Nobody else will see it."
            : `This will appear in ${
                audience === "public"
                  ? `${hobby.name}`
                  : audience === "circle"
                    ? "that Circle"
                    : "My Space for people who follow you"
              }${interest.trim() ? ` and be tagged ${tagLabel}.` : "."}`}
        </p>

        {error && <p className="mt-3 text-center text-xs text-[var(--coral-text)]">{error}</p>}

        <Button
          variant="coral"
          size="lg"
          className="mt-4 w-full"
          disabled={saving || (audience === "circle" && !circleId)}
          onClick={publish}
        >
          {saving ? "Saving…" : audience === "private" ? "Keep it private" : "Share it"}
        </Button>
      </Shell>
    );
  }

  // ── The considered form, reached from "More ways to log" or "Add details" ─
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[2];
  const isPrivateOnly = mode === "private";

  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-2xl px-4">
        <Back to="ways" />

        <h1 className="mb-2 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          {activeMode.title}
        </h1>
        <p className="mb-9 text-muted-foreground">{activeMode.copy}</p>

        <div className="space-y-7 rounded-3xl border border-border bg-card p-6 md:p-8">
          {!isPrivateOnly && (
            <>
              <section>
                <h2 className="mb-1 text-sm">What are you working on?</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  {mode === "update"
                    ? "Choose the project this belongs to."
                    : mode === "project"
                      ? "Give it a name you'll recognise in six months."
                      : "Where does this sit?"}
                </p>

                {mode === "update" ? (
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {openProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  mode === "project" && (
                    <Input
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g. Six matching mugs"
                    />
                  )
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
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
                  <div>
                    <Label htmlFor="creator" className="mb-2 block text-xs">
                      Logging as
                    </Label>
                    <Input
                      id="creator"
                      value={creator}
                      onChange={(e) => {
                        creatorTouched.current = true;
                        setCreator(e.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {hobby.subItems.map((s) => {
                    const active = subHobby === s.slug;
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => setSubHobby(active ? "" : s.slug)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          active
                            ? "border-transparent text-white [background-color:var(--coral-deep)]"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </section>

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
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[var(--forest-ink)]/70 text-white"
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
                  placeholder="Centred it on the third try — next time, wetter hands"
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
              placeholder="Never shown to anyone — this part is only ever yours"
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

          {!isPrivateOnly && audience === "public" && (
            <div className="rounded-2xl border border-border p-4">
              <button
                type="button"
                onClick={() => setForSale((v) => !v)}
                className="flex w-full items-center justify-between"
                aria-pressed={forSale}
              >
                <span className="text-left">
                  <span className="block text-sm">Offer this for sale</span>
                  <span className="block text-xs text-muted-foreground">
                    The physical piece, a digital download, or a course
                  </span>
                </span>
                <span
                  className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                    forSale
                      ? "justify-end [background-color:var(--forest)]"
                      : "justify-start bg-surface-muted"
                  }`}
                >
                  <span className="size-5 rounded-full bg-white" />
                </span>
              </button>

              {forSale && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="saleTitle" className="mb-2 block">
                      Listing title
                    </Label>
                    <Input
                      id="saleTitle"
                      placeholder="e.g. Hand-thrown mug, glazed"
                      value={saleTitle}
                      onChange={(e) => setSaleTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="salePrice" className="mb-2 block">
                      Price (USD)
                    </Label>
                    <Input
                      id="salePrice"
                      type="number"
                      min={0}
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Type</Label>
                    <Select value={saleType} onValueChange={(v) => setSaleType(v as typeof saleType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical item</SelectItem>
                        <SelectItem value="digital">Digital download</SelectItem>
                        <SelectItem value="course">Course</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

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
              {saving ? "Saving…" : "Log progress"}
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
