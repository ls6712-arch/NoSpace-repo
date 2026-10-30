import { Skeleton } from "../ui/skeleton";

export function IdentitySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="size-[84px] rounded-full" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

export function LevelSkeleton() {
  return <Skeleton className="h-44 w-full rounded-card" />;
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 min-[360px]:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-card" />
      ))}
    </div>
  );
}
