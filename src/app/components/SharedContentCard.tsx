import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ImageOff, Sparkles } from "lucide-react";
import { fetchSharedMoment, fetchSharedPursuit } from "../lib/sharedContent";

type CardState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "moment"; title: string; image: string | null; owner: string; href: string }
  | { status: "pursuit"; title: string; owner: string; href: string };

/**
 * A shared Moment or Pursuit's compact card inside a chat bubble. Loads its
 * content fresh, under the current viewer's own permissions (see
 * lib/sharedContent.ts) — never trusts anything cached from whoever sent
 * it. An empty result (private, followers-only they don't follow, deleted,
 * blocked) renders "Not available" and nothing else: no title, no owner
 * name, no broken image — any of those would leak that the thing exists.
 */
export function SharedContentCard({
  kind,
  postId,
  pursuitId,
}: {
  kind: "moment" | "pursuit";
  postId?: number | string | null;
  pursuitId?: string | null;
}) {
  const [state, setState] = useState<CardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      if (kind === "moment" && postId != null) {
        const post = await fetchSharedMoment(postId);
        if (cancelled) return;
        if (!post) {
          setState({ status: "unavailable" });
          return;
        }
        setState({
          status: "moment",
          title: post.caption || "A Moment",
          image: post.type === "written" ? null : post.media,
          owner: post.creator,
          href: `/moment/${post.id}`,
        });
        return;
      }
      if (kind === "pursuit" && pursuitId != null) {
        const pursuit = await fetchSharedPursuit(pursuitId);
        if (cancelled) return;
        if (!pursuit) {
          setState({ status: "unavailable" });
          return;
        }
        setState({ status: "pursuit", title: pursuit.title, owner: pursuit.ownerName, href: `/pursuit/${pursuit.id}` });
        return;
      }
      if (!cancelled) setState({ status: "unavailable" });
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, postId, pursuitId]);

  if (state.status === "loading") {
    return (
      <div className="flex w-56 items-center gap-2.5 rounded-xl border border-[var(--hairline)] bg-surface-muted/60 px-3 py-2.5">
        <div className="size-10 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-3 flex-1 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex w-56 items-center gap-2 rounded-xl border border-dashed border-[var(--hairline)] px-3 py-2.5 text-xs text-muted-foreground">
        <ImageOff className="size-3.5 shrink-0" />
        Not available
      </div>
    );
  }

  return (
    <Link
      to={state.href}
      className="flex w-56 items-center gap-2.5 rounded-xl border border-[var(--hairline)] bg-card px-3 py-2.5 transition-colors hover:border-[var(--foreground)]/30"
    >
      {state.status === "moment" && state.image ? (
        <img src={state.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
          <Sparkles className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{state.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {state.status === "moment" ? "Moment" : "Pursuit"} · {state.owner}
        </span>
      </span>
    </Link>
  );
}
