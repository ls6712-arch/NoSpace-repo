import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Camera,
  Check,
  Globe2,
  ImagePlus,
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
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { Visibility } from "../data/posts";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { addPrivateLog, attachEntry, startProject, useJournal } from "../lib/journal";
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

/**
 * Log is not a post composer. It asks what kind of record you're making first,
 * because "starting a project", "adding an update", "noticing something", and
 * "writing a note for yourself" are four different acts that a single
 * caption-and-share box flattens into one.
 *
 * The private path is deliberately a peer of the public ones, not a checkbox
 * buried at the bottom: nobody should have to publish something in order to
 * keep a record of it.
 */
type Mode = "project" | "update" | "moment" | "private";

const MODES: {
  id: Mode;
  title: string;
  copy: string;
  icon: typeof Plus;
}[] = [
  { id: "project", title: "Start a project", copy: "Give a new thing a home", icon: Plus },
  { id: "update", title: "Add an update", copy: "Keep an existing project moving", icon: PenLine },
  { id: "moment", title: "Quick moment", copy: "A photo, win, question, or small discovery", icon: Sparkle },
  { id: "private", title: "Reflect privately", copy: "Keep a note just for you", icon: Lock },
];

/** The four audiences, in the words the brief specifies, widest privacy first. */
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

