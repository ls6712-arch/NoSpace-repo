import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  Copy,
  FolderPlus,
  Globe2,
  Hand,
  Heart,
  Lock,
  MessageCircle,
  Pencil,
  Trash2,
  Users,
  UserRound,
} from "lucide-react";
import { Post } from "../data/posts";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { getCircle } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useReactionState } from "./PostReactions";
import {
  CAPTION_SIZE,
  hasRealMedia,
  InlineBookmark,
  MEDIA_HEIGHT,
  OwnCountPill,
  tileTokenFor,
} from "./MomentCard";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { Thoughts } from "./Thoughts";
import { BePart } from "./BePart";
import { ConfirmDialog } from "./ConfirmDialog";
import { PursuitDialog } from "./PursuitDialog";
import { attachEntry, startProject, useJournal } from "../lib/journal";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** The audience words, identical to the ones chosen in the Log flow. */
const AUDIENCE: Record<string, { label: string; icon: typeof Globe2 }> = {
  public: { label: "Everyone", icon: Globe2 },
  circle: { label: "A Circle", icon: Users },
  friends: { label: "Connections", icon: UserRound },
};

function fullDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/**
 * One moment, opened. Shows the thing itself, what it belongs to, and — for
 * the owner only — the private reflection written alongside it.
 *
 * `owned` gates everything that changes or exposes the entry: the reflection,
 * editing, and attaching it to a project. On someone else's archive this is
 * a read-only view.
 */
