import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * The sixteenth option.
 *
 * Fifteen categories will always be missing somebody's, and the honest
 * response to that is a way to say so rather than a nudge toward the nearest
 * wrong one. Nothing here blocks anyone: you can already create a post about
 * anything you like, whether or not a category exists for it. This is about
 * the map, not the territory.
 */
export function SuggestCategory({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { suggest, suggestions } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examples, setExamples] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const mine = suggestions.filter((s) => s.status === "pending");

  const reset = () => {
    setName("");
    setDescription("");
    setExamples("");
    setError(null);
    setSent(false);
    setBusy(false);
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await suggest({ name, description, examples });
      if (res.error) setError(res.error);
      else setSent(true);
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={`flex h-full min-h-[104px] w-full flex-col items-start justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface px-4 py-4 text-left transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] ${className}`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted">
          <Plus className="size-4 text-muted-foreground" />
        </span>
        <span className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
          Suggest a Category
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          Yours isn't here? Tell us what's missing.
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Suggest a Category
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Spaces are ways in, never a list you have to pick from. You can
              already post about anything. This is for when the list itself is
              missing something.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <p className="rounded-2xl bg-surface-muted px-4 py-4 text-sm leading-relaxed text-muted-foreground">
              Sign in to suggest one, so we can tell you what happened to it.
            </p>
          ) : sent ? (
            <>
              <div className="rounded-2xl bg-surface-muted px-4 py-4">
                <p className="mb-1 flex items-center gap-2 text-sm">
                  <Check className="size-4 text-[var(--forest)]" />
                  Sent for review.
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Someone will look at it and either add it, fold it into an
                  existing category, or explain why not. Either way you'll be
                  able to see the outcome here.
                </p>
              </div>
              <Button variant="outline" onClick={reset}>
                Suggest another
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="cat-name" className="mb-1.5 block text-sm">
                  Category or hobby name
                </Label>
                <Input
                  id="cat-name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Beekeeping"
                />
              </div>

              <div>
                <Label htmlFor="cat-desc" className="mb-1.5 block text-sm">
                  Short description
                </Label>
                <Textarea
                  id="cat-desc"
                  value={description}
                  maxLength={300}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One line on what belongs in it."
                  className="min-h-16"
                />
              </div>

              <div>
                <Label htmlFor="cat-eg" className="mb-1.5 block text-sm">
                  Examples <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="cat-eg"
                  value={examples}
                  maxLength={300}
                  onChange={(e) => setExamples(e.target.value)}
                  placeholder="Hive care, honey, swarms…"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-xs text-[var(--coral-text)]">
                  {error}
                </p>
              )}

              <Button
                className="w-full text-white [background-color:var(--forest)]"
                disabled={!name.trim() || busy}
                onClick={submit}
              >
                {busy ? "Sending…" : "Submit"}
              </Button>

              {mine.length > 0 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  You have {mine.length} suggestion{mine.length === 1 ? "" : "s"} waiting
                  on review.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
