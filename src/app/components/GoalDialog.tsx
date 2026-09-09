import { useEffect, useState } from "react";
import { Hash, CalendarDays, Heart } from "lucide-react";
import { Goal, GoalShape, Project, setProjectGoal } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

const SHAPES: { value: GoalShape; title: string; example: string; icon: typeof Hash }[] = [
  { value: "number", title: "A number", example: "Finish 10 pieces, run 3 times a week", icon: Hash },
  { value: "date", title: "A date", example: "Ready for the fall market", icon: CalendarDays },
  { value: "feeling", title: "A feeling, not a number", example: "Comfortable enough to teach someone", icon: Heart },
];

function templateLabel(shape: GoalShape, targetNumber: string, unit: string, targetDate: string) {
  if (shape === "number" && targetNumber) {
    return `Finish ${targetNumber}${unit ? ` ${unit}` : ""}`;
  }
  if (shape === "date" && targetDate) {
    const d = new Date(targetDate);
    return `Ready by ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return "";
}

/**
 * Set Goals — an optional, single attribute on a Pursuit, not a new object
 * of its own. One active goal at a time (see journal.ts's setProjectGoal):
 * setting a new one archives the last rather than losing it.
 *
 * No percentages anywhere in this dialog or what it produces — a numeric
 * goal shows as plain-language progress ("3 of 10 pieces"), a date goal
 * just states the date, and "a feeling" never gets forced into a number at
 * all. That's deliberate: Quiet Milestones already set the precedent that
 * NoSpace doesn't scoreboard progress, and Goals shouldn't reintroduce it.
 */
export function GoalDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}) {
  const { user } = useAuth();
  const [shape, setShape] = useState<GoalShape>("number");
  const [targetNumber, setTargetNumber] = useState("");
  const [unit, setUnit] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [feeling, setFeeling] = useState("");
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = project?.goal;
    setShape(g?.shape ?? "number");
    setTargetNumber(g?.targetNumber != null ? String(g.targetNumber) : "");
    setUnit(g?.unit ?? "");
    setTargetDate(g?.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : "");
    setFeeling(g?.shape === "feeling" ? g.label : "");
    setLabel(g?.label ?? "");
    setLabelTouched(false);
  }, [open, project?.id]);

  // Keep the label following the other fields until someone edits it by hand.
  useEffect(() => {
    if (labelTouched) return;
    if (shape === "feeling") {
      setLabel(feeling);
      return;
    }
    const t = templateLabel(shape, targetNumber, unit, targetDate);
    if (t) setLabel(t);
  }, [shape, targetNumber, unit, targetDate, feeling, labelTouched]);

  if (!project) return null;

  const canSubmit =
    label.trim().length > 0 &&
    (shape !== "number" || targetNumber.trim().length > 0) &&
    (shape !== "date" || targetDate.trim().length > 0) &&
    (shape !== "feeling" || feeling.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const goal: Omit<Goal, "id" | "createdAt"> = {
      shape,
      label: label.trim(),
      targetNumber: shape === "number" ? Number(targetNumber) || undefined : undefined,
      unit: shape === "number" ? unit.trim() || undefined : undefined,
      current: shape === "number" ? project.goal?.current ?? 0 : undefined,
      targetDate: shape === "date" && targetDate ? new Date(targetDate).getTime() : undefined,
    };
    setProjectGoal(project.id, goal);
    if (user) {
      void mirrorPursuit(user.id, {
        ...project,
        goal: { ...goal, id: "", createdAt: Date.now() },
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {project.goal ? "Change your goal" : "Set a goal"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            For "{project.title}." Optional — skip anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            {SHAPES.map((s) => {
              const Icon = s.icon;
              const active = shape === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setShape(s.value)}
                  className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    active ? "border-[var(--coral-deep)] bg-surface-muted" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-[var(--forest-ink)]" strokeWidth={1.7} />
                  <span>
                    <span className="block text-sm">{s.title}</span>
                    <span className="block text-xs text-muted-foreground">{s.example}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {shape === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="goal-number" className="mb-1.5 block text-xs">Target</Label>
                <Input
                  id="goal-number"
                  type="number"
                  min={1}
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div>
                <Label htmlFor="goal-unit" className="mb-1.5 block text-xs">Unit</Label>
                <Input
                  id="goal-unit"
                  value={unit}
                  maxLength={30}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pieces, sessions…"
                />
              </div>
            </div>
          )}

          {shape === "date" && (
            <div>
              <Label htmlFor="goal-date" className="mb-1.5 block text-xs">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          )}

          {shape === "feeling" && (
            <div>
              <Label htmlFor="goal-feeling" className="mb-1.5 block text-xs">What does "there" look like?</Label>
              <Input
                id="goal-feeling"
                value={feeling}
                maxLength={80}
                onChange={(e) => setFeeling(e.target.value)}
                placeholder="Comfortable enough to teach someone else"
              />
            </div>
          )}

          <div>
            <Label htmlFor="goal-label" className="mb-1.5 block text-xs">
              How it'll read on your Pursuit
            </Label>
            <Input
              id="goal-label"
              value={label}
              maxLength={80}
              onChange={(e) => {
                setLabelTouched(true);
                setLabel(e.target.value);
              }}
            />
          </div>

          <Button variant="coral" className="w-full" disabled={!canSubmit} onClick={submit}>
            {project.goal ? "Save goal" : "Set goal"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            No percentages, no streaks. Just what you said you're going for.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
