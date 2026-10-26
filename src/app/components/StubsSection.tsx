import { useEffect, useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { curatedFor } from "../data/curatedCorners";
import { cornerStyle } from "../lib/categoryStyle";
import { formatDate } from "../lib/dates";
import { displayStyle } from "../lib/doorList";

/**
 * A Shelf's Stubs, newest first: proof you were at a Space event, issued by
 * the host and never by you. Each is a ticket with a perforated edge. A Stub
 * from a Closed Space shows only its Corner and date to someone who is not in
 * that Space (stubs_for_profile does the hiding, not this component).
 * Nothing renders until there is a Stub.
 */
interface StubRow {
  event_id: number;
  starts_at: string;
  corner_space_slug: string | null;
  corner_slug: string | null;
  corner_name: string | null;
  space_name: string | null;
  event_title: string | null;
  neighborhood: string | null;
  city: string | null;
  redacted: boolean;
}

function StubTicket({ stub }: { stub: StubRow }) {
  const curated = stub.corner_space_slug && stub.corner_slug ? curatedFor(stub.corner_space_slug, stub.corner_slug) : undefined;
  const place = [stub.neighborhood, stub.city].filter(Boolean).join(", ");
  return (
    <li
      className="relative flex overflow-hidden rounded-card bg-[var(--cat)] text-[var(--ink)]"
      style={stub.corner_space_slug && stub.corner_slug ? cornerStyle(stub.corner_space_slug, stub.corner_slug) : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="flex items-center gap-2 text-caption font-semibold">
          <span aria-hidden="true">{curated?.emoji ?? <Ticket className="size-4" />}</span>
          {stub.corner_name ?? "Stub"}
        </span>
        {!stub.redacted && stub.event_title && (
          <span className="line-clamp-2 break-words" style={displayStyle(20, { lineHeight: 1.15 })}>{stub.event_title}</span>
        )}
        {!stub.redacted && stub.space_name && <span className="truncate text-small">{stub.space_name}</span>}
        {!stub.redacted && place && <span className="truncate text-caption">{place}</span>}
      </div>
      {/* The perforated edge: a dashed divider with a notch above and below. */}
      <div className="relative flex w-20 shrink-0 items-center justify-center border-l-2 border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)] px-2 text-center">
        <span className="absolute -top-2 -left-[9px] size-4 rounded-full bg-background" aria-hidden="true" />
        <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full bg-background" aria-hidden="true" />
        <time dateTime={stub.starts_at} className="text-caption font-semibold tabular-nums">
          {formatDate(stub.starts_at)}
        </time>
      </div>
    </li>
  );
}

export function StubsSection({ userId, className = "" }: { userId: string; className?: string }) {
  const [stubs, setStubs] = useState<StubRow[]>([]);
  const [byCorner, setByCorner] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.rpc("stubs_for_profile", { p_user_id: userId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.warn("[StubsSection] load failed:", error);
      setStubs((data as StubRow[] | null) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const groups = useMemo(() => {
    if (!byCorner) return [{ name: "", stubs }];
    const map = new Map<string, StubRow[]>();
    for (const s of stubs) map.set(s.corner_name ?? "Other", [...(map.get(s.corner_name ?? "Other") ?? []), s]);
    return [...map.entries()].map(([name, list]) => ({ name, stubs: list }));
  }, [stubs, byCorner]);

  if (stubs.length === 0) return null;

  return (
    <section className={className} aria-labelledby="stubs-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="stubs-title" className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
          Stubs
        </h2>
        <button
          type="button"
          aria-pressed={byCorner}
          onClick={() => setByCorner((v) => !v)}
          className={`h-11 rounded-control border px-4 text-small font-semibold ${
            byCorner ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground"
          }`}
        >
          Group by Corner
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.name || "all"} className="mb-6">
          {g.name && <h3 className="mb-2 text-small font-semibold">{g.name}</h3>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.stubs.map((s) => (
              <StubTicket key={s.event_id} stub={s} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
