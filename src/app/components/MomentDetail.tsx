import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { pursuitTogetherHref } from "../lib/pursuitsRemote";
import {
  Check,
  Copy,
  Flag,
  FolderPlus,
  Globe2,
  Lock,
  MessageCircle,
  Pencil,
  Send,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { Post } from "../data/posts";
import { getHobby, subHobbyLabel, visibleSpaces } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { messageTabFor } from "../lib/messageTabs";
import { supabase } from "../../lib/supabase";
import { useReactionState } from "../lib/reactionState";
import { convertHeicIfNeeded, isHeicFile } from "../lib/heicConversion";
import { uploadMomentFile } from "../lib/momentMedia";
import { SendToChatDialog } from "./SendToChatDialog";
import { AddDetailsSheet } from "./AddDetailsSheet";
import {
  BookmarkOverlay,
  CARD_CAPTION,
  hasRealMedia,
  MomentActions,
  MomentMedia,
  tileTokenFor,
} from "./MomentCard";
import { Thoughts } from "./Thoughts";
import { BePart } from "./BePart";
import { ConfirmDialog } from "./ConfirmDialog";
import { PursuitDialog } from "./PursuitDialog";
import { ReportDialog } from "./ReportDialog";
import { attachEntry, startProject, useJournal } from "../lib/journal";
import { isOnlyYou } from "../lib/visibility";
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
import { formatDate } from "../lib/dates";

/** The audience words, identical to the ones chosen in the Log flow. */
const AUDIENCE: Record<string, { label: string; icon: typeof Globe2 }> = {
  public: { label: "Everyone", icon: Globe2 },
  followers: { label: "Followers", icon: UserRound },
};

function fullDate(ts: number) {
  return formatDate(ts, { weekday: "long", month: "long" });
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
  post: openPost,
  owned,
  onOpenChange,
  replyOpen = false,
}: {
  post: Post | null;
  owned: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open with the reply box already showing (MomentPage's ?reply=1). */
  replyOpen?: boolean;
}) {
  // Keep showing the last Moment while the dialog animates closed; without
  // this the parent clearing `post` unmounts it mid-exit.
  const lastPost = useRef<Post | null>(openPost);
  if (openPost) lastPost.current = openPost;
  const post = openPost ?? lastPost.current;
  const { updatePost, deletePost } = useContent();
  const { update: updatePrivateLogEntry, remove: removePrivateLogEntry } = usePrivateLogs();
  const { user } = useAuth();
  const social = useSocial();
  const navigate = useNavigate();
  const journal = useJournal();
  const { mine: myReactions } = useReactionState(post?.id ?? 0);

  const [sendToOpen, setSendToOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [reflection, setReflection] = useState("");
  const [editHobbySlug, setEditHobbySlug] = useState("");
  const [editSubHobby, setEditSubHobby] = useState("");
  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
  const [newMediaPreview, setNewMediaPreview] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingTo, setAddingTo] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [askTogetherOpen, setAskTogetherOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspiredDialogOpen, setInspiredDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!post) return;
    setCaption(post.caption);
    setReflection(post.reflection ?? "");
    setEditHobbySlug(post.hobbySlug);
    setEditSubHobby(post.subHobby ?? "");
    setNewMediaFile(null);
    setNewMediaPreview(null);
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
  // "Only you" Moments (private-log stand-ins, never a real posts row — see
  // lib/visibility.ts's own comment) carry visibility "private" or
  // "just_me", neither of which AUDIENCE maps — falling through to its
  // ?? default used to mislabel them "Followers".
  const audience = isOnlyYou(post) ? { label: "Only you", icon: Lock } : AUDIENCE[post.visibility] ?? AUDIENCE.followers;
  const attachedId = journal.entryProject[String(post.id)];
  const attached = journal.projects.find((p) => p.id === attachedId);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);
  const isNote = !hasRealMedia(post);
  const tile = tileTokenFor(post.id);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Only set when a replacement photo was actually picked this time —
      // updatePost only overwrites the photo when mediaPath is present, so
      // an edit that doesn't touch the photo never risks blanking it out.
      // Never attempted at all for a private-log stand-in (post.isPrivateLog):
      // it isn't a real posts row, updatePost wouldn't touch it, and there's
      // no reason to spend an upload on a result that gets thrown away.
      let uploadedMediaPath: string | undefined;
      if (newMediaFile && supabase && user && !post.isPrivateLog) {
        setUploadingMedia(true);
        // Step 1: a real Moment's photo goes to the private moment-media
        // bucket, keyed by storage path — see momentMedia.ts.
        const { path, error: uploadError } = await uploadMomentFile(user.id, newMediaFile);
        setUploadingMedia(false);
        if (uploadError || !path) {
          setSaveError("Your photo didn’t upload. Try again.");
          setSaving(false);
          return;
        }
        uploadedMediaPath = path;
      }

      const ok = post.isPrivateLog
        ? Boolean((await updatePrivateLogEntry(post.privateLogId!, { note: caption })).data)
        : await updatePost(post.id, {
            caption,
            reflection,
            hobbySlug: editHobbySlug,
            subHobby: editSubHobby || undefined,
            ...(uploadedMediaPath ? { mediaPath: uploadedMediaPath } : {}),
          });
      if (ok) setEditing(false);
      else setSaveError("Couldn’t save that change. Your edit is still here. Try again.");
    } catch {
      setSaveError("Couldn’t reach the server. Your edit is still here. Try again.");
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
      setDeleteError("Couldn’t delete that. Try again in a moment.");
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
      setSaveError("Couldn’t copy the link. Your browser blocked clipboard access.");
    }
  };

  return (
    <Dialog open={!!openPost} onOpenChange={onOpenChange}>
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
        {/* Same square as every card, capped so it fits a laptop screen
            without scrolling. Save sits on the media, same as the grid. */}
        <div className="relative mx-auto w-full max-w-[min(100%,62vh)]">
          <MomentMedia post={post} />
          {!owned && !post.isPrivateLog && (
            <BookmarkOverlay postId={post.id} tone={isNote ? tile.fg : undefined} />
          )}
        </div>

        {!editing && !isNote && post.caption && (
          <p className={`${CARD_CAPTION} line-clamp-none min-h-0`} style={{ fontFamily: "var(--font-serif)" }}>
            {post.caption}
          </p>
        )}

        {/* Reactions, the "make it together"/"inspired by this" hand-offs,
            and Thoughts (real comments) — none of these are meaningful on a
            private-log stand-in, which was never a real row anything could
            react to or comment on. */}
        {!editing && !post.isPrivateLog && (
          <>
            <MomentActions post={post} mine={owned} />

            {/* Same quiet hand-off as MomentCard's own grid cards — after
                the first "Count me in" tap, this reuses the existing
                make-together request instead of building a second flow. */}
            {!owned && myReactions.includes("in") && post.userId && (
              <div className="flex flex-col items-start gap-0.5">
                {/* Step 4c: Count me in → do it together, as a shared Pursuit. */}
                <Link
                  to={pursuitTogetherHref(post)}
                  className="text-xs font-medium text-foreground transition-colors hover:underline"
                >
                  Start a Pursuit with {post.creator}?
                </Link>
                <button
                  type="button"
                  onClick={() => setAskTogetherOpen(true)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                >
                  Ask {post.creator} to make it together?
                </button>
              </div>
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

            {/* Send to… — available whether or not you own it (sharing your
                own Moment into a chat is just as ordinary as sharing
                someone else's). The card that shows up on the other end
                reloads it under THEIR permissions, not this viewer's — see
                docs/communication-strategy.md's Phase 4 "Not available"
                requirement and SharedContentCard.tsx. Not offered at all
                for an "Only you" Moment (a real just_me post — a private-
                log stand-in never reaches this row to begin with, see the
                !post.isPrivateLog guard above): it's meant for nobody but
                its owner, so there's nothing SharedContentCard could ever
                load on the other end. The explanation lives in the
                metadata block above, next to "Who sees this", since that's
                the one place that reaches both kinds of "Only you"
                Moment. */}
            {!isOnlyYou(post) && (
              <button
                type="button"
                onClick={() => setSendToOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                <Send className="size-3" />
                Send to…
              </button>
            )}

            {/* "Message about this" — opens the chat with an attached
                Moment card if one's already reachable; otherwise (a fresh
                message request) sends the text alone and says so, since a
                pending request can't carry an attachment at all (Phase 4's
                own INSERT rule). */}
            {!owned && post.userId && (
              <button
                type="button"
                onClick={() => {
                  const existing = social.findExistingThread(post.userId!);
                  if (existing && user && messageTabFor(existing, user.id) === "chats") {
                    navigate(`/messages?thread=${existing.id}&shareMoment=${post.id}`);
                    return;
                  }
                  navigate(
                    `/messages?draftWith=${encodeURIComponent(post.userId!)}&draftName=${encodeURIComponent(post.creator)}&aboutMomentId=${post.id}`,
                  );
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                <MessageCircle className="size-3" />
                Message {post.creator} about this
              </button>
            )}

            {!owned && post.userId && (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                <Flag className="size-3" />
                Report
              </button>
            )}
            <SendToChatDialog open={sendToOpen} onOpenChange={setSendToOpen} kind="moment" postId={post.id} />

            <Thoughts
              postId={post.id}
              postOwnerId={post.userId}
              postOwnerName={post.creator}
              isOwner={owned}
              privateThoughts={post.thoughtsPrivate}
              startOpen={replyOpen && !owned}
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

        {!owned && post.userId && (
          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            targetUserId={post.userId}
            targetKind="moment"
            targetId={post.id}
            personName={post.creator}
          />
        )}

        {editing && (
          <div className="space-y-3">
            {!post.isPrivateLog && (
              <>
                <div>
                  <label htmlFor="m-space" className="mb-1.5 block text-xs text-muted-foreground">
                    Space
                  </label>
                  <Select
                    value={editHobbySlug}
                    onValueChange={(v) => {
                      setEditHobbySlug(v);
                      // A sub-hobby from the previous Space shouldn't silently
                      // carry over to a new one.
                      setEditSubHobby("");
                    }}
                  >
                    <SelectTrigger id="m-space">
                      <SelectValue placeholder="Choose a Space" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleSpaces().map((h) => (
                        <SelectItem key={h.slug} value={h.slug}>
                          {h.shortName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(getHobby(editHobbySlug)?.subItems?.length ?? 0) > 0 && (
                  <div>
                    <label htmlFor="m-sub-hobby" className="mb-1.5 block text-xs text-muted-foreground">
                      What within it
                    </label>
                    <Select value={editSubHobby} onValueChange={setEditSubHobby}>
                      <SelectTrigger id="m-sub-hobby">
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                      <SelectContent>
                        {getHobby(editHobbySlug)?.subItems.map((s) => (
                          <SelectItem key={s.slug} value={s.slug}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            {post.type === "photo" && !post.isPrivateLog && (
              <div>
                <label htmlFor="m-media" className="mb-1.5 block text-xs text-muted-foreground">
                  Replace photo
                </label>
                <input
                  id="m-media"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const raw = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!raw) {
                      setNewMediaFile(null);
                      setNewMediaPreview(null);
                      return;
                    }
                    // Every other picker in the app runs a fresh file
                    // through this before it's ever uploaded (Log.tsx,
                    // AddMoment.tsx, QuickLog.tsx) — this one didn't, so an
                    // iPhone's .heic photo went straight to moment-media
                    // unconverted, unrenderable to anyone not on Safari.
                    const file = await convertHeicIfNeeded(raw);
                    if (isHeicFile(file)) {
                      setSaveError("That photo couldn’t be processed and wasn’t added — try a different photo.");
                      return;
                    }
                    setSaveError(null);
                    setNewMediaFile(file);
                    setNewMediaPreview(URL.createObjectURL(file));
                  }}
                  className="block w-full text-xs text-muted-foreground"
                />
                {newMediaPreview && (
                  <img
                    src={newMediaPreview}
                    alt="New photo preview"
                    className="mt-2 h-32 w-full rounded-lg object-cover"
                  />
                )}
              </div>
            )}
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

        {/* The natural place for this: right under the visibility it
            explains, not buried in the action row below — a private-log
            "Only you" entry (post.isPrivateLog) never even reaches that
            row (see its own !post.isPrivateLog guard; none of those
            actions are meaningful on a stand-in that was never a real
            row), so this is the one place in the dialog that reaches
            every "Only you" Moment, not just a real just_me post. */}
        {isOnlyYou(post) && (
          <p className="-mt-1 text-[11px] text-muted-foreground">Only you Moments can’t be shared.</p>
        )}

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
            {/* Step 3, §5: Corner, location and audience live here now,
                alongside caption/photo — same "Add details" sheet the
                composer itself offers right after Save. Never shown for a
                private-log stand-in (AddDetailsSheet's own guard). */}
            {!post.isPrivateLog && (
              <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
                <SlidersHorizontal className="size-3.5" />
                Add details
              </Button>
            )}
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
                  You don’t have a Pursuit yet. Starting one from here files this
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
                  Start “{hobbyLabel ?? space?.shortName}” as a Pursuit
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
        description="This can’t be undone — the photo, caption, and any thoughts on it are gone for good."
        onConfirm={handleDelete}
      />
      <AddDetailsSheet post={post} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </Dialog>
  );
}
