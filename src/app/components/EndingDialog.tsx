import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useAuth } from "../context/AuthContext";
import { Project, finishProject, setEndingNote } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";

/**
 * Marking a Pursuit complete asks one question: "What would you tell
 * yourself on day one?" The answer sits at the top of the finished Pursuit
 * from then on. Skipping is fine — completing never depends on writing.
 *
 * `mode="edit"` reuses the same dialog to add or change the note on a
 * Pursuit that's already finished.
 */
export function EndingDialog({
  open,
  onOpenChange,
  project,
  mode = "finish",
  firstImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  mode?: "finish" | "edit";
  /** The Pursuit's first photo, shown as a reminder of day one. */
  firstImage?: string;
}) {
  const { user } = useAuth();
  const [note, setNote] = useState(project.endingNote ?? "");

  useEffect(() => {
    if (open) setNote(project.endingNote ?? "");
  }, [open, project.endingNote]);

  const save = (withNote: boolean) => {
    const text = withNote ? note : "";
    const updated =
      mode === "finish" ? finishProject(project.id, text) : setEndingNote(project.id, text);
    if (user && updated) void mirrorPursuit(user.id, updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {mode === "finish" ? `Finishing ${project.title}` : "A note to day one"}
          </DialogTitle>
          <DialogDescription>What would you tell yourself on day one?</DialogDescription>
        </DialogHeader>
        {firstImage && (
          <figure className="flex items-center gap-3">
            <img src={firstImage} alt="" className="size-16 rounded-lg object-cover" />
            <figcaption className="text-xs text-muted-foreground">Where you started.</figcaption>
          </figure>
        )}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          placeholder="It gets easier once you stop being precious about the paper…"
          rows={4}
          autoFocus
        />
        <DialogFooter className="gap-2 sm:gap-2">
          {mode === "finish" && (
            <Button variant="outline" onClick={() => save(false)}>
              Skip and finish
            </Button>
          )}
          <Button variant="coral" onClick={() => save(true)} disabled={mode === "edit" && note === (project.endingNote ?? "")}>
            {mode === "finish" ? "Finish" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
