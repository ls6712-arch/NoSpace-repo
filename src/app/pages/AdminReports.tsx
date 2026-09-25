import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Reports of a profile, message, Moment or Thought, per
 * docs/communication-strategy.md Part B.5. Open ones first — that's the
 * queue; reviewed and dismissed are a record, not a to-do list.
 *
 * Invisible unless the profiles row says is_admin (same guard as every
 * other admin page). Degrades quietly if the reports table doesn't exist
 * yet (Phase 1's migration not applied in this environment) — an empty
 * list, not an error.
 */

interface ReportRow {
  id: number;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  targetName: string;
  targetKind: "profile" | "message" | "moment" | "thought";
  targetId: number | string | null;
  reason: string;
  note: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: number;
}

function when(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function targetLabel(r: ReportRow) {
  switch (r.targetKind) {
    case "profile":
      return "Their profile";
    case "moment":
      return "A Moment";
    case "thought":
      return "A Thought";
    case "message":
      return "A message";
  }
}

function targetHref(r: ReportRow) {
  const base = `/u/${encodeURIComponent(r.targetUserId)}`;
  if (r.targetKind === "moment" && r.targetId != null) return `${base}?moment=${r.targetId}`;
  return base;
}

export function AdminReports() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: reports } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    const ids = new Set<string>();
    for (const r of reports ?? []) {
      ids.add(r.reporter_id);
      ids.add(r.target_user_id);
    }
    const { data: people } = ids.size
      ? await supabase.from("profiles").select("id, display_name").in("id", [...ids])
      : { data: [] as any[] };
    const nameOf = (id: string) => (people ?? []).find((p: any) => p.id === id)?.display_name?.trim() || "Someone";

    setRows(
      (reports ?? []).map((r: any) => ({
        id: r.id,
        reporterId: r.reporter_id,
        reporterName: nameOf(r.reporter_id),
        targetUserId: r.target_user_id,
        targetName: nameOf(r.target_user_id),
        targetKind: r.target_kind,
        targetId: r.target_id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: new Date(r.created_at).getTime(),
      })),
    );
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
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">This screen is for whoever reviews reports.</p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const decide = async (id: number, status: "reviewed" | "dismissed") => {
    if (!supabase || busy) return;
    setBusy(id);
    setError(null);
    const { error: err } = await supabase.from("reports").update({ status }).eq("id", id);
    setBusy(null);
    if (err) {
      setError("Couldn't do that. Try again.");
      return;
    }
    await load();
  };

  const open = rows.filter((r) => r.status === "open");
  const decided = rows.filter((r) => r.status !== "open");

  const Row = ({ r }: { r: ReportRow }) => (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p>
            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>{r.reporterName}</strong>{" "}
            reported{" "}
            <Link to={targetHref(r)} className="text-[var(--coral-text)] hover:underline">
              {targetLabel(r)}
            </Link>{" "}
            of{" "}
            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>{r.targetName}</strong>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.reason} · {when(r.createdAt)}
          </p>
          {r.note && <p className="mt-1.5 text-xs italic text-muted-foreground">“{r.note}”</p>}
        </div>
        {r.status === "open" && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "reviewed")}>
              <Check className="size-3.5" />
              Mark reviewed
            </Button>
            <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "dismissed")}>
              <X className="size-3.5" />
              Dismiss
            </Button>
          </div>
        )}
        {r.status !== "open" && (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] capitalize text-muted-foreground">
            {r.status}
          </span>
        )}
      </div>
    </li>
  );

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Reports
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Reports of a profile, message, Moment or Thought, oldest open ones first.
        </p>

        {error && (
          <p className="mb-5 rounded-xl border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <Tabs defaultValue="open">
          <TabsList className="mb-6">
            <TabsTrigger value="open">Open{open.length > 0 ? ` (${open.length})` : ""}</TabsTrigger>
            <TabsTrigger value="decided">Reviewed &amp; dismissed</TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
            ) : open.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                Nothing open.
              </div>
            ) : (
              <ul className="space-y-3">
                {open.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="decided">
            {decided.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                Nothing decided yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {decided.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
