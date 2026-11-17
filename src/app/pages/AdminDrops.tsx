import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { useCorners } from "../context/CornersContext";
import { EmptyState, InlineError } from "../components/StateViews";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Loadable } from "../components/ui/skeleton";
import { CardListSkeleton } from "../components/Skeletons";
import { StubArt } from "../components/stub/StubArt";
import { closesLine, countLines, dropFace, dropLink, dropPath, dropPhase, type Drop } from "../lib/drops";
import { BLANK_DROP, dropProblem, fetchAllDrops, inputForDrop, saveDrop, slugify, type DropInput } from "../lib/dropsAdmin";
import { formatDateTime } from "../lib/dates";
import { HOME_TZ } from "../lib/homeWeek";
import { BUSY_LABEL } from "../lib/stateCopy";
import { NotFound } from "./NotFound";

/**
 * Admin: Soosh drops. List, add and edit. A drop cannot be deleted, because
 * people hold Stubs from it; the database refuses. Invisible unless the profile
 * says is_admin, and the database enforces that as well.
 */
export function AdminDrops() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();
  const { allCorners } = useCorners();
  const [rows, setRows] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: number; input: DropInput; slugTouched: boolean } | null>(null);
  const [cornerText, setCornerText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const load = async () => {
    setLoading(true);
    const r = await fetchAllDrops();
    setRows(r.drops);
    setError(r.error);
    setLoading(false);
  };
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  // Anyone who isn't an admin sees the ordinary 404: the page doesn't say it exists.
  if (!user || !isAdmin) return <NotFound />;

  const keyOf = (c: { spaceSlug: string; slug: string }) => `${c.spaceSlug}/${c.slug}`;
  const nameOf = (key: string) => allCorners.find((c) => keyOf(c) === key)?.name ?? "";
  const open = (row?: Drop) => {
    const input = row ? inputForDrop(row) : BLANK_DROP;
    setEditing({ id: row?.id, input, slugTouched: !!row });
    setCornerText(nameOf(input.cornerKey));
    setFormError(null);
  };
  const set = <K extends keyof DropInput>(k: K, v: DropInput[K]) => setEditing((e) => (e ? { ...e, input: { ...e.input, [k]: v } } : e));
  const setTitle = (title: string) => setEditing((e) => (e ? { ...e, input: { ...e.input, title, slug: e.slugTouched ? e.input.slug : slugify(title) } } : e));
  const setSlug = (slug: string) => setEditing((e) => (e ? { ...e, slugTouched: true, input: { ...e.input, slug: slug.toLowerCase() } } : e));
  const pickCorner = (text: string) => {
    setCornerText(text);
    const match = allCorners.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
    set("cornerKey", match ? keyOf(match) : "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || busy) return;
    const problem = dropProblem(editing.input);
    if (problem) return setFormError(problem);
    setBusy(true);
    const err = await saveDrop(editing.input, user.id, editing.id);
    setBusy(false);
    if (err) return setFormError(err);
    setEditing(null);
    await load();
  };

  const preview: Drop | null = editing
    ? {
        id: 0,
        slug: editing.input.slug,
        title: editing.input.title.trim() || "Title",
        blurb: null,
        cornerKey: editing.input.cornerKey,
        targetMoments: editing.input.targetMoments,
        opensAt: now,
        closesAt: now + 1,
        maxEditions: null,
        palette: [],
        peopleIn: null,
        finished: null,
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[calc(680px+2rem)] flex-col gap-6 px-4 pb-10 pt-6 tab:max-w-[calc(680px+3rem)] tab:px-6 desk:max-w-[calc(680px+4rem)] desk:px-8">
      <header className="flex flex-col gap-2">
        <Link to="/account" aria-label="Back" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full">
          <ArrowLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-title" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          Soosh drops
        </h1>
        <p className="text-body text-muted-foreground">A limited Pursuit with a window. Whoever finishes inside it keeps a numbered Stub. One open at a time shows on Home.</p>
      </header>

      {error && <InlineError message={error} />}

      {editing && preview ? (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
          <h2 className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {editing.id === undefined ? "Add a drop" : "Edit this drop"}
          </h2>
          <div className="flex justify-center py-2">
            <StubArt face={dropFace(preview, now)} width={150} />
          </div>
          <Field label="Title" hint="60 characters at most. It prints on the Stub">
            {(id) => <Input id={id} value={editing.input.title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Link name" hint={editing.input.slug ? dropLink(editing.input.slug) : "Lower-case letters, numbers and hyphens"}>
            {(id) => <Input id={id} value={editing.input.slug} maxLength={60} onChange={(e) => setSlug(e.target.value)} />}
          </Field>
          <Field label="What to do" hint="One or two lines, 280 characters at most">
            {(id) => <Textarea id={id} value={editing.input.blurb} maxLength={280} rows={3} onChange={(e) => set("blurb", e.target.value)} />}
          </Field>
          <Field label="Corner" hint="Where its Moments show. Type to search">
            {(id) => (
              <>
                <Input id={id} list={`${id}-corners`} value={cornerText} onChange={(e) => pickCorner(e.target.value)} />
                <datalist id={`${id}-corners`}>
                  {allCorners.map((c) => (
                    <option key={keyOf(c)} value={c.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Goal" hint="How many Moments finish it. 1 means one sitting">
            {(id) => (
              <Input id={id} type="number" min={1} max={60} value={editing.input.targetMoments} onChange={(e) => set("targetMoments", Number(e.target.value))} />
            )}
          </Field>
          <div className="grid gap-4 tab:grid-cols-2">
            <Field label="Opens" hint="This device’s time">
              {(id) => <Input id={id} type="datetime-local" value={editing.input.opens} onChange={(e) => set("opens", e.target.value)} />}
            </Field>
            <Field label="Closes" hint="After this, nobody can earn it">
              {(id) => <Input id={id} type="datetime-local" value={editing.input.closes} onChange={(e) => set("closes", e.target.value)} />}
            </Field>
          </div>
          {formError && <InlineError message={formError} />}
          <div className="flex gap-3">
            <Button type="submit" variant="coral" className="h-11 rounded-control" disabled={busy}>
              {busy ? BUSY_LABEL : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-control" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="coral" className="h-11 self-start rounded-control" onClick={() => open()}>
          Add a drop
        </Button>
      )}

      <Loadable loading={loading} skeleton={<CardListSkeleton />}>
        {rows.length === 0 && !error ? (
          <EmptyState line="No drops yet" hint="Add one, and it shows on Home from the minute it opens." />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((d) => {
              const phase = d.opensAt > now ? "Not open yet" : dropPhase(d, now) === "open" ? "Open now" : "Closed";
              return (
                <li key={d.id} className="flex flex-col gap-1.5 rounded-card border border-border bg-card p-4">
                  <p className="text-small font-semibold text-accent-text">{phase}</p>
                  <h3 className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {d.title}
                  </h3>
                  <p className="text-small text-muted-foreground">
                    {[`Opens ${formatDateTime(d.opensAt, { timeZone: HOME_TZ, now })}`, closesLine(d, now), nameOf(d.cornerKey), ...countLines(d)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    <Button variant="outline" className="h-11 rounded-control" onClick={() => open(d)}>
                      Edit
                    </Button>
                    {d.opensAt <= now && (
                      <Link to={dropPath(d.slug)} className="inline-flex min-h-11 items-center text-small text-accent-text underline-offset-4 hover:underline">
                        Open its page
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Loadable>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-small">
        {label}
      </Label>
      {children(id)}
      {hint && <p className="break-all text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}
