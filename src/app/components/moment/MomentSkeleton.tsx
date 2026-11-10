import { Skeleton } from "../ui/skeleton";
import { MOMENT_LIST } from "./Moment";

/** The shape of Moments while a list loads: the header, the photo, the icon row. */
export function MomentListSkeleton({ count = 2, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`${MOMENT_LIST} ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 border-b border-border pb-5 pt-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-card" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-card" />
          <Skeleton className="h-11 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}
