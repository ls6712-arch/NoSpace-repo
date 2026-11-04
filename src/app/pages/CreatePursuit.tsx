import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { newProject, type Project } from "../lib/journal";
import { guessSpace } from "../lib/pursuitProgress";
import { type Workflow, validateWorkflow } from "../lib/pursuitWorkflow";
import { createWorkflow, measureFor } from "../lib/pursuitWorkflowStore";
import { fetchPerson, usePeopleSearch, type Person } from "../lib/people";
import {
  GoalFields,
  Field,
  fieldClass,
} from "../components/pursuit/workflow/GoalFields";
import { Button } from "../components/ui/button";
import { CreatePursuit as LegacyCreatePursuit } from "./LegacyCreatePursuit";
export { PersonAvatar } from "./LegacyCreatePursuit";

export function CreatePursuit() {
  const [params] = useSearchParams();
  return params.get("legacy") === "1" ? (
    <LegacyCreatePursuit />
  ) : (
    <SimpleCreatePursuit />
  );
}
function SimpleCreatePursuit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [workflow, setWorkflow] = useState<Workflow>({
    version: 2,
    tracking: "sessions",
    target: params.get("target") ? Number(params.get("target")) : undefined,
    finishBy: params.get("finishBy") || undefined,
    unit: "sessions",
    items: [],
  });
  const [friends, setFriends] = useState(
    params.get("together") === "1" || !!params.get("with"),
  );
  const [shared, setShared] = useState(false);
  const [query, setQuery] = useState("");
  const { people, loading } = usePeopleSearch(query);
  const [invitees, setInvitees] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = useRef<Project | null>(null);
  const guard = useRef(false);
  useEffect(() => {
    const id = params.get("with");
    if (!id) return;
    let live = true;
    void fetchPerson(id).then((p) => {
      if (live && p) setInvitees([p]);
    });
    return () => {
      live = false;
    };
  }, [params]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (guard.current) return;
    const validation = validateWorkflow(workflow);
    if (!title.trim() || validation) {
      setError(validation || "Name your Pursuit.");
      return;
    }
    if (friends && (!user || !invitees.length)) {
      setError("Choose people to invite.");
      return;
    }
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const input = {
        title: title.trim(),
        hobbySlug: params.get("hobby") || guessSpace(title),
        subHobby: params.get("sub") || undefined,
        inspiredByPostId: Number(params.get("from")) || undefined,
        shared: false,
        ownerId: user?.id,
        role: "owner" as const,
        mode: friends
          ? ((shared && workflow.tracking !== "updates"
              ? "group"
              : "together") as "group" | "together")
          : ("solo" as const),
        measure: measureFor(workflow),
      };
      // Reuse the id across retries; server creation is atomic and idempotent.
      draft.current = draft.current
        ? { ...draft.current, ...input }
        : newProject(input);
      await createWorkflow(
        draft.current,
        friends ? invitees.map((p) => p.id) : [],
        !!user,
      );
      navigate(`/pursuit/${draft.current.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 pb-32 pt-6 tab:px-6 desk:px-8">
      <Link
        to="/my-space"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-small"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
        Start a Pursuit
      </h1>
      <p className="mt-2 text-small text-muted-foreground">
        Choose a goal. Add the details when you need them.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <Field label="What do you want to do?">
          <input
            autoFocus
            required
            maxLength={80}
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Practice guitar"
          />
        </Field>
        <GoalFields value={workflow} onChange={setWorkflow} />
        <fieldset>
          <legend className="mb-2 text-small font-medium">Who with?</legend>
          <div className="flex gap-2">
            {[false, true].map((v) => (
              <button
                type="button"
                key={String(v)}
                aria-pressed={friends === v}
                className={`min-h-11 flex-1 rounded-control border px-4 ${friends === v ? "border-accent bg-surface-muted" : "border-border"}`}
                onClick={() => setFriends(v)}
              >
                {v ? "Friends" : "Just me"}
              </button>
            ))}
          </div>
        </fieldset>
        {friends && (
          <section className="space-y-4 rounded-card border border-border bg-card p-4">
            {!user ? (
              <p className="text-small">
                <Link to="/login?redirect=/pursuits/new" className="underline">
                  Log in
                </Link>{" "}
                to invite people.
              </p>
            ) : (
              <>
                <Field label="Invite people">
                  <input
                    className={fieldClass}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people by name"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {invitees.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="flex min-h-11 items-center gap-2 rounded-control bg-surface-muted px-3 text-small"
                      onClick={() =>
                        setInvitees((list) => list.filter((i) => i.id !== p.id))
                      }
                    >
                      {p.displayName}
                      <X className="size-4" aria-label="Remove" />
                    </button>
                  ))}
                </div>
                {query.trim().length >= 2 && (
                  <ul>
                    {people
                      .filter(
                        (p) =>
                          p.id !== user.id &&
                          !invitees.some((i) => i.id === p.id),
                      )
                      .map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="min-h-11 w-full text-left text-small"
                            onClick={() => {
                              setInvitees((list) => [...list, p]);
                              setQuery("");
                            }}
                          >
                            {p.displayName}
                          </button>
                        </li>
                      ))}
                    {loading && <li className="text-small">Looking…</li>}
                    {!loading && !people.length && (
                      <li className="text-small">No one found</li>
                    )}
                  </ul>
                )}
                {workflow.tracking !== "updates" && (
                  <fieldset className="space-y-3">
                    <legend className="mb-2 text-small font-medium">
                      Track progress as
                    </legend>
                    {[false, true].map((v) => (
                      <label key={String(v)} className="flex gap-3 text-small">
                        <input
                          type="radio"
                          name="groupMode"
                          checked={shared === v}
                          onChange={() => setShared(v)}
                        />
                        <span>
                          {v ? "Shared goal" : "Individual goals"}
                          <span className="block text-caption text-muted-foreground">
                            {v
                              ? "Everyone contributes to one goal."
                              : "Each person chooses their own target."}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="text-caption text-muted-foreground">
                  Invited people join after they accept.
                </p>
              </>
            )}
          </section>
        )}
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="coral"
          busy={busy}
          disabled={busy}
          className="min-h-11 w-full"
        >
          Start a Pursuit
        </Button>
        <Link
          to={`/pursuits/new?${new URLSearchParams({ ...Object.fromEntries(params), legacy: "1" })}`}
          className="inline-flex min-h-11 items-center text-small text-muted-foreground underline"
        >
          More options
        </Link>
      </form>
    </main>
  );
}
