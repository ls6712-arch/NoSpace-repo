import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Flag, Globe2, Link2, MessageCircle, MoreHorizontal, Pencil, Target, Trash2, type LucideIcon } from "lucide-react";
import type { Post } from "../../data/posts";
import { subHobbyLabel } from "../../data/hobbies";
import { useAuth } from "../../context/AuthContext";
import { useContent } from "../../context/ContentContext";
import { usePrivateLogs } from "../../context/PrivateLogsContext";
import { useSocial } from "../../context/SocialContext";
import { messageTabFor } from "../../lib/messageTabs";
import { attachEntry, startProject, useJournal } from "../../lib/journal";
import { isOnlyYou, MOMENT_VISIBILITY_OPTIONS } from "../../lib/visibility";
import { isDismissKey } from "../../lib/menuDismiss";
import { useWide } from "../../lib/useMediaQuery";
import { ERROR_LINE, TOAST } from "../../lib/stateCopy";
import { notify, notifyError } from "../ui/toaster";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { AddDetailsSheet } from "../AddDetailsSheet";
import { ConfirmDialog } from "../ConfirmDialog";
import { ReportDialog } from "../ReportDialog";
import { momentLink } from "./momentMeta";

export type MomentMenuAction = "message" | "copy" | "report" | "details" | "pursuit" | "audience" | "delete";

export interface MomentMenuItem {
  action: MomentMenuAction;
  label: string;
  icon: LucideIcon;
  /** Report and Delete read in the accent color. */
  strong?: boolean;
}

/**
 * The one list behind ⋯, by whose Moment it is. Pure, so the two lists are
 * tested without opening anything.
 *
 * - Someone else's: Message {name} about this, Copy link, Report.
 * - Your own: Add details, Add to Pursuit (or Move to another Pursuit),
 *   Change who sees this, Copy link, Delete.
 */
export function momentMenuItems({
  post,
  mine,
  inPursuit,
}: {
  post: Pick<Post, "creator" | "userId" | "isPrivateLog" | "visibility">;
  mine: boolean;
  /** Your own Moment already counts toward one of your Pursuits. */
  inPursuit: boolean;
}): MomentMenuItem[] {
  if (!mine) {
    // Messaging and reporting need to know who it is; a Moment with no account behind it has neither.
    const person: MomentMenuItem[] = post.userId
      ? [{ action: "message", label: `Message ${post.creator} about this`, icon: MessageCircle }]
      : [];
    const report: MomentMenuItem[] = post.userId ? [{ action: "report", label: "Report", icon: Flag, strong: true }] : [];
    return [...person, { action: "copy", label: "Copy link", icon: Link2 }, ...report];
  }
  // A private-log stand-in is not a row in posts: it has no audience to change and no link to copy.
  const real = !post.isPrivateLog;
  return [
    { action: "details", label: "Add details", icon: Pencil },
    { action: "pursuit", label: inPursuit ? "Move to another Pursuit" : "Add to Pursuit", icon: Target },
    ...(real ? ([{ action: "audience", label: "Change who sees this", icon: Globe2 }] satisfies MomentMenuItem[]) : []),
    ...(real && !isOnlyYou(post) ? ([{ action: "copy", label: "Copy link", icon: Link2 }] satisfies MomentMenuItem[]) : []),
    { action: "delete", label: "Delete", icon: Trash2, strong: true },
  ];
}

