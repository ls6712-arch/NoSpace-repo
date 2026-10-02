import { Skeleton } from "./ui/skeleton";
import { cn } from "./ui/utils";
import { MOMENT_GRID, MOMENT_MEDIA } from "./MomentCard";

/**
 * Loading shapes for the app's repeated pieces. Each one copies the real
 * component's outer box (padding, aspect ratio, fixed row heights) so the
 * page doesn't shift when the real content swaps in. If you change one of
 * the real components' sizes, change its twin here.
 *
 * Text lines are drawn at the line-height of the text they stand in for,
 * with the visible bar a bit shorter, so the stack adds up to the same
 * height.
 */

function Line({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-full", className)} />;
}

/** Twin of MomentCard (feed / mySpace / Discover surfaces). */
export function MomentCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col">
      <Skeleton className={MOMENT_MEDIA} />
      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        {/* Avatar + name row: min-h-9 */}
        <div className="flex min-h-9 items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Line className="h-3 w-24" />
            <Line className="h-2.5 w-16" />
          </div>
        </div>
        {/* Caption: two lines at 17px/1.3 (19px on sm), min-h 2.6em */}
        <div className="mt-2 flex min-h-[2.6em] flex-col justify-center gap-2 text-[17px] leading-[1.3] sm:text-[19px]">
          <Line className="h-3.5 w-full" />
          <Line className="h-3.5 w-2/3" />
        </div>
        {/* Reaction row: pt-1.5 + h-10 */}
        <div className="mt-auto flex h-10 items-center gap-3 pt-1.5">
          <Line className="h-4 w-8" />
          <Line className="h-4 w-8" />
          <Line className="h-4 w-8" />
        </div>
      </div>
    </div>
  );
}

export function MomentGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(MOMENT_GRID, className)}>
      {Array.from({ length: count }, (_, i) => (
        <MomentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Twin of the Space / Corner card on Discover (4:5 art, p-3 with name + one line). */
export function SpaceCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-3">
        <div className="flex h-5 items-center">
          <Line className="h-3 w-3/4" />
        </div>
        <div className="mt-0.5 flex h-4 items-center">
          <Line className="h-2.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SpaceGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <SpaceCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Twin of a person row. `variant="card"` matches PersonCard (bordered,
 * size-11 avatar); `"row"` matches the plain list rows in dialogs and the
 * Space People tab (size-9 avatar, no border).
 */
export function PersonRowSkeleton({ variant = "card" }: { variant?: "card" | "row" }) {
  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Line className="h-3 w-28" />
          <Line className="h-2.5 w-20" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <Line className="h-3 w-28" />
        </div>
        <div className="mt-0.5 flex h-4 items-center">
          <Line className="h-2.5 w-36" />
        </div>
      </div>
    </div>
  );
}

export function PersonListSkeleton({ count = 4, variant = "row" }: { count?: number; variant?: "card" | "row" }) {
  return (
    <div className={variant === "card" ? "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "space-y-1"}>
      {Array.from({ length: count }, (_, i) => (
        <PersonRowSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

/** Twin of the profile header on a Shelf (PublicProfile). */
export function ProfileHeaderSkeleton() {
  return (
    <div className="mb-8 flex items-start gap-5 sm:gap-6">
      <Skeleton className="size-20 shrink-0 rounded-full sm:size-28" />
      <div className="min-w-0 flex-1">
        {/* h1: text-4xl/5xl leading-tight */}
        <div className="flex h-[2.8125rem] items-center sm:h-[3.75rem]">
          <Line className="h-7 w-56 max-w-full sm:h-9" />
        </div>
        <div className="mt-1.5 flex h-7 items-center">
          <Line className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="mt-2 flex h-5 items-center">
          <Line className="h-3 w-48" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-24 rounded-btn" />
          <Skeleton className="h-9 w-24 rounded-btn" />
        </div>
      </div>
    </div>
  );
}

/** Twin of PursuitCard (4:5 cover, p-4 with title and two meta lines). */
export function PursuitCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex h-5 items-center">
          <Line className="h-3.5 w-4/5" />
        </div>
        <div className="mt-1.5 flex h-4 items-center">
          <Line className="h-2.5 w-1/2" />
        </div>
        <div className="mt-2 flex h-4 items-center">
          <Line className="h-2.5 w-1/3" />
        </div>
      </div>
    </div>
  );
}

/** Twin of PursuitCompactCard (min-h-11 row with ring + three text lines). */
export function PursuitCompactSkeleton() {
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-2xl border border-border bg-card p-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Line className="h-2 w-12" />
        <Line className="h-3 w-24" />
        <Line className="h-2 w-16" />
      </div>
    </div>
  );
}

/** Twin of the top of a Pursuit page: owner row, title, meta line. */
export function PursuitHeaderSkeleton() {
  return (
    <>
      <div className="mb-2 flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-full" />
        <Line className="h-3 w-24" />
      </div>
      <div className="mb-2 flex h-9 items-center sm:h-10">
        <Line className="h-7 w-3/4 sm:h-8" />
      </div>
      <div className="mb-5 flex h-5 items-center">
        <Line className="h-3 w-56" />
      </div>
      <Skeleton className="mb-6 h-40 w-full rounded-2xl" />
    </>
  );
}

/** Twin of a notification / chat list row: avatar, two lines, time. */
export function ListRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Line className="h-3 w-3/5" />
        <Line className="h-2.5 w-2/5" />
      </div>
      <Line className="mt-1 h-2.5 w-8" />
    </div>
  );
}

export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Admin list cards (Corners, invites, reports): bordered rows in a space-y-3 list. */
export function CardListSkeleton({ count = 3, rowClassName = "h-24" }: { count?: number; rowClassName?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", rowClassName)} />
      ))}
    </div>
  );
}
