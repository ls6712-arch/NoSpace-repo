import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { Post } from "../data/posts";
import { startProject } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { InterestField } from "./InterestField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const OTHER = "__other__";

/**
 * Add to Your Pursuits — the whole point is that a Pursuit needs nothing but
 * a name. Interest and Space are both optional, both free-text at heart
 * (Space offers NoSpace's real Spaces as a shortcut, with "Other" for
 * anything that isn't one), and neither is validated against a taxonomy.
 * This is deliberately not the full Log flow: no photo, no audience, no
 * caption — just naming the thing you're about to start.
 */
export function PursuitDialog({
  open,
  onOpenChange,
  seedPost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Try This'd creation this Pursuit grew out of, if any — seeds the
   * name and Interest, and rides along as the card's inspiration image. */
  seedPost?: Post | null;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [interest, setInterest] = useState("");
  const [spaceSlug, setSpaceSlug] = useState<string>("");
  const [customSpace, setCustomSpace] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(seedPost ? seedPost.caption.split(".")[0].slice(0, 60).trim() : "");
    setInterest(seedPost?.interest ?? "");
    setSpaceSlug(seedPost?.hobbySlug ?? "");
    setCustomSpace("");
  }, [open, seedPost]);

  const isOther = spaceSlug === OTHER;

  const submit = () => {
    const name = title.trim();
    if (!name) return;
    const project = startProject({
      title: name,
      hobbySlug: spaceSlug && !isOther ? spaceSlug : undefined,
      interest: interest.trim() || undefined,
      customSpace: isOther ? customSpace.trim() || undefined : undefined,
      inspiredByPostId: seedPost?.id,
      shared: false,
    });
    if (user) void mirrorPursuit(user.id, project);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--pastel-clay) 42%, var(--cream))" }}
            >
              <Sparkles className="size-4 text-[var(--forest-ink)]" strokeWidth={1.7} />
            </span>
            Add to Your Pursuits
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Name it. Everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pursuit-title" className="mb-1.5 block text-xs">
              What are you pursuing?
            </Label>
            <Input
              id="pursuit-title"
              value={title}
              maxLength={80}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Learn pottery, learn to DJ, learn bookbinding…"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div>
            <Label htmlFor="interest" className="mb-1.5 block text-xs">
              Interest <span className="text-muted-foreground">(optional)</span>
            </Label>
            <InterestField id="interest" value={interest} onChange={setInterest} placeholder="Pottery, DJing, bookbinding…" />
          </div>

          <div>
            <Label htmlFor="pursuit-space" className="mb-1.5 block text-xs">
              Space <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select value={spaceSlug} onValueChange={setSpaceSlug}>
              <SelectTrigger id="pursuit-space">
                <SelectValue placeholder="Choose a Space (optional)" />
              </SelectTrigger>
              <SelectContent>
                {hobbies.map((h) => (
                  <SelectItem key={h.slug} value={h.slug}>
                    {h.shortName}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {isOther && (
              <Input
                className="mt-2"
                value={customSpace}
                maxLength={40}
                onChange={(e) => setCustomSpace(e.target.value)}
                placeholder="Name your own Space, e.g. Independent"
              />
            )}
          </div>

          <Button variant="coral" className="w-full" disabled={!title.trim()} onClick={submit}>
            Create Pursuit
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Private by default. You choose if and when to share it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
