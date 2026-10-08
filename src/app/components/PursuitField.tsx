import { useMemo, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Project } from "../lib/journal";
import { Input } from "./ui/input";

/**
 * Attaching a Moment to a Pursuit, from the general composer: an
 * autocomplete over the person's own open Pursuits, with "Create new"
 * always the last option — never a free-text field that has to match
 * something later, and never a plain picker that has no way to start a
 * new Pursuit without leaving the flow. This is only for the general
 * entry points; a Pursuit's own "Add progress" button already knows which
 * Pursuit it is and skips this entirely.
 */
export function PursuitField({
  projects,
  projectId,
  projectTitle,
  onSelectExisting,
  onCreateNew,
  onClear,
  placeholder = "Choose or start a Pursuit (optional)",
}: {
  projects: Project[];
  projectId: string;
  projectTitle: string;
  onSelectExisting: (id: string) => void;
  onCreateNew: (title: string) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [manualNew, setManualNew] = useState(false);

  const selected = projects.find((p) => p.id === projectId);
  const creatingNew = !selected && (projectTitle.trim().length > 0 || manualNew);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
    return pool.slice(0, 8);
  }, [projects, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-small" title={selected.title}>{selected.title}</span>
        <button
          type="button"
          onClick={() => {
            setManualNew(false);
            onClear();
          }}
          className="shrink-0 text-caption text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  if (creatingNew) {
    return (
      <div className="space-y-1.5">
        <Input
          value={projectTitle}
          autoFocus
          maxLength={80}
          onChange={(e) => onCreateNew(e.target.value)}
          placeholder="Name your new Pursuit"
        />
        {projects.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setManualNew(false);
              onClear();
            }}
            className="text-caption text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Choose an existing Pursuit instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
      />
      {focused && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-card border border-border bg-popover py-1 shadow-overlay">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectExisting(p.id);
                  setQuery("");
                  setFocused(false);
                }}
                className="w-full px-4 py-2 text-left text-small transition-colors hover:bg-surface-muted"
              >
                {p.title}
              </button>
            </li>
          ))}
          {matches.length > 0 && <li className="my-1 border-t border-[var(--hairline)]" />}
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setManualNew(true);
                onCreateNew(query.trim());
                setQuery("");
                setFocused(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-small text-[var(--coral-deep)] transition-colors hover:bg-surface-muted"
            >
              <FolderPlus className="size-3.5 shrink-0" />
              {query.trim() ? `Start a Pursuit: “${query.trim()}”` : "Start a Pursuit"}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
