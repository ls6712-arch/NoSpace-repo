import { useState } from "react";
import { Link } from "react-router";
import { useContent } from "../context/ContentContext";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { hobbyPhoto } from "../data/hobbyPhotos";
import { SubHobbyArt } from "./SubHobbyArt";

export interface HobbySession {
  /** Sub-hobby slug where tagged, else the space slug. */
  key: string;
  label: string;
  hobbySlug: string;
  subSlug?: string;
  sessions: number;
  firstAt: number;
}

/**
 * Your hobbies, counted. One session is one logged entry — every time you sat
 * down and did the thing. Sorted by how much you've done, so the shelf reads
 * as a picture of where your time actually goes.
 */
export function useSessionsByHobby(): HobbySession[] {
  const { myPosts } = useContent();

  const tally = new Map<string, HobbySession>();
  for (const post of myPosts) {
    const key = post.subHobby ?? `space:${post.hobbySlug}`;
    const existing = tally.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.firstAt = Math.min(existing.firstAt, post.createdAt);
      continue;
    }
    tally.set(key, {
      key,
      label: post.subHobby
        ? subHobbyLabel(post.subHobby) ?? post.subHobby
        : getHobby(post.hobbySlug)?.shortName ?? post.hobbySlug,
      hobbySlug: post.hobbySlug,
      subSlug: post.subHobby,
      sessions: 1,
      firstAt: post.createdAt,
    });
  }

  return [...tally.values()].sort((a, b) => b.sessions - a.sessions || a.firstAt - b.firstAt);
}

/** Progress toward the next round-number milestone (10 → 25 → 50 → 100 → 250). */
function progressFor(sessions: number) {
  const rungs = [10, 25, 50, 100, 250, 500];
  const next = rungs.find((r) => sessions < r) ?? 1000;
  const prev = rungs[rungs.indexOf(next) - 1] ?? 0;
  return {
    next,
    percent: Math.max(6, Math.round(((sessions - prev) / (next - prev)) * 100)),
  };
}

/** Each hobby stands on the shelf like a book, spine out, photo showing. */
function HobbyBook({ item }: { item: HobbySession }) {
  // Photography is the intent, but a dead image URL would leave a hole in the
  // shelf — so a failed load falls back to this hobby's own illustration,
  // which ships with the app and can't 404.
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : hobbyPhoto(item.subSlug ?? "", item.hobbySlug, 400);
  const { next, percent } = progressFor(item.sessions);
  const to = item.subSlug
    ? `/space/${item.hobbySlug}?hobby=${item.subSlug}`
    : `/space/${item.hobbySlug}`;

  return (
    <Link
      to={to}
      className="group relative flex w-[104px] shrink-0 flex-col overflow-hidden rounded-t-[3px] rounded-b-sm shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:-translate-y-1.5 sm:w-[124px]"
      title={`${item.label} — ${item.sessions} sessions, next milestone ${next}`}
    >
      {/* Spine image */}
      <div className="relative h-[150px] overflow-hidden sm:h-[184px]">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <SubHobbyArt
            hobbySlug={item.hobbySlug}
            subSlug={item.subSlug ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {/* Paper-edge highlight down the right side, so books read as objects */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-white/25" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/10" />
      </div>

      {/* Spine label */}
      <div className="bg-[#F3EDE0] px-2.5 pb-2.5 pt-2 text-[#2E2A24]">
        <div
          className="truncate text-[13px] leading-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {item.label}
        </div>
        <div className="mt-1 text-[10px] text-[#6E665B]">
          {item.sessions} {item.sessions === 1 ? "session" : "sessions"}
        </div>
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#DED5C4]">
          <div
            className="h-full rounded-full bg-[#9A6A45]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

/** The little end-piece that sits at the right of the shelf. */
function ShelfPlaque() {
  return (
    <div className="hidden w-[70px] shrink-0 flex-col items-center justify-center self-stretch rounded-sm bg-[#E4DCCB] px-2 py-4 text-center shadow-[0_6px_14px_rgba(0,0,0,0.4)] sm:flex">
      <span
        className="text-[11px] leading-snug text-[#5C5347]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Making space for things that matter.
      </span>
      <span className="mt-2 text-[#8A9B7A]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21c0-6 3-10 8-12-1 7-4 10-8 12Zm0 0c0-5-2.5-8.5-7-10 1 6 3.5 8.5 7 10Z" />
        </svg>
      </span>
    </div>
  );
}

/**
 * The shelf itself — a stylized wooden piece of furniture rather than a grid.
 * Built from CSS: layered warm browns for the carcass, a lip along the front
 * edge, and a soft inner shadow so the books look like they're sitting inside
 * something. Deliberately not photoreal.
 */
export function HobbyShelf({ items: override }: { items?: HobbySession[] } = {}) {
  const derived = useSessionsByHobby();
  const items = override ?? derived;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your shelf is empty. Log a session and it'll start filling up.
        </p>
        <Link
          to="/create"
          className="mt-4 inline-block rounded-full px-5 py-2 text-sm text-white [background-image:var(--gradient-brand)]"
        >
          Log your first session
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Carcass */}
      <div
        className="relative rounded-[18px] p-3 pb-0 shadow-[0_18px_40px_rgba(0,0,0,0.5)] sm:p-4 sm:pb-0"
        style={{
          background:
            "linear-gradient(160deg, var(--wood-light) 0%, var(--wood) 42%, var(--wood-dark) 100%)",
        }}
      >
        {/* Inner recess */}
        <div
          className="relative overflow-hidden rounded-[10px] px-3 pt-4"
          style={{
            background: "linear-gradient(180deg, #3C2C20 0%, #4A3728 100%)",
            boxShadow: "inset 0 8px 18px rgba(0,0,0,0.55)",
          }}
        >
          <div className="flex items-end gap-2 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {items.map((item) => (
              <HobbyBook key={item.key} item={item} />
            ))}
            <ShelfPlaque />
          </div>
        </div>

        {/* Front lip of the shelf board */}
        <div
          className="h-3 rounded-b-[14px] sm:h-4"
          style={{
            background:
              "linear-gradient(180deg, var(--wood-light) 0%, var(--wood) 55%, var(--wood-dark) 100%)",
            boxShadow: "0 6px 12px rgba(0,0,0,0.45)",
          }}
        />
      </div>
    </div>
  );
}
