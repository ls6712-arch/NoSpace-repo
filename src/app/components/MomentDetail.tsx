import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  FolderPlus,
  Globe2,
  Lock,
  Pencil,
  Users,
  UserRound,
} from "lucide-react";
import { Post } from "../data/posts";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { getCircle } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { PostReactions } from "./PostReactions";
import { Thoughts } from "./Thoughts";
import { attachEntry, startProject, useJournal } from "../lib/journal";
import { PostMedia } from "./PostMedia";
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
  const { updatePost } = useContent();
  const journal = useJournal();

  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingTo, setAddingTo] = useState(false);

  useEffect(() => {
    if (!post) return;
    setCaption(post.caption);
    setReflection(post.reflection ?? "");
    setEditing(false);
    setSaveError(null);
    setCopied(false);
    setAddingTo(false);
  }, [post?.id]);

  if (!post) return null;

  const space = getHobby(post.hobbySlug);
  const hobbyLabel = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : null;
  const audience = AUDIENCE[post.visibility] ?? AUDIENCE.friends;
  const attachedId = journal.entryProject[String(post.id)];
  const attached = journal.projects.find((p) => p.id === attachedId);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);
  const isNote = !post.media || !/^https?:\/\//.test(post.media);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await updatePost(post.id, { caption, reflection });
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

        {/* The moment itself — a picture, or a note card when there's no media */}
        {isNote ? (
          <div className="rounded-2xl border border-border bg-surface-muted px-5 py-6">
            <p className="whitespace-pre-line text-sm leading-relaxed">{post.caption}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <PostMedia
              media={post.media}
              type={post.type}
              hobbySlug={post.hobbySlug}
              seed={post.id}
              className="w-full"
            />
          </div>
        )}

        {!editing && (
          <>
            <PostReactions postId={post.id} />
            <Thoughts
              postId={post.id}
              postOwnerId={post.userId}
              postOwnerName={post.creator}
              isOwner={owned}
              privateThoughts={post.thoughtsPrivate}
            />
          </>
        )}

        {editing ? (
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
        ) : (
          !isNote && post.caption && (
            <p className="text-sm leading-relaxed">{post.caption}</p>
          )
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
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Project</dt>
            <dd>{attached ? attached.title : "Not part of a project"}</dd>
          </div>
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

        {/* Actions */}
        {owned && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingTo((v) => !v)}>
              <FolderPlus className="size-3.5" />
              {attached ? "Move to another project" : "Add to project"}
            </Button>
            <Button variant="outline" size="sm" onClick={share}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Link copied" : "Share this moment"}
            </Button>
          </div>
        )}

        {addingTo && (
          <div className="space-y-2 rounded-2xl border border-border px-4 py-3">
            {openProjects.length === 0 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  You don't have a project yet. Starting one from here files this
                  moment as its first update.
                </p>
                <Button
                  variant="coral"
                  size="sm"
                  onClick={() => {
                    const project = startProject({
                      title: hobbyLabel ?? space?.shortName ?? "New project",
                      hobbySlug: post.hobbySlug,
                      subHobby: post.subHobby,
                    });
                    attachEntry(post.id, project.id);
                    setAddingTo(false);
                  }}
                >
                  Start "{hobbyLabel ?? space?.shortName}" as a project
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
                  <SelectValue placeholder="Choose a project" />
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
    </Dialog>
  );
}
