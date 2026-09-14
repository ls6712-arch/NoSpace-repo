import { useState } from "react";
import { Github, Globe, Link2, Palette, Rss, X, Plus } from "lucide-react";
import { ProfileLink, addProfileLink, removeProfileLink } from "../lib/profileLinks";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

/** A recognizable icon for the common cases, a plain globe for "whatever
 * they want to share" — this never blocks adding a link, it just decorates
 * the ones it recognizes. */
function iconFor(url: string) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return Globe;
  }
  if (host.includes("github.com")) return Github;
  if (host.includes("substack.com")) return Rss;
  if (["dribbble.com", "behance.net", "figma.com", "notion.site"].some((d) => host.includes(d))) {
    return Palette;
  }
  return Globe;
}

/** Read-only row of links — what a visitor sees on someone's profile. */
export function ProfileLinksRow({ links, className = "" }: { links: ProfileLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((link) => {
        const Icon = iconFor(link.url);
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--coral-deep)]"
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
            {link.label}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Add to specific links — the owner's editable version. No cap on how many
 * beyond what's reasonable to display; no curated list of "supported"
 * sites, since the whole point is GitHub, a design studio, a Substack, or
 * anything else someone wants people to find. Adding one is public
 * immediately — there's no draft state or privacy toggle here, unlike
 * Pursuits, because a link only does its job once someone can click it.
 */
export function ProfileLinksEditor({
  links,
  onChange,
  compact = false,
}: {
  links: ProfileLink[];
  /** Called after every add/remove so the caller can mirror to Supabase. */
  onChange: (links: ProfileLink[]) => void;
  /** One thin, borderless input row instead of the label+url+button form
   * and its two lines of helper text — the label is derived from the URL's
   * hostname, same fallback addProfileLink already had for a blank label. */
  compact?: boolean;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!url.trim()) {
      setError("Add a link first.");
      return;
    }
    const added = addProfileLink(label, url);
    if (!added) {
      setError("That doesn't look like a working link — check it and try again.");
      return;
    }
    setLabel("");
    setUrl("");
    onChange([added, ...links]);
  };

  const remove = (id: string) => {
    removeProfileLink(id);
    onChange(links.filter((l) => l.id !== id));
  };

  if (compact) {
    return (
      <div>
        {links.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = iconFor(link.url);
              return (
                <span
                  key={link.id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                  <a href={link.url} target="_blank" rel="noreferrer noopener" className="hover:text-[var(--coral-text)]">
                    {link.label}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(link.id)}
                    aria-label={`Remove ${link.label}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="ns-you-links-row">
          <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add GitHub, Substack, or studio link"
          />
          <button type="button" onClick={submit}>
            + Add link
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-[var(--coral-text)]">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {links.length > 0 && (
        <ul className="mb-3 space-y-2">
          {links.map((link) => {
            const Icon = iconFor(link.url);
            return (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5"
              >
                <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{link.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(link.id)}
                  title="Remove link"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={label}
          maxLength={30}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional — e.g. GitHub)"
          className="sm:w-44"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="github.com/you, yoursubstack.com…"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button variant="outline" onClick={submit} className="shrink-0">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-[var(--coral-text)]">{error}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Shown on your public profile right away — GitHub, a design studio, a Substack, anything.
      </p>
    </div>
  );
}
