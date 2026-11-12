import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { formatWhen } from "../lib/dates";
import { fetchAdminChatMessage, signChatPaths, type AdminChatMessage } from "../lib/cornerChat";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { Loadable } from "../components/ui/skeleton";
import { CardListSkeleton } from "../components/Skeletons";
import { ERROR_LINE } from "../lib/stateCopy";
import { EmptyState } from "../components/StateViews";
import { NotFound } from "./NotFound";

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
  targetKind: "profile" | "message" | "moment" | "thought" | "corner_message";
  targetId: number | string | null;
  reason: string;
  note: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: number;
}

function when(ts: number) {
  return formatWhen(ts, { ago: true });
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
    case "corner_message":
      return "A message";
  }
}

function targetHref(r: ReportRow) {
  const base = `/u/${encodeURIComponent(r.targetUserId)}`;
  if (r.targetKind === "moment" && r.targetId != null) return `${base}?moment=${r.targetId}`;
  return base;
}

/**
 * The words and photos of a reported Corner chat message. A message its author already removed is read from
 * the copy the database keeps for 30 days (admins only); "Message deleted" marks it, and after those 30
 * days only that line is left.
 */
function ReportedChatMessage({ id }: { id: number }) {
  const [msg, setMsg] = useState<AdminChatMessage | null | undefined>(undefined);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    void fetchAdminChatMessage(id).then(async (m) => {
      if (cancelled) return;
      setMsg(m);
      if (m && m.mediaPaths.length > 0) {
        const signed = await signChatPaths(m.mediaPaths);
        if (!cancelled) setUrls(signed);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (msg === undefined) return null;
  return (
    <div className="mt-2 space-y-2 rounded-card border border-dashed border-[var(--hairline)] p-3 text-small">
      {(msg === null || msg.removed) && <p className="italic text-muted-foreground">Message deleted</p>}
      {msg?.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
      {msg && msg.mediaPaths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {msg.mediaPaths.map((p) => (
            <ImageWithFallback key={p} src={urls.get(p)} alt="" aspect="1 / 1" className="size-24 overflow-hidden rounded-card bg-surface-muted" />
          ))}
        </div>
      )}
    </div>
  );
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

  // Anyone who isn't an admin sees the ordinary 404: the page doesn't say it exists.
  if (!user || !isAdmin) return <NotFound />;

  const decide = async (id: number, status: "reviewed" | "dismissed") => {
    if (!supabase || busy) return;
    setBusy(id);
    setError(null);
    const { error: err } = await supabase.from("reports").update({ status }).eq("id", id);
    setBusy(null);
    if (err) {
      setError(ERROR_LINE);
      return;
    }
    await load();
  };

  const open = rows.filter((r) => r.status === "open");
  const decided = rows.filter((r) => r.status !== "open");

  const Row = ({ r }: { r: ReportRow }) => (
    <li className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-small">
          <p>
            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>{r.reporterName}</strong>{" "}
            reported{" "}
            <Link to={targetHref(r)} className="text-[var(--accent-text)] hover:underline">
              {targetLabel(r)}
            </Link>{" "}
            of{" "}
            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>{r.targetName}</strong>.
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            {r.reason} · {when(r.createdAt)}
          </p>
          {r.note && <p className="mt-1.5 text-caption italic text-muted-foreground">“{r.note}”</p>}
          {r.targetKind === "corner_message" && r.targetId != null && <ReportedChatMessage id={Number(r.targetId)} />}
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
          <span className="shrink-0 rounded-control border border-border px-2.5 py-1 text-caption capitalize text-muted-foreground">
            {r.status}
          </span>
        )}
      </div>
    </li>
  );

  return (
    <div className="min-h-viewport bg-surface py-8 tab:py-12">
      <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8">
        <h1 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
          Reports
        </h1>
        <p className="mb-8 mt-2 text-small text-muted-foreground">
          Reports of a profile, message, Moment or Thought, oldest open ones first.
        </p>

        {error && (
          <p className="mb-5 rounded-card border border-[var(--accent-text)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-4 py-3 text-small">
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
              <Loadable loading skeleton={<CardListSkeleton />}>{null}</Loadable>
            ) : open.length === 0 ? (
              <EmptyState line="Nothing open." />
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
              <EmptyState line="Nothing decided yet." />
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
