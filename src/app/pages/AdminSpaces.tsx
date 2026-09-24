import { useState } from "react";
import { Link } from "react-router";
import { Check, Copy, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { builtInSpace, hobbies, isBuiltInSpace, type Hobby } from "../data/hobbies";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConfirmDialog } from "../components/ConfirmDialog";

/**
 * Creating, shaping, hiding and deleting Spaces.
 *
 * Two kinds of Space live side by side. The fifteen built-ins are in code, so
 * they can be renamed, reworded and hidden here (stored as an override row)
 * but never hard-deleted. Spaces made here exist only in the database, and can
 * also be deleted — but only once nothing points at them, because posts store
 * the Space they belong to and deleting one that still has posts would orphan
 * real people's photos. The safe, reversible default is Hide: the Space leaves
 * every list while posts, profiles and old links keep working.
 *
 * Invisible unless the profiles row says is_admin (sql/categories.sql).
 */

type Usage = { posts: number; pursuits: number; circles: number; corners: number };

interface DeletePlan {
  slug: string;
  name: string;
  usage: Usage;
  moveTo: string;
}

interface Confirm {
  plan: DeletePlan;
  /** True when content has to be moved before the delete. */
  move: boolean;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function AdminSpaces() {
  const { user } = useAuth();
  const { isAdmin, saveSpace, resetSpace, spaceUsage, deleteSpace, moveSpaceContent, spaceRows } =
    useCategories();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", prompt: "" });

  const [plan, setPlan] = useState<DeletePlan | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Nothing here for you
          </h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            This screen is for whoever manages Spaces.
          </p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  // `hobbies` is the shared list, updated in place before context state is
  // published (see applySpaceRows), so reading it here is current.
  const spaces: Hobby[] = [...hobbies];
  const hasOverride = (slug: string) => spaceRows.some((r) => r.slug === slug);

  const run = async (key: string, fn: () => Promise<{ error: string | null }>, ok?: string) => {
    if (busy) return false;
    setBusy(key);
    setError(null);
    setNotice(null);
    const res = await fn();
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (ok) setNotice(ok);
    return true;
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      setError("Give the Space a name.");
      return;
    }
    let createdSlug: string | undefined;
    const ok = await run("create", async () => {
      const res = await saveSpace({
        name,
        description: newDescription,
        prompt: newPrompt,
        active: true,
      });
      createdSlug = res.slug;
      return res;
    });
    if (ok) {
      setNotice(`Created “${name}”. Its link is /#/space/${createdSlug}`);
      setNewName("");
      setNewDescription("");
      setNewPrompt("");
    }
  };

  const startEdit = (h: Hobby) => {
    setEditing(h.slug);
    setDraft({ name: h.name, description: h.description ?? "", prompt: h.prompt ?? "" });
    setPlan(null);
  };

  const saveEdit = async (h: Hobby) => {
    const builtIn = builtInSpace(h.slug);
    // Leave a built-in's own wording alone unless it was actually changed, so
    // hiding or renaming one never rewrites its tagline as a side effect.
    const description =
      builtIn && draft.description.trim() === builtIn.description.trim() ? "" : draft.description;
    const ok = await run(
      `save:${h.slug}`,
      () =>
        saveSpace({
          slug: h.slug,
          name: draft.name,
          description,
          prompt: draft.prompt,
          active: !h.hidden,
        }),
      "Saved.",
    );
    if (ok) setEditing(null);
  };

  const toggleHidden = (h: Hobby) => {
    const builtIn = builtInSpace(h.slug);
    return run(
      `hide:${h.slug}`,
      () =>
        saveSpace({
          slug: h.slug,
          name: h.name,
          // Keep an override's wording as-is; for a built-in without one,
          // don't invent one.
          description: builtIn && h.description === builtIn.description ? "" : h.description,
          prompt: h.prompt ?? "",
          active: !!h.hidden,
        }),
      h.hidden ? `“${h.name}” is visible again.` : `“${h.name}” is hidden. Its posts and links still work.`,
    );
  };

  const reset = (h: Hobby) =>
    run(`reset:${h.slug}`, () => resetSpace(h.slug), `“${h.name}” is back to its default.`);

  const startDelete = async (h: Hobby) => {
    if (busy) return;
    setBusy(`usage:${h.slug}`);
    setError(null);
    setNotice(null);
    setEditing(null);
    const res = await spaceUsage(h.slug);
    setBusy(null);
    if (res.error || !res.usage) {
      setError(res.error ?? "Couldn't check what's in this Space.");
      return;
    }
    setPlan({ slug: h.slug, name: h.name, usage: res.usage, moveTo: "" });
  };

