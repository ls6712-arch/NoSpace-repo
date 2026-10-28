import type { ReactNode } from "react";

/**
 * A Moment as a small paper card, a little crooked, like a stamp in a book:
 * the photo on cream, the Corner's name under it, then the date. `rotate` is
 * in degrees; callers derive it from the Moment's id so it stays the same
 * between renders (see tilt()).
 */
export function PaperStamp({
  title,
  date,
  rotate = 0,
  className = "",
  children,
}: {
  title: string;
  date: string;
  rotate?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-control bg-[var(--moment-paper)] p-2 pb-3 text-[var(--ink)] shadow-paper ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
      <p className="mt-2 truncate text-lead leading-none">{title}</p>
      <p className="text-caption">{date}</p>
    </div>
  );
}

/** A steady tilt between -4 and 4 degrees from an id, so a row of stamps is not ruler straight. */
export function tilt(id: string | number): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9) - 4;
}