export function Log() {
  const [searchParams] = useSearchParams();
  const { addPost } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const journal = useJournal();

  const [mode, setMode] = useState<Mode | null>(null);
  const initialHobby = searchParams.get("hobby") ?? hobbies[0].slug;

  const [hobbySlug, setHobbySlug] = useState(initialHobby);
  const [subHobby, setSubHobby] = useState<string>(searchParams.get("sub") ?? "");
  const [projectId, setProjectId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("");
  const [type, setType] = useState<"photo" | "video">("photo");
  const [creator, setCreator] = useState("You");
  const [progress, setProgress] = useState("");
  const [changed, setChanged] = useState("");
  const [reflection, setReflection] = useState("");
  const [audience, setAudience] = useState<Visibility | "private">("friends");
  const [circleId, setCircleId] = useState<number | undefined>(undefined);
  const [forSale, setForSale] = useState(false);
  const [saleTitle, setSaleTitle] = useState("");
  const [salePrice, setSalePrice] = useState("25");
  const [saleType, setSaleType] = useState<"physical" | "digital" | "course">("digital");
  const [done, setDone] = useState<null | "logged" | "private">(null);
  const [seed] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.display_name) setCreator(profile.display_name);
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

  // Reflecting privately needs no audience — the whole point is that there isn't one.
  useEffect(() => {
    if (mode === "private") setAudience("private");
    else if (mode) setAudience((a) => (a === "private" ? "friends" : a));
  }, [mode]);

  const hobby = hobbies.find((h) => h.slug === hobbySlug)!;
  const hobbyCircles = circlesByHobby(hobbySlug);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);

  const requiresLogin = isConfigured && !user && mode !== null && mode !== "private";

  const canSubmit =
    mode === "private"
      ? reflection.trim().length > 0
      : progress.trim().length > 0 &&
        (mode !== "project" || projectTitle.trim().length > 0) &&
        (mode !== "update" || !!projectId) &&
        (audience !== "circle" || !!circleId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setType(picked.type.startsWith("video") ? "video" : "photo");
  };

  /** Keeps everything as a private log — no audience, nothing published. */
  const saveAsPrivateLog = () => {
    const note = [progress.trim(), changed.trim(), reflection.trim()]
      .filter(Boolean)
      .join("\n\n");
    if (!note) return;
    addPrivateLog(note, projectId || undefined);
    setDone("private");
  };

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;

    if (audience === "private" || mode === "private") {
      saveAsPrivateLog();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let linkTo = projectId;
      if (mode === "project") {
        linkTo = startProject({
          title: projectTitle.trim(),
          hobbySlug,
          subHobby: subHobby || undefined,
        }).id;
      }

      const entry = await addPost({
        hobbySlug,
        subHobby: subHobby || undefined,
        type,
        file: file ?? undefined,
        creator: creator.trim() || "You",
        caption: [progress.trim(), changed.trim()].filter(Boolean).join(" — "),
        reflection: reflection.trim() || undefined,
        visibility: audience,
        circleId: audience === "circle" ? circleId : undefined,
        forSale: forSale
          ? {
              name: saleTitle.trim() || progress.trim().slice(0, 40),
              price: Number(salePrice) || 0,
              type: saleType,
            }
          : undefined,
      });

      if (linkTo) attachEntry(entry.id, linkTo);
      setDone("logged");
    } catch {
      setError("Something went wrong saving that — mind trying again?");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setProgress("");
    setChanged("");
    setReflection("");
    setForSale(false);
    setSaleTitle("");
    setProjectTitle("");
    setCircleId(undefined);
    setDone(null);
    setFile(null);
    setError(null);
    setMode(null);
  };

  // ── The choice screen ───────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="min-h-screen bg-surface py-12 sm:py-16">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="mb-2 text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Log your progress
          </h1>
          <p className="mb-9 text-muted-foreground">
            A photo, a note, or a small update counts.
          </p>

          <h2 className="mb-4 text-sm text-muted-foreground">What are you logging?</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {MODES.map(({ id, title, copy, icon: Icon }) => {
              const disabled = id === "update" && openProjects.length === 0;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(id)}
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

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Nothing here has to be finished or public. Reflect privately keeps the
            record without sharing any of it.
          </p>
        </div>
      </div>
    );
  }

  if (requiresLogin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center">
          <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full text-white [background-image:var(--gradient-brand)]">
            <NotebookPen className="size-7" />
          </span>
          <h2 className="mb-2 text-2xl">Log in to keep your work</h2>
          <p className="mb-6 text-muted-foreground">
            Your projects and updates are tied to your account, so they're still
            here next time — not just in this browser tab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/login?redirect=/log`}>
              <Button variant="coral">Log in or sign up</Button>
            </Link>
            <Button variant="outline" onClick={() => setMode("private")}>
              Just write it for myself
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center">
          <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full text-white [background-color:var(--coral-deep)]">
            {done === "private" ? <Lock className="size-6" /> : <Check className="size-7" />}
          </span>
          <h2 className="mb-2 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            {done === "private" ? "Saved to your private logs" : "Logged"}
          </h2>
          <p className="mb-6 text-muted-foreground">
            {done === "private"
              ? "Only you can see this. It lives under You → Private logs."
              : `Your ${mode === "project" ? "project is under way" : "update is in"} — ${hobby.shortName}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={done === "private" ? "/you" : "/my-space"}>
              <Button variant="coral">
                {done === "private" ? "Open your private logs" : "See it in My Space"}
              </Button>
            </Link>
            <Button variant="outline" onClick={reset}>
              Log something else
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeMode = MODES.find((m) => m.id === mode)!;
  const isPrivateOnly = mode === "private";

  // ── The logging flow ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-2xl px-4">
        <button
          type="button"
          onClick={() => setMode(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          What are you logging?
        </button>

        <h1 className="mb-2 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          {activeMode.title}
        </h1>
        <p className="mb-9 text-muted-foreground">{activeMode.copy}</p>

        <div className="space-y-7 rounded-3xl border border-border bg-card p-6 md:p-8">
          {!isPrivateOnly && (
            <>
              {/* 1 ─────────────────────────────────────────────────────── */}
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
                          {p.subHobby ? ` · ${subHobbyLabel(p.subHobby) ?? p.subHobby}` : ""}
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
                      className="mb-3"
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
                      onChange={(e) => setCreator(e.target.value)}
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

              {/* 2 ─────────────────────────────────────────────────────── */}
              <section>
                <h2 className="mb-1 text-sm">Show your progress</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Add a photo, video, or short note.
                </p>

                <div className="mb-3 flex items-center gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border">
                    {filePreviewUrl ? (
                      type === "video" ? (
                        <video src={filePreviewUrl} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={filePreviewUrl} alt="" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <GeneratedArt hobbySlug={hobbySlug} seed={seed} className="h-full w-full" />
                    )}
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
                      ref={fileInputRef}
                      type="file"
                      accept={type === "video" ? "video/*" : "image/*"}
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setType("photo")}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                          type === "photo"
                            ? "border-transparent text-white [background-color:var(--coral-deep)]"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Camera className="size-3.5" />
                        Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setType("video")}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                          type === "video"
                            ? "border-transparent text-white [background-color:var(--coral-deep)]"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Video className="size-3.5" />
                        Video
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="size-3.5" />
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

              {/* 3 ─────────────────────────────────────────────────────── */}
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

          {/* 4 ───────────────────────────────────────────────────────── */}
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

          {/* 5 ───────────────────────────────────────────────────────── */}
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

          {/* 6 ───────────────────────────────────────────────────────── */}
          {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="coral"
              size="lg"
              className="flex-1"
              disabled={!canSubmit || saving}
              onClick={handleSubmit}
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
                disabled={
                  saving || !(progress.trim() || changed.trim() || reflection.trim())
                }
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
