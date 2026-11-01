import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState, InlineError } from "../components/StateViews";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loadable } from "../components/ui/skeleton";
import { CardListSkeleton } from "../components/Skeletons";
import { ADMIN_PICKS } from "../lib/homeCopy";
import { formatDate } from "../lib/dates";
import { plural } from "../lib/plural";
import {
  PICK_COLORS,
  deletePick,
  fetchAllPicks,
  inputFor,
  isPickColor,
  pickPill,
  pickProblem,
  addSource,
  fetchSources,
  runScout,
  savePick,
  setSourceEnabled,
  sourceProblem,
  type ScoutSource,
  type SourceInput,
  setPublished,
  type AdminPick,
  type PickInput,
  type ScoutReport,
} from "../lib/cityPicks";

/**
 * Admin: "This week in New York" picks. List, add, edit, publish and
 * unpublish, and delete with a confirm. Invisible unless the profile says
 * is_admin (same guard as the other admin pages); the database enforces it
 * as well, so a non-admin could not write a pick even from the console.
 */
type Row = AdminPick;
const BLANK: PickInput = { title: "", place: "", starts: "", ends: "", price: "", url: "", cornerId: null, color: "orange" };

export function AdminCityPicks() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();
  const [rows, setRows] = useState<Row[]>([]);
  const [corners, setCorners] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: number; input: PickInput } | null>(null);
  const [cornerText, setCornerText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [focus, setFocus] = useState("");
  const [scouting, setScouting] = useState(false);
  const [scoutResult, setScoutResult] = useState<{ report: ScoutReport | null; error: string | null } | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetchAllPicks();
    setRows(r.picks);
    setError(r.error);
    setLoading(false);
  };
  useEffect(() => {
    if (!isAdmin) return;
    void load();
    if (supabase) {
      void supabase
        .from("corners")
        .select("id, name")
        .eq("hidden", false)
        .order("name")
        .limit(1000)
        .then(({ data }) => setCorners((data ?? []) as { id: number; name: string }[]));
    }
  }, [isAdmin]);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-title font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {ADMIN_PICKS.noAccessTitle}
          </h2>
          <p className="mb-6 max-w-sm text-small text-muted-foreground">{ADMIN_PICKS.noAccessBody}</p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const open = (row?: Row) => {
    const input = row ? inputFor(row, row.cornerId) : BLANK;
    setEditing({ id: row?.id, input });
    setCornerText(corners.find((c) => c.id === input.cornerId)?.name ?? "");
    setFormError(null);
  };
  const set = <K extends keyof PickInput>(k: K, v: PickInput[K]) => setEditing((e) => (e ? { ...e, input: { ...e.input, [k]: v } } : e));
  const pickCorner = (text: string) => {
    setCornerText(text);
    set("cornerId", corners.find((c) => c.name.toLowerCase() === text.trim().toLowerCase())?.id ?? null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || busy) return;
    const problem = pickProblem(editing.input);
    if (problem) return setFormError(problem);
    setBusy(true);
    const r = await savePick(editing.input, editing.id);
    setBusy(false);
    if (r.error) return setFormError(r.error);
    setEditing(null);
    await load();
  };
  const toggle = async (row: Row) => {
    const r = await setPublished(row.id, !row.published);
    if (r.error) setError(r.error);
    else await load();
  };
  const scout = async (e: FormEvent) => {
    e.preventDefault();
    if (scouting) return;
    setScouting(true);
    setScoutResult(null);
    const r = await runScout(focus);
    setScouting(false);
    setScoutResult(r);
    if (r.report && r.report.added > 0) await load();
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    const r = await deletePick(deleting.id);
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
          {ADMIN_PICKS.title}
        </h1>
        <p className="text-body text-muted-foreground">{ADMIN_PICKS.line}</p>
      </header>

      {error && <InlineError message={error} />}

      <ScoutPanel focus={focus} setFocus={setFocus} busy={scouting} result={scoutResult} onSubmit={scout} />

      <SourcesPanel />

      {editing ? (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
          <h2 className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {editing.id === undefined ? ADMIN_PICKS.add : ADMIN_PICKS.edit}
          </h2>
          <Field label="Title" hint="80 characters at most">
            {(id) => (
              <>
            <Input id={id} value={editing.input.title} maxLength={80} onChange={(e) => set("title", e.target.value)} />
          </>
            )}
          </Field>
          <Field label="Place" hint="Optional">
            {(id) => (
              <>
            <Input id={id} value={editing.input.place} maxLength={80} onChange={(e) => set("place", e.target.value)} />
          </>
            )}
          </Field>
          <div className="grid gap-4 tab:grid-cols-2">
            <Field label="Starts" hint="New York time">
            {(id) => (
              <>
              <Input id={id} type="datetime-local" value={editing.input.starts} onChange={(e) => set("starts", e.target.value)} />
            </>
            )}
          </Field>
            <Field label="Ends" hint="Optional">
            {(id) => (
              <>
              <Input id={id} type="datetime-local" value={editing.input.ends} onChange={(e) => set("ends", e.target.value)} />
            </>
            )}
          </Field>
          </div>
          <Field label="Price" hint="Your own words, like free or $25. Optional">
            {(id) => (
              <>
            <Input id={id} value={editing.input.price} maxLength={40} onChange={(e) => set("price", e.target.value)} />
          </>
            )}
          </Field>
          <Field label="Link" hint="Starts with https://. Optional">
            {(id) => (
              <>
            <Input id={id} type="url" value={editing.input.url} maxLength={500} onChange={(e) => set("url", e.target.value)} />
          </>
            )}
          </Field>
          <Field label="Corner" hint="Sets the icon. Optional">
            {(id) => (
              <>
            <Input id={id} list="city-pick-corners" value={cornerText} onChange={(e) => pickCorner(e.target.value)} />
            <datalist id="city-pick-corners">
              {corners.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </>
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-small font-semibold">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {PICK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={editing.input.color === c}
                  onClick={() => isPickColor(c) && set("color", c)}
                  style={{ background: `var(--cat-${c})` }}
                  className="size-11 rounded-full border-2 border-transparent aria-pressed:border-foreground"
                />
              ))}
            </div>
          </fieldset>
          {formError && (
            <p role="alert" className="text-small text-destructive">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button className="self-start" onClick={() => open()}>
          {ADMIN_PICKS.add}
        </Button>
      )}

      <Loadable loading={loading} skeleton={<CardListSkeleton />}>
        {rows.length === 0 ? (
          <EmptyState line={ADMIN_PICKS.emptyTitle} hint={ADMIN_PICKS.emptyBody} />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: `var(--cat-${r.color})` }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold">{r.title}</p>
                    <p className="text-small text-muted-foreground">{[pickPill(r), r.place].filter(Boolean).join(" · ")}</p>
                    {r.scout && <ScoutDetails scout={r.scout} />}
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-caption font-semibold">{r.published ? "Published" : "Draft"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(r)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggle(r)}>
                    {r.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleting(r)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Loadable>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description={ADMIN_PICKS.deleteBody}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ScoutPanel({
  focus,
  setFocus,
  busy,
  result,
  onSubmit,
}: {
  focus: string;
  setFocus: (v: string) => void;
  busy: boolean;
  result: { report: ScoutReport | null; error: string | null } | null;
  onSubmit: (e: FormEvent) => void;
}) {
  const report = result?.report;
  return (
    <section aria-labelledby="scout-title" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <h2 id="scout-title" className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {ADMIN_PICKS.scoutTitle}
      </h2>
      <p className="text-small text-muted-foreground">{ADMIN_PICKS.scoutLine}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={ADMIN_PICKS.scoutFocus} hint={ADMIN_PICKS.scoutFocusHint}>
          {(id) => <Input id={id} value={focus} maxLength={200} onChange={(e) => setFocus(e.target.value)} disabled={busy} />}
        </Field>
        <Button type="submit" className="self-start" disabled={busy} aria-busy={busy}>
          {busy ? ADMIN_PICKS.scoutBusy : ADMIN_PICKS.scoutButton}
        </Button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-2">
        {result?.error && (
          <p role="alert" className="text-small text-destructive">
            {result.error}
          </p>
        )}
        {report && (
          <p className="text-small font-semibold">{report.added > 0 ? `Added ${plural(report.added, "draft")}.` : ADMIN_PICKS.scoutNone}</p>
        )}
        {report && report.dropped.length > 0 && (
          <details className="text-small text-muted-foreground">
            <summary className="cursor-pointer">
              {ADMIN_PICKS.scoutSkipped} {plural(report.dropped.length, "pick")}
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {report.dropped.map((d, i) => (
                <li key={i}>
                  <span className="font-semibold text-foreground">{d.title}</span>: {d.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

const BLANK_SOURCE: SourceInput = { name: "", focus: "", searchDomain: "", trustedHost: "" };

function SourcesPanel() {
  const [sources, setSources] = useState<ScoutSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<SourceInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetchSources();
    setSources(r.sources);
    setError(r.error);
  };
  useEffect(() => {
    void load();
  }, []);

  const toggle = async (s: ScoutSource) => {
    const r = await setSourceEnabled(s.id, !s.enabled);
    if (r.error) setError(r.error);
    else await load();
  };
  const set = <K extends keyof SourceInput>(k: K, v: string) => setAdding((a) => (a ? { ...a, [k]: v } : a));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!adding || busy) return;
    const problem = sourceProblem(adding);
    if (problem) return setFormError(problem);
    setBusy(true);
    const r = await addSource(adding);
    setBusy(false);
    if (r.error) return setFormError(r.error);
    setAdding(null);
    setFormError(null);
    await load();
  };

  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <h2 id="sources-title" className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {ADMIN_PICKS.sourcesTitle}
      </h2>
      <p className="text-small text-muted-foreground">{ADMIN_PICKS.sourcesLine}</p>
      {error && <InlineError message={error} />}
      {sources.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-start gap-3 rounded-control border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold">
                  {s.name}
                  {!s.enabled && <span className="ml-2 text-caption font-normal text-muted-foreground">{ADMIN_PICKS.paused}</span>}
                </p>
                <p className="text-small text-muted-foreground">
                  {[s.searchDomain ?? ADMIN_PICKS.wholeWeb, s.trustedHost ? `${ADMIN_PICKS.trustedOn} ${s.trustedHost}` : ADMIN_PICKS.allDrafts].join(" · ")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void toggle(s)}>
                {s.enabled ? ADMIN_PICKS.pause : ADMIN_PICKS.resume}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <Field label={ADMIN_PICKS.sourceName} hint="60 characters at most">
            {(id) => <Input id={id} value={adding.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />}
          </Field>
          <Field label={ADMIN_PICKS.sourceFocus}>
            {(id) => <Input id={id} value={adding.focus} maxLength={200} onChange={(e) => set("focus", e.target.value)} />}
          </Field>
          <Field label={ADMIN_PICKS.sourceSearch} hint={ADMIN_PICKS.sourceSearchHint}>
            {(id) => <Input id={id} value={adding.searchDomain} maxLength={100} onChange={(e) => set("searchDomain", e.target.value)} />}
          </Field>
          <Field label={ADMIN_PICKS.sourceTrusted} hint={ADMIN_PICKS.sourceTrustedHint}>
            {(id) => <Input id={id} value={adding.trustedHost} maxLength={100} onChange={(e) => set("trustedHost", e.target.value)} />}
          </Field>
          {formError && (
            <p role="alert" className="text-small text-destructive">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
            <Button type="button" variant="outline" onClick={() => (setAdding(null), setFormError(null))}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setAdding(BLANK_SOURCE)}>
          {ADMIN_PICKS.addSource}
        </Button>
      )}
    </section>
  );
}

function ScoutDetails({ scout }: { scout: NonNullable<AdminPick["scout"]> }) {
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-small text-muted-foreground">
      <p>
        {[ADMIN_PICKS.foundBy, scout.checkedAt ? `${ADMIN_PICKS.checked} ${formatDate(scout.checkedAt)}` : null].filter(Boolean).join(" · ")}
        {scout.sourceUrl && (
          <>
            {" · "}
            <a href={scout.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {ADMIN_PICKS.source}
            </a>
          </>
        )}
      </p>
      {scout.note && <p>{scout.note}</p>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-small font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children(id)}
    </div>
  );
}
