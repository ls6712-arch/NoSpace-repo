import { Link } from "react-router";
import { Plus } from "lucide-react";

/** One tap to Log a Moment, between the suggestions and the feed. */
export function LogMomentCard() {
  return (
    <Link to="/create" className="flex min-h-11 items-center gap-3.5 rounded-card p-4 text-foreground bg-surface-muted">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
        <Plus className="size-[22px]" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Log a Moment
        </span>
        <span className="text-small text-muted-foreground">Did something today? Log it and get a Stub.</span>
      </span>
    </Link>
  );
}
