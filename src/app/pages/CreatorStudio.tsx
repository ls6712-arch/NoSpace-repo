import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Camera, Check, Globe2, ImagePlus, Sparkles, Users, UserRound, Video, X } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { Visibility } from "../data/posts";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
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

const VISIBILITY_OPTIONS: { value: Visibility; label: string; copy: string; icon: typeof Globe2 }[] = [
  { value: "friends", label: "Friends", copy: "Only people who follow you back — the default", icon: UserRound },
  { value: "circle", label: "Circle", copy: "Only members of one circle you pick", icon: Users },
  { value: "public", label: "Public", copy: "Opt-in — anyone browsing this space can see it", icon: Globe2 },
];

export function CreatorStudio() {
  const [searchParams] = useSearchParams();
  const { addPost } = useContent();
  const { user, profile, isConfigured } = useAuth();

  const initialHobby = searchParams.get("hobby") ?? hobbies[0].slug;

  const [hobbySlug, setHobbySlug] = useState(initialHobby);
  const [subHobby, setSubHobby] = useState<string>(
    searchParams.get("sub") ?? "",
  );
  const [type, setType] = useState<"photo" | "video">("photo");
  const [creator, setCreator] = useState("You");
  const [caption, setCaption] = useState("");
  const [reflection, setReflection] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [circleId, setCircleId] = useState<number | undefined>(undefined);
  const [forSale, setForSale] = useState(false);
  const [saleTitle, setSaleTitle] = useState("");
  const [salePrice, setSalePrice] = useState("25");
  const [saleType, setSaleType] = useState<"physical" | "digital" | "course">("digital");
  const [justPosted, setJustPosted] = useState(false);
  const [postSeed] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
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

  const hobbyCircles = circlesByHobby(hobbySlug);

  const canSubmit = caption.trim().length > 0 && (visibility !== "circle" || !!circleId);
  // Once accounts are wired up, posting is tied to a real account — same
  // idea as any social app, and what makes "your posts" actually yours.
  const requiresLogin = isConfigured && !user;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setType(picked.type.startsWith("video") ? "video" : "photo");
  };

  const handleSubmit = async () => {
    if (!canSubmit || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await addPost({
        hobbySlug,
        subHobby: subHobby || undefined,
        type,
        file: file ?? undefined,
        creator: creator.trim() || "You",
        caption: caption.trim(),
        reflection: reflection.trim() || undefined,
        visibility,
        circleId: visibility === "circle" ? circleId : undefined,
        forSale: forSale
          ? {
              name: saleTitle.trim() || caption.trim().slice(0, 40),
              price: Number(salePrice) || 0,
              type: saleType,
            }
          : undefined,
      });
      setJustPosted(true);
    } catch {
      setPostError("Something went wrong posting that — mind trying again?");
    } finally {
      setPosting(false);
    }
  };

  const resetForm = () => {
    setCaption("");
    setReflection("");
    setForSale(false);
    setSaleTitle("");
    setVisibility("friends");
    setCircleId(undefined);
    setJustPosted(false);
    setFile(null);
    setPostError(null);
  };

  if (requiresLogin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel rounded-3xl p-10 text-center max-w-md">
          <span className="inline-flex size-14 items-center justify-center rounded-full text-white mb-5 [background-image:var(--gradient-brand)]">
            <Sparkles className="size-7" />
          </span>
          <h2 className="text-2xl mb-2">Log in to post</h2>
          <p className="text-muted-foreground mb-6">
            Posts are tied to your account now, so they're actually still there next
            time you come back — not just this browser tab.
          </p>
          <Link to={`/login?redirect=/create${hobbySlug ? `?hobby=${hobbySlug}` : ""}`}>
            <Button variant="brand">Log in or sign up</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (justPosted) {
    const hobby = hobbies.find((h) => h.slug === hobbySlug)!;
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel glow-violet rounded-3xl p-10 text-center max-w-md">
          <span className="inline-flex size-14 items-center justify-center rounded-full text-white mb-5 [background-image:var(--gradient-brand)]">
            <Check className="size-7" />
          </span>
          <h2 className="text-2xl mb-2">Posted to {hobby.shortName}</h2>
          <p className="text-muted-foreground mb-6">
            +50 points, on their way to your profile.
            {forSale && " Your listing is live in the space's marketplace too."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/space/${hobbySlug}`}>
              <Button variant="brand">View in space</Button>
            </Link>
            <Button variant="outline" onClick={resetForm}>
              Post another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-14">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-4 py-1.5 text-xs text-muted-foreground mb-4">
            <Sparkles className="size-3.5 text-[var(--coral-text)]" />
            Creator studio
          </div>
          <h1 className="text-4xl mb-2">Post something real</h1>
          <p className="text-muted-foreground">
            Log what you made, reflect for a second, then decide who sees it. Selling
            something you made? Turn on "list for sale" and it'll show up in that
            space's marketplace.
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
          <div className="text-xs text-[var(--coral-text)] tracking-wide">1 · LOG</div>
          <div>
            <Label className="mb-2 block">Space</Label>
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
            <Label className="mb-2 block">
              Which hobby?{" "}
              <span className="text-muted-foreground font-normal">— optional</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {(hobbies.find((h) => h.slug === hobbySlug)?.subItems ?? []).map((s) => {
                const active = subHobby === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => setSubHobby(active ? "" : s.slug)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tagging it puts your post in front of people browsing that hobby
              specifically.
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Content type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("photo")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  type === "photo"
                    ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Camera className="size-4" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => setType("video")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  type === "video"
                    ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Video className="size-4" />
                Video
              </button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Cover</Label>
            <div className="flex items-center gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border">
                {filePreviewUrl ? (
                  type === "video" ? (
                    <video src={filePreviewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={filePreviewUrl} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <GeneratedArt hobbySlug={hobbySlug} seed={postSeed} className="h-full w-full" />
                )}
                {file && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="Remove photo"
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
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="size-3.5" />
                  {file ? "Choose a different file" : "Upload a real photo/video"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {file
                    ? "This is what'll actually show on your post."
                    : `Skip it and NoSpace generates a cover in ${hobbies.find((h) => h.slug === hobbySlug)?.shortName}'s style instead.`}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="creator" className="mb-2 block">
              Posting as
            </Label>
            <Input id="creator" value={creator} onChange={(e) => setCreator(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="caption" className="mb-2 block">
              Caption
            </Label>
            <Textarea
              id="caption"
              placeholder="What did you make?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div className="text-xs text-[var(--coral-text)] tracking-wide pt-2">2 · REFLECT</div>
          <div>
            <Label htmlFor="reflection" className="mb-2 block">
              How'd it go? <span className="text-muted-foreground font-normal">(optional, private)</span>
            </Label>
            <Textarea
              id="reflection"
              placeholder="What worked, what you'd try next time — just for you, never shown publicly"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </div>

          <div className="text-xs text-[var(--coral-text)] tracking-wide pt-2">3 · SHARE (OPTIONAL)</div>
          <div>
            <Label className="mb-2 block">Who sees this</Label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setVisibility(opt.value);
                    if (opt.value !== "circle") setCircleId(undefined);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-colors ${
                    visibility === opt.value
                      ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <opt.icon className="size-4" />
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.copy}
            </p>

            {visibility === "circle" && (
              <div className="mt-3">
                {hobbyCircles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No circles exist for this space yet.
                  </p>
                ) : (
                  <Select
                    value={circleId ? String(circleId) : undefined}
                    onValueChange={(v) => setCircleId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a circle" />
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
          </div>

          <div className="rounded-2xl border border-border p-4">
            <button
              type="button"
              onClick={() => setForSale((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="text-left">
                <div className="text-sm">List this for sale</div>
                <div className="text-xs text-muted-foreground">
                  Sell the physical item, a digital download, or a course
                </div>
              </div>
              <span
                className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                  forSale ? "bg-[var(--sky-deep)] justify-end" : "bg-surface-muted justify-start"
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

          <div className="text-xs text-[var(--coral-text)] tracking-wide pt-2">4 · EARN</div>
          {postError && (
            <p className="text-xs text-[var(--coral)]">{postError}</p>
          )}
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            disabled={!canSubmit || posting}
            onClick={handleSubmit}
          >
            <Sparkles className="size-4" />
            {posting ? "Posting..." : "Post it · +50 pts"}
          </Button>
        </div>
      </div>
    </div>
  );
}