export function MomentDetail({
  post,
  owned,
  onOpenChange,
}: {
  post: Post | null;
  owned: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePost, deletePost, ownCounts } = useContent();
  const { update: updatePrivateLogEntry, remove: removePrivateLogEntry } = usePrivateLogs();
  const journal = useJournal();
  const { mine: myReactions, toggle } = useReactionState(post?.id ?? 0);

  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingTo, setAddingTo] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [askTogetherOpen, setAskTogetherOpen] = useState(false);
  const [inspiredDialogOpen, setInspiredDialogOpen] = useState(false);

  useEffect(() => {
    if (!post) return;
    setCaption(post.caption);
    setReflection(post.reflection ?? "");
    setEditing(false);
    setSaveError(null);
    setCopied(false);
    setAddingTo(false);
    setConfirmDeleteOpen(false);
    setDeleteError(null);
  }, [post?.id]);

  if (!post) return null;

  const space = getHobby(post.hobbySlug);
  const hobbyLabel = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : null;
  const audience = AUDIENCE[post.visibility] ?? AUDIENCE.friends;
  const attachedId = journal.entryProject[String(post.id)];
  const attached = journal.projects.find((p) => p.id === attachedId);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);
  const isNote = !hasRealMedia(post);
  const tile = tileTokenFor(post.id);
  // Maker-only, same gate as MomentCard — missing entry reads as
  // all-zero, i.e. hidden, never a stray "0" (see ContentContext.ownCounts).
  const counts = ownCounts[post.id] ?? { love: 0, in: 0, thoughts: 0 };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = post.isPrivateLog
        ? Boolean((await updatePrivateLogEntry(post.privateLogId!, { note: caption })).data)
        : await updatePost(post.id, { caption, reflection });
      if (ok) setEditing(false);
      else setSaveError("Couldn't save that change. Your edit is still here, try again.");
    } catch {
      setSaveError("Couldn't reach the server. Your edit is still here, try again.");
    } finally {
      // Always runs, so the button can't stay stuck on "Saving…" and strand
      // an edit the person can no longer submit.
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    const ok = post.isPrivateLog
      ? (await removePrivateLogEntry(post.privateLogId!)).data === true
      : await deletePost(post.id);
    if (!ok) {
      setDeleteError("Couldn't delete that. Try again in a moment.");
      return;
    }
    setConfirmDeleteOpen(false);
    onOpenChange(false);
  };

  const share = async () => {
    // A link to this moment, not to the whole profile. Sharing "this" and
    // handing someone a person's front page is a small betrayal of the verb.
    const who = post.userId ?? post.creator;
    const url = `${window.location.origin}${window.location.pathname}#/u/${encodeURIComponent(
      who,
    )}?moment=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setSaveError("Couldn't copy the link. Your browser blocked clipboard access.");
    }
  };

  return (
    <Dialog open={!!post} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {hobbyLabel ?? space?.shortName ?? "Moment"}
          </DialogTitle>
          <DialogDescription>
            {hobbyLabel ? `${hobbyLabel} · ${space?.name}` : space?.name} · {fullDate(post.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {/* Who posted it — this dialog can now open from feeds that mix
            authors (Corner, Discover, CategoryFeed, Pursuit), so it can't
            assume "you already know whose page you're on" the way it
            could when every caller was your own Shelf or My Space. */}
        {!owned && (
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"} className="shrink-0">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">{initials(post.creator)}</AvatarFallback>
              </Avatar>
            </Link>
            <Link
              to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"}
              className="truncate text-base transition-colors hover:text-[var(--coral-text)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {post.creator}
            </Link>
          </div>
        )}

        {/* The moment itself — MomentCard's own media treatment (a
            carousel, or a colored tile with the caption set into it when
            there's no media), so the same Moment looks the same here as
            it does everywhere else it's shown. */}
        {isNote ? (
          <div
            className={`flex w-full items-center justify-center rounded-[var(--radius-moment)] p-6 sm:p-8 ${MEDIA_HEIGHT.lead}`}
            style={{ background: tile.bg, color: tile.fg }}
          >
            <p className={`text-center italic ${CAPTION_SIZE.lead}`} style={{ fontFamily: "var(--font-serif)" }}>
              {post.caption}
            </p>
          </div>
        ) : (
          <PostMediaCarousel
            media={post.mediaUrls?.length ? post.mediaUrls : [post.media]}
            type={post.type}
            hobbySlug={post.hobbySlug}
            seed={post.id}
            className={`w-full ${MEDIA_HEIGHT.lead} rounded-[var(--radius-moment)] object-cover`}
          />
        )}

        {!editing && !isNote && post.caption && (
          <p className={`italic ${CAPTION_SIZE.standard}`} style={{ fontFamily: "var(--font-serif)" }}>
            {post.caption}
          </p>
        )}

        {/* Reactions, the "make it together"/"inspired by this" hand-offs,
            and Thoughts (real comments) — none of these are meaningful on a
            private-log stand-in, which was never a real row anything could
            react to or comment on. */}
        {!editing && !post.isPrivateLog && (
          <>
            <div className="flex items-center gap-2">
              {owned ? (
                <>
                  <OwnCountPill icon={Heart} label="Love this" count={counts.love} />
                  <OwnCountPill icon={Hand} label="Count me in" count={counts.in} />
                  <OwnCountPill icon={MessageCircle} label="Thoughts" count={counts.thoughts} />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    aria-pressed={myReactions.includes("love")}
                    aria-label={`Love this${myReactions.includes("love") ? ", pressed" : ""}`}
                    title="Love this"
                    onClick={() => toggle("love")}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                      myReactions.includes("love")
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-border text-foreground hover:border-[var(--foreground)]/35"
                    }`}
                  >
                    <Heart
                      className="size-4"
                      strokeWidth={1.9}
                      fill={myReactions.includes("love") ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    aria-pressed={myReactions.includes("in")}
                    aria-label={`Count me in${myReactions.includes("in") ? ", pressed" : ""}`}
                    title="Count me in"
                    onClick={() => toggle("in")}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                      myReactions.includes("in")
                        ? "border-transparent [background-color:var(--moment-tile-moss)] [color:var(--moment-tile-moss-foreground)]"
                        : "border-border text-foreground hover:border-[var(--foreground)]/35"
                    }`}
                  >
                    <Hand
                      className="size-4"
                      strokeWidth={1.9}
                      fill={myReactions.includes("in") ? "currentColor" : "none"}
                    />
                  </button>
                  <InlineBookmark postId={post.id} />
                </>
              )}
            </div>

            {/* Same quiet hand-off as MomentCard's own grid cards — after
                the first "Count me in" tap, this reuses the existing
                make-together request instead of building a second flow. */}
            {!owned && myReactions.includes("in") && post.userId && (
              <button
                type="button"
                onClick={() => setAskTogetherOpen(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Ask {post.creator} to make it together?
              </button>
            )}

            {/* The one real (cross-user) way pursuits.inspired_by_post_id
                (sql/pursuits.sql) ever gets set to someone else's Moment —
                PursuitDialog's own seedPost prop already existed and already
                wired inspiredByPostId through, but until now nothing ever
                called it with another person's post: Log.tsx's "Start a
                Pursuit" only ever seeds from the Moment you're publishing
                yourself, and MomentDetail's owned-only "Add to Pursuit"
                action doesn't set inspiredByPostId at all. Without this,
                My Space's "You Inspired" rail could never have a real row to
                show — this button is what actually produces one. */}
            {!owned && (
              <button
                type="button"
                onClick={() => setInspiredDialogOpen(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Start a Pursuit — inspired by this
              </button>
            )}

            <Thoughts
              postId={post.id}
              postOwnerId={post.userId}
              postOwnerName={post.creator}
              isOwner={owned}
              privateThoughts={post.thoughtsPrivate}
              allowMedia={post.visibility === "circle"}
            />
          </>
        )}

        {!owned && (
          <BePart
            open={askTogetherOpen}
            onOpenChange={setAskTogetherOpen}
            hideTrigger
            initialPane="make_together"
            personName={post.creator}
            personId={post.userId}
            hobbySlug={post.hobbySlug}
            subSlug={post.subHobby}
            postId={post.id}
          />
        )}

        {!owned && (
          <PursuitDialog open={inspiredDialogOpen} onOpenChange={setInspiredDialogOpen} seedPost={post} />
        )}

        {editing && (
          <div className="space-y-3">
            <div>
              <label htmlFor="m-caption" className="mb-1.5 block text-xs text-muted-foreground">
                What you wrote
              </label>
              <Textarea
                id="m-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="m-reflection" className="mb-1.5 block text-xs text-muted-foreground">
                Private reflection, only you ever see this
              </label>
              <Textarea
                id="m-reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="coral" size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Where it sits */}
        <dl className="grid gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Hobby</dt>
            <dd>{hobbyLabel ? `${hobbyLabel} · ${space?.shortName}` : space?.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Who sees this</dt>
            <dd className="flex items-center gap-1.5">
              <audience.icon className="size-3" />
              {audience.label}
              {post.visibility === "circle" && post.circleId
                ? ` · ${getCircle(post.circleId)?.name ?? ""}`
                : ""}
            </dd>
          </div>
          {/* entryProject is local, per-browser data (see lib/journal.ts) —
              it can only ever answer for the signed-in viewer's own
              Pursuits, never for whoever actually posted this Moment. On
              someone else's Moment this always read "Not part of a
              Pursuit," even when it demonstrably was one, which
              contradicted the Pursuit info this page already shows
              correctly elsewhere (PublicProfile's own shared-Pursuits
              fetch). Owner-only, like everything else this lookup could
              get right. */}
          {owned && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Pursuit</dt>
              <dd>{attached ? attached.title : "Not part of a Pursuit"}</dd>
            </div>
          )}
        </dl>

        {/* Owner-only: the note they wrote for themselves */}
        {owned && !editing && post.reflection && (
          <div className="rounded-2xl border border-[var(--hairline)] bg-card px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="size-3" />
              Private reflection, only you
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{post.reflection}</p>
          </div>
        )}

        {saveError && <p className="text-xs text-[var(--coral-text)]">{saveError}</p>}
        {deleteError && <p className="text-xs text-[var(--coral-text)]">{deleteError}</p>}

        {/* Actions */}
        {owned && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingTo((v) => !v)}>
              <FolderPlus className="size-3.5" />
              {attached ? "Move to another Pursuit" : "Add to Pursuit"}
            </Button>
            <Button variant="outline" size="sm" onClick={share}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Link copied" : "Share this moment"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        )}

        {addingTo && (
          <div className="space-y-2 rounded-2xl border border-border px-4 py-3">
            {openProjects.length === 0 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  You don't have a Pursuit yet. Starting one from here files this
                  moment as its first update.
                </p>
                <Button
                  variant="coral"
                  size="sm"
                  onClick={() => {
                    const project = startProject({
                      title: hobbyLabel ?? space?.shortName ?? "New Pursuit",
                      hobbySlug: post.hobbySlug,
                      subHobby: post.subHobby,
                    });
                    attachEntry(post.id, project.id);
                    setAddingTo(false);
                  }}
                >
                  Start "{hobbyLabel ?? space?.shortName}" as a Pursuit
                </Button>
              </>
            ) : (
              <Select
                value={attachedId ?? undefined}
                onValueChange={(v) => {
                  attachEntry(post.id, v);
                  setAddingTo(false);
                }}
              >
                <SelectTrigger>
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
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this Moment?"
        description="This can't be undone — the photo, caption, and any thoughts on it are gone for good."
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}
