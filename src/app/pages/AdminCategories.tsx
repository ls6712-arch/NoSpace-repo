import { useState } from "react";
import { Link } from "react-router";
import { Check, GitMerge, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Reviewing what people said was missing.
 *
 * Three outcomes, and all three are answers rather than silences: approve and
 * it becomes a category everyone can browse; merge and it points at the one
 * that already covers it; reject and the note says why. The person who
 * suggested it sees whichever happened.
 *
 * Invisible unless the profiles row says is_admin, which nobody has until
 * it's granted by hand in SQL.
 */
function when(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function AdminCategories() {
  const { user } = useAuth();
  const { isAdmin, suggestions, categories, review } = useCategories();
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});
  const [mergeTo, setMergeTo] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Nothing here for you
          </h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            This screen is for whoever reviews category suggestions.
          </p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const pending = suggestions.filter((s) => s.status === "pending");
  const decided = suggestions.filter((s) => s.status !== "pending");

  const decide = async (
    id: number,
    decision: "approved" | "merged" | "rejected",
  ) => {
    if (busy) return;
    if (decision === "merged" && !mergeTo[id]) {
      setError("Choose which category it folds into.");
      return;
    }
    setBusy(id);
    setError(null);
    const res = await review(id, decision, {
      mergedInto: mergeTo[id],
      note: note[id],
    });
    if (res.error) setError(res.error);
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Category suggestions
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          What people told us the list was missing. Approving one adds it to
          Discover; nothing here ever changes a post someone already made.
        </p>

        {error && (
          <p className="mb-5 rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--cream))] px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <Tabs defaultValue="pending">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">
              Waiting{pending.length > 0 ? ` (${pending.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="decided">Decided</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">Nothing waiting.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((s) => (
                  <li key={s.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                        {s.name}
                      </h2>
                      <span className="text-[11px] text-muted-foreground">
                        {s.suggesterName ?? "Someone"} · {when(s.createdAt)}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                    {s.examples && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Examples: {s.examples}
                      </p>
                    )}

                    <div className="mt-4 space-y-2.5">
                      <Input
                        value={note[s.id] ?? ""}
                        maxLength={200}
                        onChange={(e) => setNote((n) => ({ ...n, [s.id]: e.target.value }))}
                        placeholder="Note back to them (optional)"
                      />

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="text-white [background-color:var(--forest)]"
                          disabled={busy === s.id}
                          onClick={() => decide(s.id, "approved")}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </Button>

                        <span className="flex items-center gap-1.5">
                          <select
                            value={mergeTo[s.id] ?? ""}
                            onChange={(e) =>
                              setMergeTo((m) => ({ ...m, [s.id]: e.target.value }))
                            }
                            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-ring"
                          >
                            <option value="">Merge into…</option>
                            {categories.map((c) => (
                              <option key={c.slug} value={c.slug}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === s.id}
                            onClick={() => decide(s.id, "merged")}
                          >
                            <GitMerge className="size-3.5" />
                            Merge
                          </Button>
                        </span>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === s.id}
                          onClick={() => decide(s.id, "rejected")}
                        >
                          <X className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="decided">
            {decided.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">Nothing decided yet.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {decided.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span style={{ fontFamily: "var(--font-serif)" }}>{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.status === "merged" && s.mergedInto
                        ? `merged into ${categories.find((c) => c.slug === s.mergedInto)?.name ?? s.mergedInto}`
                        : s.status}
                    </span>
                    {s.reviewNote && (
                      <span className="w-full text-xs text-muted-foreground">
                        "{s.reviewNote}"
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
