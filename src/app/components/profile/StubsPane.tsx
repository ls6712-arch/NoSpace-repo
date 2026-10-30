import { fetchStubs } from "../../lib/profileApi";
import { stubBlock } from "../../lib/profileFormat";
import { ErrorNotice } from "../StateViews";
import { ListSkeleton } from "./Skeletons";
import { useSection } from "./useSection";

export function StubsPane({ profileId, owner }: { profileId: string; owner: boolean }) {
  const { state, reload } = useSection(() => fetchStubs(profileId), profileId);
  if (state.status === "loading") return <ListSkeleton />;
  if (state.status === "error") return <ErrorNotice onRetry={reload} />;
  if (state.value.length === 0) {
    return (
      <p className="py-6 text-small text-muted-foreground">
        {owner ? "No Stubs yet. Log a Moment toward a Pursuit to earn one." : "No Stubs yet"}
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
              <p className="truncate text-body font-semibold">{s.title ?? s.category ?? "Moment"}</p>
              {s.category && <p className="truncate text-small text-muted-foreground">{s.category}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