/** "Change who sees this": the three audiences a posted Moment can move between. */
export function VisibilityDialog({ post, open, onOpenChange }: { post: Post; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { updatePost } = useContent();
  const [value, setValue] = useState<"just_me" | "followers" | "public">(
    isOnlyYou(post) ? "just_me" : post.visibility === "followers" ? "followers" : "public",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const ok = await updatePost(post.id, { visibility: value });
    setSaving(false);
    if (!ok) {
      setError(ERROR_LINE);
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Who sees this</DialogTitle>
          <DialogDescription>Changes who can find this Moment from now on.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={value} onValueChange={(v) => setValue(v as typeof value)} className="space-y-2">
          {MOMENT_VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3 py-2.5 text-small has-[[data-state=checked]]:border-[var(--accent-text)]"
            >
              <RadioGroupItem value={opt.value} id={`vis-${opt.value}`} />
              <opt.icon className="size-4 shrink-0 text-muted-foreground" />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
        {error && <p className="text-caption text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button busy={saving} variant="coral" size="sm" onClick={save} disabled={saving}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Add to Pursuit" / "Move to another Pursuit": pick one of your open Pursuits, or start one from this Moment. */
function PursuitPickDialog({ post, open, onOpenChange, title }: { post: Post; open: boolean; onOpenChange: (open: boolean) => void; title: string }) {
  const journal = useJournal();
  const attachedId = journal.entryProject[String(post.id)];
  const openProjects = journal.projects.filter((p) => !p.finishedAt);
  const cornerLabel = post.subHobby ? (subHobbyLabel(post.subHobby) ?? post.subHobby) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {openProjects.length === 0 ? (
          <>
            <p className="text-caption text-muted-foreground">You don’t have a Pursuit yet. Starting one from here files this Moment as its first update.</p>
            <Button
              variant="coral"
              size="sm"
              onClick={() => {
                const project = startProject({ title: cornerLabel ?? "New Pursuit", hobbySlug: post.hobbySlug, subHobby: post.subHobby });
                attachEntry(post.id, project.id);
                onOpenChange(false);
              }}
            >
              Start a Pursuit
            </Button>
          </>
        ) : (
          <Select
            value={attachedId ?? undefined}
            onValueChange={(v) => {
              attachEntry(post.id, v);
              onOpenChange(false);
            }}
          >
            <SelectTrigger aria-label="Choose a Pursuit">
              <SelectValue placeholder="Choose a Pursuit" />
            </SelectTrigger>
            <SelectContent>
              {openProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ROW = "flex min-h-14 w-full items-center gap-3.5 px-1 text-left text-body font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The ⋯ button on a Moment and the one list behind it: a sheet from the bottom
 * on a phone, a small menu under the button from tablet width up. Everything a
 * row opens (the report form, who sees this, the delete check) lives here too,
 * so every surface gets the same menu by rendering this once.
 */
export function MomentMenu({
  post,
  mine,
  /** Called after your Moment is deleted, so an opened Moment can close. */
  onDeleted,
  /** Opens "Change who sees this" from outside (the audience label in the header). */
  audienceOpen,
  onAudienceOpenChange,
}: {
  post: Post;
  mine: boolean;
  onDeleted?: () => void;
  audienceOpen: boolean;
  onAudienceOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { deletePost } = useContent();
  const { remove: removePrivateLogEntry } = usePrivateLogs();
  const social = useSocial();
  const journal = useJournal();
  const navigate = useNavigate();
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pursuitOpen, setPursuitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const inPursuit = !!journal.entryProject[String(post.id)];
  const items = momentMenuItems({ post, mine, inPursuit });
  const pursuitLabel = inPursuit ? "Move to another Pursuit" : "Add to Pursuit";

  // The small menu closes on a click outside it or on Escape.
  useEffect(() => {
    if (!open || !wide) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isDismissKey(e.key)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, wide]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(momentLink(post.id));
      notify(TOAST.linkCopied);
    } catch {
      notifyError(ERROR_LINE);
    }
  };

  const message = () => {
    if (!post.userId) return;
    // An open chat gets the Moment attached; a first message goes as a request, which cannot carry one.
    const existing = social.findExistingThread(post.userId);
    if (existing && user && messageTabFor(existing, user.id) === "chats") {
      navigate(`/messages?thread=${existing.id}&shareMoment=${post.id}`);
      return;
    }
    navigate(`/messages?draftWith=${encodeURIComponent(post.userId)}&draftName=${encodeURIComponent(post.creator)}&aboutMomentId=${post.id}`);
  };

  const run = (action: MomentMenuAction) => {
    setOpen(false);
    if (action === "message") message();
    else if (action === "copy") void copy();
    else if (action === "report") setReportOpen(true);
    else if (action === "details") setDetailsOpen(true);
    else if (action === "pursuit") setPursuitOpen(true);
    else if (action === "audience") onAudienceOpenChange(true);
    else if (action === "delete") setDeleteOpen(true);
  };

  const remove = async () => {
    const ok = post.isPrivateLog ? (await removePrivateLogEntry(post.privateLogId!)).data === true : await deletePost(post.id);
    if (!ok) {
      notifyError(ERROR_LINE);
      return;
    }
    setDeleteOpen(false);
    onDeleted?.();
  };

  const rows = (
    <ul className="flex flex-col divide-y divide-border" data-moment-menu={mine ? "own" : "theirs"}>
      {items.map((item) => (
        <li key={item.action}>
          <button type="button" role="menuitem" onClick={() => run(item.action)} className={`${ROW} ${item.strong ? "text-[var(--accent-text)]" : "text-foreground"}`}>
            <item.icon className="size-[22px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2.5 flex size-11 items-center justify-center rounded-control text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="size-[22px]" aria-hidden="true" />
      </button>

      {wide ? (
        open && (
          <div role="menu" aria-label="More" className="absolute right-0 top-full z-40 w-72 overflow-hidden rounded-card border border-border bg-popover px-3 shadow-overlay">
            {rows}
          </div>
        )
      ) : (
        <BottomSheet open={open} onOpenChange={setOpen} title="More" hideTitle focusContent>
          <div role="menu" aria-label="More">
            {rows}
          </div>
        </BottomSheet>
      )}

      {mine && (
        <>
          <VisibilityDialog key={`${post.id}-${post.visibility}`} post={post} open={audienceOpen} onOpenChange={onAudienceOpenChange} />
          <AddDetailsSheet key={`details-${post.id}-${detailsOpen}`} post={post} open={detailsOpen} onOpenChange={setDetailsOpen} editWords />
          <PursuitPickDialog post={post} open={pursuitOpen} onOpenChange={setPursuitOpen} title={pursuitLabel} />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete this Moment?"
            description="This can’t be undone. The photo, caption, and any thoughts on it are deleted."
            onConfirm={remove}
          />
        </>
      )}
      {!mine && post.userId && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetUserId={post.userId} targetKind="moment" targetId={post.id} personName={post.creator} />
      )}
    </div>
  );
}
