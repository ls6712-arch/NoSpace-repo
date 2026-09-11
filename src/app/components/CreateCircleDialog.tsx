import { useState } from "react";
import { useNavigate } from "react-router";
import { hobbies } from "../data/hobbies";
import { useCircles } from "../context/CirclesContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/**
 * Starts a real, Supabase-backed Circle (sql/circles.sql) — visible to
 * every other account, unlike the seed Circles in data/circles.ts which
 * this never touches or replaces.
 */
export function CreateCircleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { createCircle } = useCircles();

  const [name, setName] = useState("");
  const [hobbySlug, setHobbySlug] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [prompt, setPrompt] = useState("");
  const [visibility, setVisibility] = useState<"Open to read" | "Members only">("Open to read");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setHobbySlug("");
    setLocation("");
    setPurpose("");
    setPrompt("");
    setVisibility("Open to read");
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !hobbySlug || !purpose.trim() || creating) return;
    setCreating(true);
    setError(null);
    const { circle, error: createError } = await createCircle({
      hobbySlug,
      name: name.trim(),
      location: location.trim() || undefined,
      purpose: purpose.trim(),
      prompt: prompt.trim(),
      visibility,
    });
    setCreating(false);
    if (!circle) {
      setError(createError ?? "Couldn't create that Circle.");
      return;
    }
    reset();
    onOpenChange(false);
    navigate(`/circles/${circle.id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Start a Circle</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            A smaller space built around doing one thing together.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="circle-name" className="mb-1.5 block text-xs">
              Name
            </Label>
            <Input
              id="circle-name"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="NYC Pottery Beginners"
            />
          </div>

          <div>
            <Label htmlFor="circle-space" className="mb-1.5 block text-xs">
              Space
            </Label>
            <Select value={hobbySlug} onValueChange={setHobbySlug}>
              <SelectTrigger id="circle-space">
                <SelectValue placeholder="Choose a Space" />
              </SelectTrigger>
              <SelectContent>
                {hobbies.map((h) => (
                  <SelectItem key={h.slug} value={h.slug}>
                    {h.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="circle-location" className="mb-1.5 block text-xs">
              Location <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="circle-location"
              value={location}
              maxLength={60}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Leave blank for a global Circle"
            />
          </div>

          <div>
            <Label htmlFor="circle-purpose" className="mb-1.5 block text-xs">
              Who this is for
            </Label>
            <Textarea
              id="circle-purpose"
              value={purpose}
              maxLength={200}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="For anyone in their first year of a hands-on craft, whatever the craft is."
              className="min-h-16"
            />
          </div>

          <div>
            <Label htmlFor="circle-prompt" className="mb-1.5 block text-xs">
              This week's prompt <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="circle-prompt"
              value={prompt}
              maxLength={120}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What are you working on this week?"
            />
          </div>

          <div>
            <Label htmlFor="circle-visibility" className="mb-1.5 block text-xs">
              Who can read it
            </Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
              <SelectTrigger id="circle-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open to read">Open to read — anyone can see threads</SelectItem>
                <SelectItem value="Members only">Members only — join to read threads</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Either way, anyone can join — there's no request-to-join step.
            </p>
          </div>

          {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}

          <Button
            variant="coral"
            className="w-full"
            disabled={!name.trim() || !hobbySlug || !purpose.trim() || creating}
            onClick={submit}
          >
            {creating ? "Creating…" : "Create Circle"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
