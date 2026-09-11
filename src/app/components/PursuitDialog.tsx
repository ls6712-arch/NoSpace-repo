import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Hash, Sparkles } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { Post } from "../data/posts";
import { GoalShape, setProjectGoal, startProject } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { useCorners, isDiscoverable } from "../context/CornersContext";
import { bestMatch } from "../lib/tagMatching";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const OTHER = "__other__";

/**
 * Which Corner this Pursuit belongs to — free text, same spirit as
 * InterestField: suggestions from real Corners (that Space's own if one's
 * chosen, otherwise everything across all Spaces) so near-duplicate
 * spellings tend to converge, but never validated against them and never
 * creating anything just by typing. A Pursuit's Corner is a description,
 * not a tag — CornerTagField's create-a-Corner side effect belongs to
 * actually tagging a Moment, not to naming a Pursuit.
 */
function CornerField({
  spaceSlug,
  value,
  onChange,
}: {
  spaceSlug: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { cornersFor } = useCorners();
  const [focused, setFocused] = useState(false);

  // A Corner-scoped vocabulary, not the composer's interest one
  // (useKnownInterests) — a Pursuit's Corner describes which real Corner it
  // sits nearest to, so the pool to check against is real Corners
  // (that Space's own if one's chosen, otherwise every discoverable Corner
  // across all Spaces), not the broader interest/hobby/category blend.
  const known = useMemo(() => {
    const slugs = spaceSlug && spaceSlug !== OTHER ? [spaceSlug] : hobbies.map((h) => h.slug);
    const seen = new Map<string, string>();
    for (const slug of slugs) {
      for (const corner of cornersFor(slug).filter(isDiscoverable)) {
        const key = corner.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, corner.name);
      }
    }
    return [...seen.values()];
  }, [cornersFor, spaceSlug]);

  const query = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const pool = query
      ? known.filter((k) => k.toLowerCase().includes(query) && k.toLowerCase() !== query)
      : known;
    return pool.slice(0, 8);
  }, [known, query]);

  // Same "does this already exist?" check every other free-text tag entry
  // point uses (lib/tagMatching.ts). A close-but-not-exact hit is only ever
  // a suggestion here — naming a Pursuit's Corner never creates or
  // validates anything, so there's nothing to block.
  const closeMatch = useMemo(() => {
    const match = bestMatch(value, known);
    return match && match.kind !== "exact" ? match : null;
  }, [value, known]);

  return (
    <div className="relative">
      <Input
        id="pursuit-corner"
        value={value}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder="Pottery, DJing, bookbinding…"
      />
      {!value.trim() && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Anything you like, not listed? Enter your own.
        </p>
      )}
      {closeMatch && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Close to “{closeMatch.label}” —{" "}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(closeMatch.label)}
            className="text-[var(--coral-text)] underline decoration-dotted underline-offset-2"
          >
            use that instead
          </button>
          , or keep typing your own.
        </p>
      )}
      {focused && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover py-1 shadow-xl">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setFocused(false);
                }}
                className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Add to Your Pursuits — the whole point is that a Pursuit needs nothing but
 * a name. Corner and Space are both optional, both free-text at heart
 * (Space offers NoSpace's real Spaces as a shortcut, with "Other" for
 * anything that isn't one), and neither is validated against a taxonomy.
 * This is deliberately not the full Log flow: no photo, no audience, no
 * caption — just naming the thing you're about to start, plus an optional
 * goal (also always editable later, from the Pursuit's own page).
 */
export function PursuitDialog({
  open,
  onOpenChange,
  seedPost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Try This'd creation this Pursuit grew out of, if any — seeds the
   * name and Corner, and rides along as the card's inspiration image. */
  seedPost?: Post | null;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [corner, setCorner] = useState("");
  const [spaceSlug, setSpaceSlug] = useState<string>("");
  const [customSpace, setCustomSpace] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalShape, setGoalShape] = useState<Extract<GoalShape, "number" | "date">>("number");
  const [goalTargetNumber, setGoalTargetNumber] = useState("");
  const [goalUnit, setGoalUnit] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(seedPost ? seedPost.caption.split(".")[0].slice(0, 60).trim() : "");
    setCorner(seedPost?.interest ?? "");
    setSpaceSlug(seedPost?.hobbySlug ?? "");
    setCustomSpace("");
    setGoalOpen(false);
    setGoalShape("number");
    setGoalTargetNumber("");
    setGoalUnit("");
    setGoalTargetDate("");
  }, [open, seedPost]);

  const isOther = spaceSlug === OTHER;

  const goalReady =
    !goalOpen ||
    (goalShape === "number" ? goalTargetNumber.trim().length > 0 : goalTargetDate.trim().length > 0);

  const submit = () => {
    const name = title.trim();
    if (!name || !goalReady) return;
    const project = startProject({
      title: name,
      hobbySlug: spaceSlug && !isOther ? spaceSlug : undefined,
      interest: corner.trim() || undefined,
      customSpace: isOther ? customSpace.trim() || undefined : undefined,
      inspiredByPostId: seedPost?.id,
      shared: false,
    });

    if (goalOpen) {
      const goal =
        goalShape === "number"
          ? {
              shape: "number" as const,
              label: `Finish ${goalTargetNumber.trim()}${goalUnit.trim() ? ` ${goalUnit.trim()}` : ""}`,
              targetNumber: Number(goalTargetNumber) || undefined,
              unit: goalUnit.trim() || undefined,
              current: 0,
            }
          : {
              shape: "date" as const,
              label: `Ready by ${new Date(goalTargetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
              targetDate: new Date(goalTargetDate).getTime(),
            };
      setProjectGoal(project.id, goal);
      project.goal = { ...goal, id: "", createdAt: Date.now() };
    }

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
              style={{ backgroundColor: "color-mix(in srgb, var(--pastel-clay) 42%, var(--surface-elevated))" }}
            >
              <Sparkles className="size-4 text-foreground" strokeWidth={1.7} />
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
            <Label htmlFor="pursuit-corner" className="mb-1.5 block text-xs">
              Which Corner does this belong to? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <CornerField spaceSlug={spaceSlug} value={corner} onChange={setCorner} />
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

          <div className="rounded-2xl border border-dashed border-border">
            <button
              type="button"
              onClick={() => setGoalOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{goalOpen ? "Set a goal" : "+ Set a goal (optional)"}</span>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${goalOpen ? "rotate-180" : ""}`} />
            </button>
            {goalOpen && (
              <div className="space-y-3 border-t border-[var(--hairline)] px-3.5 py-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGoalShape("number")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
                      goalShape === "number" ? "border-[var(--coral-deep)] bg-surface-muted" : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <Hash className="size-3.5" /> A number of sessions
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalShape("date")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
                      goalShape === "date" ? "border-[var(--coral-deep)] bg-surface-muted" : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <CalendarDays className="size-3.5" /> A target date
                  </button>
                </div>
                {goalShape === "number" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pursuit-goal-number" className="mb-1.5 block text-xs">Target</Label>
                      <Input
                        id="pursuit-goal-number"
                        type="number"
                        min={1}
                        value={goalTargetNumber}
                        onChange={(e) => setGoalTargetNumber(e.target.value)}
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pursuit-goal-unit" className="mb-1.5 block text-xs">Unit</Label>
                      <Input
                        id="pursuit-goal-unit"
                        value={goalUnit}
                        maxLength={30}
                        onChange={(e) => setGoalUnit(e.target.value)}
                        placeholder="sessions, pieces…"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="pursuit-goal-date" className="mb-1.5 block text-xs">Target date</Label>
                    <Input
                      id="pursuit-goal-date"
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  No percentages, no streaks. You can add or change this later from the Pursuit's own page, too.
                </p>
              </div>
            )}
          </div>

          <Button variant="coral" className="w-full" disabled={!title.trim() || !goalReady} onClick={submit}>
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
