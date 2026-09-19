import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { useCircles } from "../context/CirclesContext";
import { getHobby } from "../data/hobbies";
import { supabase } from "../../lib/supabase";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ConfirmDialog";

/**
 * Deleting a Circle.
 *
 * Nobody can delete one from the app today (the owner can edit but not
 * delete), so this is the one place it can happen, and only for admins.
 * The demo Circles that ship inside the app aren't stored anywhere that can
 * be deleted from here; they're listed as a count so that's not a surprise.
 *
 * A Circle's threads are ordinary posts, so deleting the Circle raises the
 * question of what becomes of them. The default keeps them: each thread
 * becomes its author's own owner-only post. Nothing is ever made public,
 * because people posted into a room they may have thought was small. Deleting
 * the threads along with the Circle is the explicit alternative.
 *
 * Invisible unless the profiles row says is_admin (sql/categories.sql). Needs
 * sql/circles-admin.sql to have been run.
 */

type Mode = "keep_private" | "delete";

interface Plan {
  id: number;
  name: string;
  usage: { members: number; invites: number; threads: number };
  mode: Mode;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function AdminCircles() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();
  const { circles, isRealCircle, circleUsage, adminDeleteCircle } = useCircles();

  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  const real = circles.filter((c) => isRealCircle(c.id));
  const demoCount = circles.length - real.length;
  const ownerKey = [...new Set(real.map((c) => c.ownerId).filter(Boolean))].sort().join(",");

  // Owners' display names, so a row says who made it rather than showing an id.
  useEffect(() => {
    if (!isAdmin || !supabase || !ownerKey) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!
        .from("profiles")
        .select("id, display_name")
        .in("id", ownerKey.split(","));
      if (cancelled) return;
      const names: Record<string, string> = {};
      for (const p of (data ?? []) as any[]) names[p.id] = p.display_name?.trim() || "Someone";
      setOwnerNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, ownerKey]);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Nothing here for you
          </h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            This screen is for whoever manages Circles.
          </p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const startDelete = async (id: number, name: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    setNotice(null);
    const res = await circleUsage(id);
    setBusy(null);
    if (res.error || !res.usage) {
      setError(res.error ?? "Couldn't check what's in this Circle.");
      return;
    }
    setPlan({ id, name, usage: res.usage, mode: "keep_private" });
  };

  const performDelete = async () => {
    if (!plan) return;
    setError(null);
    const res = await adminDeleteCircle(plan.id, plan.mode);
    setDialogOpen(false);
    setPlan((p) => (p && res.error ? p : null));
    if (res.error) {
      setError(res.error);
      return;
    }
    const t = res.result?.threads ?? 0;
    setNotice(
      `Deleted “${plan.name}”.` +
        (t > 0
          ? plan.mode === "keep_private"
            ? ` ${plural(t, "thread was", "threads were")} kept as private posts.`
            : ` ${plural(t, "thread was", "threads were")} deleted with it.`
          : ""),
    );
  };

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Circles
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Every Circle people have created. Deleting one can't be undone. By default, what was posted in
          it is kept as each author's own private post. It is never made public.
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

        {real.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No Circles have been created yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {real.map((c) => {
              const space = getHobby(c.hobbySlug)?.name ?? c.hobbySlug;
              const isPlanned = plan?.id === c.id;
              return (
                <li key={c.id} className="rounded-2xl border border-border bg-[var(--surface-elevated)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-medium">{c.name}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {c.visibility}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {space}
                        {c.location ? ` · ${c.location}` : ""} ·{" "}
                        {c.ownerId ? `by ${ownerNames[c.ownerId] ?? "…"}` : "no owner"} ·{" "}
                        {plural(c.memberCount, "member", "members")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === c.id}
                      onClick={() => (isPlanned ? setPlan(null) : startDelete(c.id, c.name))}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>

                  {isPlanned && plan && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                      <p>
                        This Circle has {plural(plan.usage.members, "member", "members")},{" "}
                        {plural(plan.usage.invites, "invite", "invites")} and{" "}
                        {plural(plan.usage.threads, "thread", "threads")}.
                      </p>

                      {plan.usage.threads > 0 && (
                        <fieldset className="space-y-2">
                          <legend className="mb-1 text-xs text-muted-foreground">
                            What should happen to its threads?
                          </legend>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="radio"
                              name={`mode-${plan.id}`}
                              className="mt-1"
                              checked={plan.mode === "keep_private"}
                              onChange={() => setPlan({ ...plan, mode: "keep_private" })}
                            />
                            <span>
                              Keep them as private posts <span className="text-muted-foreground">(recommended)</span>
                              <span className="block text-xs text-muted-foreground">
                                Each thread stays, visible only to whoever wrote it.
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="radio"
                              name={`mode-${plan.id}`}
                              className="mt-1"
                              checked={plan.mode === "delete"}
                              onChange={() => setPlan({ ...plan, mode: "delete" })}
                            />
                            <span>
                              Delete them too
                              <span className="block text-xs text-muted-foreground">
                                The threads are removed permanently.
                              </span>
                            </span>
                          </label>
                        </fieldset>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => setDialogOpen(true)}>
                          Delete this Circle
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPlan(null)}>
                          <X className="size-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {demoCount > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            {plural(demoCount, "demo Circle", "demo Circles")} built into the app{" "}
            {demoCount === 1 ? "isn't" : "aren't"} listed. They live in the code, so they can't be deleted
            from here.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={dialogOpen && !!plan}
        onOpenChange={(o) => {
          if (!o) setDialogOpen(false);
        }}
        title={plan ? `Delete “${plan.name}”?` : ""}
        description={
          plan
            ? plan.usage.threads > 0 && plan.mode === "delete"
              ? `The Circle and its ${plural(plan.usage.threads, "thread", "threads")} are deleted permanently. This can't be undone.`
              : plan.usage.threads > 0
                ? `The Circle is deleted permanently. Its ${plural(plan.usage.threads, "thread", "threads")} stay as private posts, visible only to whoever wrote them.`
                : "The Circle is deleted permanently. This can't be undone."
            : ""
        }
        confirmLabel="Delete Circle"
        onConfirm={performDelete}
      />
    </div>
  );
}