  const performDelete = async (c: Confirm) => {
    const { slug, name, moveTo } = c.plan;
    const ok = await run(`delete:${slug}`, async () => {
      if (c.move) {
        const moved = await moveSpaceContent(slug, moveTo);
        if (moved.error) return moved;
      }
      return deleteSpace(slug);
    }, `Deleted “${name}”.`);
    setConfirm(null);
    if (ok) setPlan(null);
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/space/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1800);
    } catch {
      setError(`Couldn't copy. The link is ${url}`);
    }
  };

  const total = (u: Usage) => u.posts + u.pursuits + u.circles + u.corners;
  const moveTargets = (slug: string) => spaces.filter((s) => s.slug !== slug);

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Spaces
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Create a Space, reword one, or hide what you don't want people to see. Hiding never
          touches a post. Deleting is only allowed once nothing is left in a Space.
        </p>

        {error && (
          <p className="mb-5 rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-sm">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-5 rounded-xl border border-border bg-[var(--surface-elevated)] px-4 py-3 text-sm">
            {notice}
          </p>
        )}

        <section className="mb-10 rounded-2xl border border-border bg-[var(--surface-elevated)] p-5">
          <h2 className="mb-4 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Create a Space
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="new-space-name" className="mb-1.5 block text-xs text-muted-foreground">
                Name
              </label>
              <Input
                id="new-space-name"
                value={newName}
                maxLength={60}
                placeholder="Plants"
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-space-desc" className="mb-1.5 block text-xs text-muted-foreground">
                One line about it
              </label>
              <Input
                id="new-space-desc"
                value={newDescription}
                maxLength={300}
                placeholder="Houseplants, gardens, cuttings, and the ones you're still keeping alive."
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-space-prompt" className="mb-1.5 block text-xs text-muted-foreground">
                Prompt shown at the top (an invitation to post)
              </label>
              <Input
                id="new-space-prompt"
                value={newPrompt}
                maxLength={120}
                placeholder="Show us your plant."
                onChange={(e) => setNewPrompt(e.target.value)}
              />
            </div>
            <Button variant="brand" onClick={create} disabled={busy === "create"}>
              <Plus className="size-4" />
              {busy === "create" ? "Creating…" : "Create Space"}
            </Button>
          </div>
        </section>

        <h2 className="mb-3 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
          All Spaces ({spaces.length})
        </h2>
        <ul className="space-y-3">
          {spaces.map((h) => {
            const builtIn = isBuiltInSpace(h.slug);
            const isEditing = editing === h.slug;
            const isPlanned = plan?.slug === h.slug;
            return (
              <li
                key={h.slug}
                className={`rounded-2xl border border-border bg-[var(--surface-elevated)] p-4 ${
                  h.hidden ? "opacity-70" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium">{h.name}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {builtIn ? "Built-in" : "Yours"}
                      </span>
                      {h.hidden && (
                        <span className="rounded-full bg-[var(--coral-deep)]/15 px-2 py-0.5 text-[11px]">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">/space/{h.slug}</p>
                    {h.prompt && <p className="mt-1 text-sm">“{h.prompt}”</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => copyLink(h.slug)}>
                      {copied === h.slug ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied === h.slug ? "Copied" : "Link"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => (isEditing ? setEditing(null) : startEdit(h))}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === `hide:${h.slug}`}
                      onClick={() => toggleHidden(h)}
                    >
                      {h.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      {h.hidden ? "Show" : "Hide"}
                    </Button>
                    {builtIn && hasOverride(h.slug) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === `reset:${h.slug}`}
                        onClick={() => reset(h)}
                      >
                        <RotateCcw className="size-3.5" />
                        Reset
                      </Button>
                    )}
                    {!builtIn && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === `usage:${h.slug}`}
                        onClick={() => (isPlanned ? setPlan(null) : startDelete(h))}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-muted-foreground">Name</label>
                      <Input
                        value={draft.name}
                        maxLength={60}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-muted-foreground">One line about it</label>
                      <Input
                        value={draft.description}
                        maxLength={300}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-muted-foreground">Prompt at the top</label>
                      <Input
                        value={draft.prompt}
                        maxLength={120}
                        placeholder="Show us your plant."
                        onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="brand" disabled={busy === `save:${h.slug}`} onClick={() => saveEdit(h)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {isPlanned && plan && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                    {total(plan.usage) === 0 ? (
                      <>
                        <p>Nothing is in this Space, so it can be deleted safely.</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirm({ plan, move: false })}
                          >
                            Delete permanently
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPlan(null)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>
                          Still in this Space: {plural(plan.usage.posts, "Moment", "Moments")},{" "}
                          {plural(plan.usage.pursuits, "Pursuit", "Pursuits")},{" "}
                          {plural(plan.usage.circles, "Circle", "Circles")}. Deleting it now would
                          orphan them, so either move them to another Space or just hide this one.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={plan.moveTo}
                            onChange={(e) => setPlan({ ...plan, moveTo: e.target.value })}
                            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            aria-label="Move everything to"
                          >
                            <option value="">Move everything to…</option>
                            {moveTargets(plan.slug).map((t) => (
                              <option key={t.slug} value={t.slug}>
                                {t.name}
                                {t.hidden ? " (hidden)" : ""}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!plan.moveTo}
                            onClick={() => setConfirm({ plan, move: true })}
                          >
                            Move, then delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const ok = await toggleHidden(h);
                              if (ok) setPlan(null);
                            }}
                          >
                            Hide instead
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPlan(null)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
        title={confirm ? `Delete “${confirm.plan.name}”?` : ""}
        description={
          confirm?.move
            ? `Every Moment, Pursuit and Circle in this Space moves to ${
                spaces.find((s) => s.slug === confirm.plan.moveTo)?.name ?? "the other Space"
              }, then this Space is deleted. This can't be undone.`
            : "This Space is empty. Deleting it can't be undone."
        }
        confirmLabel={confirm?.move ? "Move and delete" : "Delete"}
        onConfirm={() => (confirm ? performDelete(confirm) : undefined)}
      />
    </div>
  );
}
