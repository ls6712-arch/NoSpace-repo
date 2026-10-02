import { useState } from "react";
import { Post } from "../data/posts";
import { LOCATION_PRIVACY, LocationPrivacy } from "../data/participation";
import { useContent } from "../context/ContentContext";
import { useCorners } from "../context/CornersContext";
import { subHobbyLabel } from "../data/hobbies";
import { MOMENT_VISIBILITY_OPTIONS } from "../lib/visibility";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { ERROR_LINE } from "../lib/stateCopy";

/**
 * Step 3, §5 "Details move after saving": Corner, location, private
 * reflection, and audience no longer block Save — they live here instead,
 * offered right after a Moment is saved (skippable, swipe away) and always
 * reachable again from the Moment's own Edit screen (MomentDetail.tsx).
 * Never shown for a private-log stand-in — those are "only me" by
 * definition and were never a real `posts` row updatePost could patch.
 */
export function AddDetailsSheet({
  post,
  open,
  onOpenChange,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePost } = useContent();
  const { resolveInterest } = useCorners();
  const [corner, setCorner] = useState(post ? subHobbyLabel(post.corner ?? "") ?? post.corner ?? "" : "");
  const [locationName, setLocationName] = useState(post?.locationName ?? "");
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>(post?.locationPrivacy ?? "neighborhood");
  const [reflection, setReflection] = useState(post?.reflection ?? "");
  const [audience, setAudience] = useState(post?.visibility ?? "followers");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cornerBlocked, setCornerBlocked] = useState(false);

  if (!post || post.isPrivateLog) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setCornerBlocked(false);
    try {
      let cornerSlug: string | undefined = post.corner;
      const trimmedCorner = corner.trim();
      if (trimmedCorner && trimmedCorner !== (subHobbyLabel(post.corner ?? "") ?? post.corner)) {
        const match = await resolveInterest(trimmedCorner);
        if (match && "blocked" in match) {
          setCornerBlocked(true);
          setSaving(false);
          return;
        }
        cornerSlug = match?.slug;
      }
      const ok = await updatePost(post.id, {
        corner: cornerSlug,
        locationName: locationName.trim() || undefined,
        locationPrivacy: locationName.trim() ? locationPrivacy : undefined,
        reflection,
        visibility: audience,
      });
      if (!ok) {
        setError(ERROR_LINE);
        return;
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
        <SheetHeader>
          <SheetTitle style={{ fontFamily: "var(--font-serif)" }}>Add details</SheetTitle>
          <SheetDescription>Optional — nothing here was needed to save this Moment.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div>
            <Label htmlFor="details-corner" className="mb-1.5 block text-xs">
              Corner
            </Label>
            <Input
              id="details-corner"
              value={corner}
              maxLength={60}
              onChange={(e) => {
                setCorner(e.target.value);
                setCornerBlocked(false);
              }}
              placeholder="Pottery, sourdough, bouldering…"
            />
            {cornerBlocked && (
              <p className="mt-1.5 text-[11px] text-destructive">Try a more general name.</p>
            )}
          </div>

          <div>
            <Label htmlFor="details-location" className="mb-1.5 block text-xs">
              Location <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="details-location"
              value={locationName}
              maxLength={80}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Where was this?"
            />
            {locationName.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LOCATION_PRIVACY.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setLocationPrivacy(o.value)}
                    aria-pressed={locationPrivacy === o.value}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      locationPrivacy === o.value
                        ? "border-[var(--coral-deep,var(--accent))] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="details-reflection" className="mb-1.5 block text-xs">
              Private reflection <span className="text-muted-foreground">(only you)</span>
            </Label>
            <Textarea
              id="details-reflection"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              maxLength={2000}
              placeholder="Never shown to anyone."
              className="min-h-20"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Who sees this</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {MOMENT_VISIBILITY_OPTIONS.map((o) => {
                const Icon = o.icon;
                // "private" is the legacy spelling of "just_me" (see
                // lib/visibility.ts's isOnlyYou) — a post saved before the
                // rename still matches the "Only you" chip here.
                const active = audience === o.value || (o.value === "just_me" && audience === "private");
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAudience(o.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] transition-colors ${
                      active ? "border-[var(--coral-deep,var(--accent))] text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button busy={saving} variant="coral" className="w-full" disabled={saving} onClick={save}>
            Save details
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
