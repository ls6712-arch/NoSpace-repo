import { fetchStubs, type StubItem } from "../../lib/profileApi";
import { cornerName } from "../../lib/homeItems";
import { editionLabel } from "../../lib/stubs";
import { formatMonth } from "../../lib/dates";
import { stubBlock } from "../../lib/profileFormat";
import { ErrorNotice } from "../StateViews";
import { ListSkeleton } from "./Skeletons";
import { useSection } from "./useSection";

const corner = (s: StubItem) => (s.cornerKey ? cornerName(s.cornerKey) : null);

/** Interim rows until the Shelf PR: the title, and one quiet line for the kind. */
function stubTitle(s: StubItem): string {
  if (s.kind === "regular") return corner(s) ?? "Stub";
  return s.title ?? corner(s) ?? "Stub";
}
function stubLine(s: StubItem): string | null {
  switch (s.kind) {
    case "drop":
      return s.drop ? editionLabel(s.drop.edition) : null;
    case "regular":
      return s.period ? `10 days in ${formatMonth(`${s.period}-01T12:00:00`)}` : null;
    case "event":
      return s.event?.full ? s.event.spaceName : corner(s);
    default:
      return "Pursuit finished";
  }
}

export function StubsPane({ profileId, owner }: { profileId: string; owner: boolean }) {
  const { state, reload } = useSection(() => fetchStubs(profileId), profileId);
  if (state.status === "loading") return <ListSkeleton />;
  if (state.status === "error") return <ErrorNotice onRetry={reload} />;
  if (state.value.length === 0) {
    return (
      <p className="py-6 text-small text-muted-foreground">
        {owner ? "No Stubs yet. Finish a Pursuit or go to an event to earn one." : "No Stubs yet"}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {state.value.map((s) => {
        const b = stubBlock(s);
        return (
          <li key={s.id} className="flex items-center gap-4 rounded-card border border-border bg-card p-3">
            <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-control bg-surface-muted" aria-hidden="true">
              <span className="text-caption text-muted-foreground">{b.month}</span>
              <span className="text-lead font-bold leading-none">{b.day}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-body font-semibold">{stubTitle(s)}</p>
              {stubLine(s) && <p className="truncate text-small text-muted-foreground">{stubLine(s)}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
