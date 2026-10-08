import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, Lock, Send, Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Project, ProgressEntry, setProjectShared, useJournalSlice } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { hasMeasure, summarize } from "../lib/pursuitProgress";
import { PostMedia } from "./PostMedia";
import { ProgressRing, PURSUIT_SPRING } from "./pursuit/ui";
import { SendToChatDialog } from "./SendToChatDialog";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { track } from "../lib/analytics";

const NO_PROGRESS: ProgressEntry[] = [];

/**
 * The one Pursuit-sharing surface, opened the same way from every place a
 * Pursuit shows up (its own page, a card in "Pursuits in progress", a row in
 * "All your Pursuits") instead of each surface wiring its own copy of the
 * old "Share"/"Send to…" button pair. Replaces that pair entirely — it was
 * two separate, easy-to-miss outline buttons; this is one entry point with
 * a real preview of what gets shared, same visual language
 * ShareMilestoneDialog already uses (gradient-bordered card).
 *
 * Three channels, each real:
 *  - Copy link: turns on the Pursuit's own public link (if it wasn't on
 *    already — setProjectShared + mirrorPursuit, same as the old toggle)
 *    and copies it. A creator can also switch it back off from here.
 *  - Native share sheet (navigator.share): the one place this app can
 *    actually hand off to "social media platforms or email" — there's no
 *    per-platform API integration here, nor should there be; the OS share
 *    sheet already knows every app installed on the device, which a
 *    hand-built platform list never could.
 *  - Send to a chat: unchanged from before, just folded in here instead of
 *    living as its own separate button — opens the existing
 *    SendToChatDialog once this one closes.
 *
 * The preview card's progress ring/line is computed here (same
 * hasMeasure+summarize pair PursuitItem.tsx already uses), not passed in —
 * every call site shares one source of truth rather than three copies of
 * the same math, and it's left off entirely for a Pursuit with no
 * measurable goal, same "nothing honest to report, so report nothing" rule
 * PursuitItem already follows. Never a bare percentage, same as everywhere
 * else.
 */
export function PursuitShareDialog({
  open,
  onOpenChange,
  project,
  coverImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  /** Already-resolved cover URL, if the caller has one (PursuitItem does) —
   * this dialog never fetches/signs a path itself. */
  coverImage?: string;
}) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [justCopied, setJustCopied] = useState(false);
  const [sendToOpen, setSendToOpen] = useState(false);

  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(project)
    ? summarize(project.measure!, allProgress.filter((e) => e.projectId === project.id))
    : undefined;
  const fraction = measured ? measured.fraction : undefined;
  const progressLabel = measured
    ? `${measured.current} of ${measured.target}${project.measure!.unit ? ` ${project.measure!.unit}` : ""}`
    : undefined;

  // Only the Pursuit's own creator can turn its public link on/off — same
  // gate Pursuit.tsx's own Share button used (a member of a group Pursuit
  // can still copy/send an already-shared link, just never flip it).
  const isCreator = project.role !== "member";

  // Hash-router URL built explicitly, not window.location.href: this dialog
  // can now open from pages other than the Pursuit's own (a card on My
  // Space, a row in All your Pursuits), where location.href is that page's
  // URL, not the Pursuit's.
  const shareUrl = `${window.location.origin}${window.location.pathname}#/pursuit/${project.id}`;

  const setShared = (next: boolean) => {
    setProjectShared(project.id, next);
    if (user) void mirrorPursuit(user.id, { ...project, shared: next });
  };

  const copyLink = async () => {
    if (!project.shared) setShared(true);
    track({ name: "pursuit_share_link_copied", pursuitId: project.id });
    try {
      await navigator.clipboard.writeText(shareUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable — the Pursuit is shared either way.
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const nativeShare = async () => {
    if (!project.shared) setShared(true);
    track({ name: "pursuit_share_native_sheet_opened", pursuitId: project.id });
    try {
      await navigator.share({ title: project.title, url: shareUrl });
    } catch {
      // User backed out of the share sheet, or it's unsupported here —
      // either way there's nothing to recover from, the link is still on.
    }
  };

  const canCopyOrShare = isCreator || !!project.shared;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Share {project.title}</DialogTitle>

          <div className="rounded-card p-[1.5px] [background-image:var(--gradient-brand)]">
            <div className="overflow-hidden rounded-card bg-[var(--surface)]">
              <div className="relative aspect-[16/10] w-full">
                <PostMedia
                  media={coverImage}
                  type="photo"
                  hobbySlug={project.hobbySlug ?? "crafts-making"}
                  seed={project.id}
                  preview
                  className="h-full w-full object-cover"
                />
                {hasMeasure(project) && fraction != null && (
                  <ProgressRing
                    fraction={fraction}
                    size={40}
                    strokeWidth={3.5}
                    className="absolute -bottom-5 left-4 rounded-full bg-card ring-4 ring-card"
                  />
                )}
              </div>
              <div className={`px-5 pb-5 ${hasMeasure(project) && fraction != null ? "pt-7" : "pt-4"}`}>
                <h3 className="text-lead leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                  {project.title}
                </h3>
                {progressLabel && <p className="mt-0.5 text-caption text-muted-foreground">{progressLabel}</p>}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 px-1">
            <Button variant={project.shared ? "outline" : "brand"} onClick={copyLink} disabled={!canCopyOrShare}>
              <motion.span
                className="flex items-center gap-2"
                initial={false}
                animate={justCopied && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ ...PURSUIT_SPRING, duration: 0.3 }}
              >
                {justCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {justCopied ? "Link copied" : "Copy link"}
              </motion.span>
            </Button>

            {canNativeShare && (
              <Button variant="outline" onClick={nativeShare} disabled={!canCopyOrShare}>
                <Share2 className="size-4" />
                Share
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSendToOpen(true);
              }}
            >
              <Send className="size-4" />
              Send to a chat
            </Button>

            {isCreator && project.shared && (
              <button
                type="button"
                onClick={() => setShared(false)}
                className="mt-1 flex items-center justify-center gap-1.5 text-caption text-muted-foreground hover:text-foreground hover:underline"
              >
                <Lock className="size-3" />
                Make private
              </button>
            )}
          </div>

          <p className="mt-3 px-1 text-center text-caption text-muted-foreground">
            {!isCreator && !project.shared
              ? "Only the Pursuit’s owner can turn on its link."
              : project.shared
                ? "Anyone with the link can view this Pursuit."
                : "Copying the link or sharing turns it on for this Pursuit only."}
          </p>
        </DialogContent>
      </Dialog>

      <SendToChatDialog open={sendToOpen} onOpenChange={setSendToOpen} kind="pursuit" pursuitId={project.id} />
    </>
  );
}
