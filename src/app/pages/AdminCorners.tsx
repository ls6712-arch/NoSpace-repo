import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Eye, EyeOff, Merge, Pencil, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

/**
 * Merging, renaming and hiding Corners.
 *
 * Corners are created by tagging, not suggest-and-approve (sql/corners.sql)
 * — nobody reviews one before it exists, which is exactly why duplicates
 * happen ("pottery" vs "Pottery" vs "ceramics"). This is where an admin
 * cleans that up after the fact: merge folds one Corner's Moments,
 * Pursuits, Space links and Interests into another and deletes the loser
 * (sql/…/20260924099000's admin_merge_corners — reports real counts, not
 * "done"); rename and hide are narrower single-Corner edits.
 *
 * Only lists Corners with a real database row — a curated one from
 * hobbies.ts with zero Moments ever tagged has nothing to merge, rename,
 * or hide yet (it's pure signage until someone tags into it, at which
 * point sql/corners.sql's trigger gives it a real row here too).
 *
 * Invisible unless the profiles row says is_admin (sql/categories.sql).
 * Needs 20260924099000_spaces_rework_corners.sql to have been run.
 */

interface CornerRow {
  id: number;
  space_slug: string;
  slug: string;
  name: string;
  moment_count: number;
  hidden: boolean;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function AdminCorners() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();

  const [rows, setRows] = useState<CornerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mergeFrom, setMergeFrom] = useState<number | null>(null);
  const [mergeInto, setMergeInto] = useState<number | null>(null);

  const load = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("corners")
      .select("id, space_slug, slug, name, moment_count, hidden")
      .order("moment_count", { ascending: false });
    setRows((data ?? []) as CornerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Nothing here for you
          </h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">This screen is for whoever manages Corners.</p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const startRename = (row: CornerRow) => {
    setRenaming(row.id);
    setRenameDraft(row.name);
    setError(null);
    setNotice(null);
  };

  const saveRename = async (row: CornerRow) => {
    if (!supabase || busy) return;
    const name = renameDraft.trim();
    if (!name) return;
    setBusy(`rename:${row.id}`);
    setError(null);
    const { error: err } = await supabase.rpc("admin_rename_corner", { p_corner_id: row.id, p_new_name: name });
    setBusy(null);
    if (err) {
      setError(
        /blocklisted|constraint/i.test(err.message)
          ? `“${name}” isn't allowed as a Corner name.`
          : err.message,
      );
      return;
    }
    setRenaming(null);
    setNotice(`Renamed to “${name}”.`);
    await load();
  };

  const toggleHidden = async (row: CornerRow) => {
    if (!supabase || busy) return;
    setBusy(`hide:${row.id}`);
    setError(null);
    const { error: err } = await supabase.rpc("admin_hide_corner", {
      p_corner_id: row.id,
      p_hidden: !row.hidden,
    });
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setNotice(row.hidden ? `“${row.name}” is visible again.` : `“${row.name}” is hidden from Discover.`);
    await load();
  };

  const startMerge = (row: CornerRow) => {
    setMergeFrom(row.id);
    setMergeInto(null);
    setError(null);
    setNotice(null);
  };

  const performMerge = async () => {
    if (!supabase || busy || mergeFrom == null || mergeInto == null) return;
    const from = rows.find((r) => r.id === mergeFrom);
    const into = rows.find((r) => r.id === mergeInto);
    if (!from || !into) return;
    setBusy("merge");
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_merge_corners", {
      p_from_id: from.id,
      p_into_id: into.id,
    });
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    const moved = (data ?? {}) as { moments?: number; pursuits?: number; spaces?: number; interests?: number };
    setNotice(
      `Merged “${from.name}” into “${into.name}”: ` +
        `${plural(moved.moments ?? 0, "Moment", "Moments")}, ` +
        `${plural(moved.pursuits ?? 0, "Pursuit", "Pursuits")}, ` +
        `${plural(moved.spaces ?? 0, "Space", "Spaces")}, ` +
        `${plural(moved.interests ?? 0, "Interest", "Interests")} moved.`,
    );
    setMergeFrom(null);
    setMergeInto(null);
    await load();
  };

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Corners
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Merge duplicates, rename, or hide. Merging moves every Moment, Pursuit, Space link and Interest
          from one Corner to the other, then removes the one merged away — this can't be undone.
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

        {loading ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No Corner has a real Moment tagged into it yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const isRenaming = renaming === row.id;
              const isMergeSource = mergeFrom === row.id;
              return (
                <li key={row.id} className="rounded-2xl border border-border bg-[var(--surface-elevated)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameDraft}
                            maxLength={60}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            className="h-8 max-w-56"
                          />
                          <Button size="sm" disabled={busy === `rename:${row.id}`} onClick={() => saveRename(row)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-base font-medium ${row.hidden ? "text-muted-foreground" : ""}`}>
                            {row.name}
                          </span>
                          {row.hidden && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                              Hidden
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {plural(row.moment_count, "Moment", "Moments")}
                      </p>
                    </div>
                    {!isRenaming && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => startRename(row)}>
                          <Pencil className="size-3.5" />
                          Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === `hide:${row.id}`}
                          onClick={() => toggleHidden(row)}
                        >
                          {row.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          {row.hidden ? "Unhide" : "Hide"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (isMergeSource ? setMergeFrom(null) : startMerge(row))}
                        >
                          <Merge className="size-3.5" />
                          Merge
                        </Button>
                      </div>
                    )}
                  </div>

                  {isMergeSource && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                      <p>Merge “{row.name}” into which Corner? Everything above moves there and “{row.name}” is removed.</p>
                      <select
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                        value={mergeInto ?? ""}
                        onChange={(e) => setMergeInto(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Pick a Corner…</option>
                        {rows
                          .filter((r) => r.id !== row.id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({plural(r.moment_count, "Moment", "Moments")})
                            </option>
                          ))}
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" disabled={mergeInto == null || busy === "merge"} onClick={performMerge}>
                          Merge
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setMergeFrom(null)}>
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
      </div>
    </div>
  );
}
