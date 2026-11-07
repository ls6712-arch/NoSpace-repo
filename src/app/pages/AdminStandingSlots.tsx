import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { useCorners } from "../context/CornersContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState, InlineError } from "../components/StateViews";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loadable } from "../components/ui/skeleton";
import { CardListSkeleton } from "../components/Skeletons";
import { StandingSlotForm } from "../components/standing/StandingSlotForm";
import { SPEND_LABEL } from "../components/discover/IdeaPills";
import { formatDate } from "../lib/dates";
import { plural } from "../lib/plural";
import {
  BLANK_SLOT,
  SLOT_COPY,
  deleteSlot,
  fetchSlots,
  fetchStaleDays,
  filterSlots,
  isFresh,
  saveSlot,
  slotWhen,
  toInput,
  verifySlot,
  DEFAULT_STALE_DAYS,
  type StandingSlot,
} from "../lib/standingSlots";
import { NotFound } from "./NotFound";

/**
 * Admin: the weekly schedule behind Tonight. List, add, edit, "Verified today", turn off and
 * delete, filtered by Corner and neighborhood. Invisible unless the profile says is_admin; the
 * database enforces it as well.
 */
export function AdminStandingSlots() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();
  const { allCorners } = useCorners();
  const [rows, setRows] = useState<StandingSlot[]>([]);
  const [staleDays, setStaleDays] = useState(DEFAULT_STALE_DAYS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: number; slot: StandingSlot | null } | null>(null);
  const [deleting, setDeleting] = useState<StandingSlot | null>(null);
  const [cornerFilter, setCornerFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const [r, days] = await Promise.all([fetchSlots(), fetchStaleDays()]);
    setRows(r.slots);
    setError(r.error);
    setStaleDays(days);
    setLoading(false);
  };
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const cornerNames = useMemo(() => new Map(allCorners.map((c) => [c.slug, c.name])), [allCorners]);
  const cornerSlugFor = (text: string) => allCorners.find((c) => c.name.toLowerCase() === text.trim().toLowerCase())?.slug ?? text.trim().toLowerCase();
  const shown = useMemo(() => filterSlots(rows, { corner: cornerFilter ? cornerSlugFor(cornerFilter) : "", area: areaFilter }), [rows, cornerFilter, areaFilter, allCorners]);

  // Anyone who isn't an admin sees the ordinary 404: the page doesn't say it exists.
  if (!user || !isAdmin) return <NotFound />;

  const verify = async (s: StandingSlot) => {
    const r = await verifySlot(s.id);
    if (r.error) setError(r.error);
    else await load();
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    const r = await deleteSlot(deleting.id);
    if (r.error) setError(r.error);
    setDeleting(null);
    if (!r.error) await load();
  };

  return (
    <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8 flex flex-col gap-6 pb-10 pt-6">
      <header className="flex flex-col gap-2">
        <Link to="/you" aria-label="Back" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full">
          <ArrowLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-title" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {SLOT_COPY.title}
        </h1>
        <p className="text-body text-muted-foreground">{SLOT_COPY.line}</p>
      </header>

      {error && <InlineError message={error} />}

      {editing ? (
        <StandingSlotForm
          key={editing.id ?? "new"}
          initial={editing.slot ? toInput(editing.slot) : BLANK_SLOT}
          title={editing.id === undefined ? SLOT_COPY.add : SLOT_COPY.edit}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            const r = await saveSlot(input, { id: editing.id });
            if (r.error) return r.error;
            setEditing(null);
            await load();
            return null;
          }}
        />
      ) : (
        <Button className="self-start" onClick={() => setEditing({ slot: null })}>
          {SLOT_COPY.add}
        </Button>
      )}

      <div className="grid gap-3 tab:grid-cols-2">
        <Input aria-label="Filter by Corner" placeholder="Filter by Corner" list="slot-filter-corners" value={cornerFilter} onChange={(e) => setCornerFilter(e.target.value)} />
        <datalist id="slot-filter-corners">
          {[...new Set(rows.map((r) => r.cornerSlug))].map((slug) => (
            <option key={slug} value={cornerNames.get(slug) ?? slug} />
          ))}
        </datalist>
        <Input aria-label="Filter by neighborhood" placeholder="Filter by neighborhood" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} />
      </div>
      <p className="text-small text-muted-foreground">{plural(shown.length, "weekly time")}</p>

      <Loadable loading={loading} skeleton={<CardListSkeleton />}>
        {shown.length === 0 ? (
          <EmptyState line={SLOT_COPY.emptyTitle} hint={SLOT_COPY.emptyBody} />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((s) => {
              const fresh = isFresh(s, Date.now(), staleDays);
              return (
                <li key={s.id} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold">{s.title}</p>
                      <p className="text-small text-muted-foreground">
                        {[slotWhen(s), s.placeName, s.area, cornerNames.get(s.cornerSlug) ?? s.cornerSlug, SPEND_LABEL[s.spend]].join(" · ")}
                      </p>
                      <p className="text-caption text-muted-foreground">Verified {formatDate(s.lastVerifiedAt)}</p>
                    </div>
                    {(!s.active || !fresh) && (
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-caption font-semibold">{!s.active ? SLOT_COPY.off : SLOT_COPY.stale}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void verify(s)}>
                      {SLOT_COPY.verifiedToday}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ id: s.id, slot: s })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting(s)}>
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Loadable>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description={SLOT_COPY.deleteBody}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
