import { useState } from "react";
import { getHobby } from "../data/hobbies";
import { useCorners, slugifyCorner } from "../context/CornersContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

/**
 * Create a Corner — deliberately three fields and nothing else: a name, a
 * short description, and the Space, which is suggested from wherever this
 * was opened rather than asked for. Corners already come into existence for
 * free by tagging a Moment (CornersContext's getOrCreateCorner) — this is
 * the version for someone who wants to stand one up on purpose, before any
 * Moment exists to tag it with, and give it a line explaining what it's for.
 */
export function CreateCornerDialog({
  open,
  onOpenChange,
  spaceSlug,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  /** Called with the new Corner's slug after creation, e.g. to filter the
   * Space page down to it right away. */
  onCreated?: (slug: string) => void;
}) {
  const { getOrCreateCorner, cornersFor } = useCorners();
  const space = getHobby(spaceSlug);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setError(null);
    setSaving(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name first.");
      return;
    }
    const slug = slugifyCorner(trimmed);
    const already = cornersFor(spaceSlug).find((c) => c.slug === slug);
    if (already) {
      setError(`${already.name} already exists in ${space?.shortName ?? "this Space"}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await getOrCreateCorner(spaceSlug, trimmed, description);
      onCreated?.(created.slug);
      close(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Create a Corner</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            A specific craft or topic inside {space?.shortName ?? "a Space"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="corner-space" className="mb-1.5 block text-xs">
              Space
            </Label>
            {/* Suggested, not asked for — you're already standing on the
                Space this Corner belongs in, so there's nothing to pick. */}
            <div
              id="corner-space"
              className="flex items-center rounded-2xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-muted-foreground"
            >
              {space?.name ?? spaceSlug}
            </div>
          </div>

          <div>
            <Label htmlFor="corner-name" className="mb-1.5 block text-xs">
              Name
            </Label>
            <Input
              id="corner-name"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Pasta Making"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div>
            <Label htmlFor="corner-description" className="mb-1.5 block text-xs">
              Short description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="corner-description"
              value={description}
              maxLength={140}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What belongs here, in a line."
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}

          <Button variant="coral" className="w-full" disabled={saving} onClick={submit}>
            {saving ? "Creating…" : "Create Corner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
