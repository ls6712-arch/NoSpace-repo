import { useState } from "react";
import { Link } from "react-router";
import { Post } from "../data/posts";
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

/** Turns a set of logged posts into per-hobby session counts, most-logged first. */
export function sessionsFromPosts(posts: Post[]): HobbySession[] {
  const tally = new Map<string, HobbySession>();
  for (const post of posts) {
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

/** Your own hobbies, counted. One session is one logged entry. */
export function useSessionsByHobby(): HobbySession[] {
  const { myPosts } = useContent();
  return sessionsFromPosts(myPosts);
}

/** Progress toward the next round-number milestone. */
function progressFor(sessions: number) {
  const rungs = [10, 25, 50, 100, 250, 500];
  const next = rungs.find((r) => sessions < r) ?? 1000;
  const prev = rungs[rungs.indexOf(next) - 1] ?? 0;
  return { next, percent: Math.max(8, Math.round(((sessions - prev) / (next - prev)) * 100)) };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Real shelves have uneven books. Heights vary deterministically per hobby,
 * and stay well taller than the book is wide — a book that isn't clearly
 * portrait reads as a card lying down.
 */
const HEIGHTS = [176, 196, 212, 184, 204];
const PLAQUE_HEIGHT = 176;
/** Cloth colours for the lower part of the spine, so a row isn't monotone. */
const CLOTHS = ["#EFE7D6", "#E7DCC6", "#F2EADB", "#E3D8C2"];

function HobbyBook({ item }: { item: HobbySession }) {
  // Photography is the intent, but a dead URL would leave a hole in the shelf,
  // so a failed load falls back to this hobby's own illustration.
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : hobbyPhoto(item.subSlug ?? "", item.hobbySlug, 400);
  const { next, percent } = progressFor(item.sessions);
  const h = hash(item.key);
  const height = HEIGHTS[h % HEIGHTS.length];
  const cloth = CLOTHS[(h >> 3) % CLOTHS.length];
  const to = item.subSlug
    ? `/space/${item.hobbySlug}?hobby=${item.subSlug}`
    : `/space/${item.hobbySlug}`;

  return (
    <Link
      to={to}
      className="group relative flex w-[78px] shrink-0 flex-col justify-end overflow-hidden rounded-[2px] transition-transform duration-300 ease-out hover:-translate-y-2 sm:w-[116px]"
      style={{
        height,
        boxShadow:
          "0 10px 16px -6px rgba(0,0,0,0.65), inset -3px 0 6px -3px rgba(0,0,0,0.5), inset 2px 0 0 rgba(255,255,255,0.10)",
      }}
      title={`${item.label} — ${item.sessions} sessions, next milestone ${next}`}
    >
      {/* Spine image */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        ) : (
          <SubHobbyArt
            hobbySlug={item.hobbySlug}
            subSlug={item.subSlug ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        )}
        {/* Warm light from upper left, and a darker gutter on the right */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(255,240,214,0.16)_0%,transparent_38%,rgba(0,0,0,0.30)_100%)]" />
      </div>

      {/* Cloth-bound lower spine */}
      <div className="px-2 pb-2 pt-1.5" style={{ backgroundColor: cloth }}>
        <div
          className="truncate text-[12px] leading-tight text-[#2E2A24]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
        >
          {item.label}
        </div>
        <div className="mt-0.5 text-[9.5px] text-[#736A5D]">
          {item.sessions} {item.sessions === 1 ? "session" : "sessions"}
        </div>
        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-black/12">
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: "linear-gradient(90deg,#B07A4E,#8A5C36)",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

/* ---------- Small objects that live on the shelf alongside the books ---------- */

function Vase() {
  return (
    <svg width="30" height="62" viewBox="0 0 30 62" className="shrink-0" aria-hidden="true">
      <path
        d="M11 4h8l-1.5 8c5 3.5 7.5 8 7.5 14 0 8-4.5 13-10 13S5 34 5 26c0-6 2.5-10.5 7.5-14L11 4Z"
        fill="#DCD2BE"
      />
      <path d="M11 4h8l-.6 3.2h-6.8L11 4Z" fill="#C4B79E" />
      <ellipse cx="12" cy="26" rx="2.6" ry="6" fill="#EDE6D6" opacity="0.65" />
    </svg>
  );
}

function TrailingPlant() {
  return (
    <svg width="52" height="76" viewBox="0 0 52 76" className="shrink-0" aria-hidden="true">
      {/* pot */}
      <path d="M14 40h24l-3 20a3 3 0 0 1-3 2.6H20A3 3 0 0 1 17 60L14 40Z" fill="#B4744F" />
      <rect x="12" y="35" width="28" height="7" rx="2" fill="#C6845C" />
      {/* vines trailing over the edge */}
      <path d="M20 38c-5 6-8 16-6 30" stroke="#7C8A54" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M32 38c5 5 8 12 8 22" stroke="#8C9A62" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M26 34c0-8 3-14 9-18" stroke="#7C8A54" strokeWidth="2" fill="none" strokeLinecap="round" />
      {[
        [14, 52], [15, 60], [13, 68], [40, 50], [41, 58], [39, 65],
        [30, 22], [34, 16], [27, 27],
      ].map(([cx, cy], i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx="5"
          ry="3.4"
          fill={i % 2 ? "#A9B98C" : "#7C8A54"}
          transform={`rotate(${i % 2 ? -25 : 20} ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

function Stone() {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" className="shrink-0" aria-hidden="true">
      <path d="M4 22c-4-6 0-16 9-19 8-2.6 17 2 19 10 1.4 5.6-1 9-6 9H4Z" fill="#9E9689" />
      <path d="M11 6c4-2.4 9-2 12 1" stroke="#B5AE9F" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** The linen end-board that closes out the last shelf. */
function Plaque() {
  return (
    <div
      className="flex w-[62px] shrink-0 flex-col items-center justify-center rounded-[2px] px-2 py-3 text-center sm:w-[86px]"
      style={{
        height: PLAQUE_HEIGHT,
        backgroundColor: "#DED4BE",
        boxShadow: "0 10px 16px -6px rgba(0,0,0,0.6), inset 2px 0 0 rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="text-[10.5px] leading-snug text-[#5C5347]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Making space for things that matter.
      </span>
      <span className="mt-1.5 text-[#7C8A54]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21c0-6 3-10 8-12-1 7-4 10-8 12Zm0 0c0-5-2.5-8.5-7-10 1 6 3.5 8.5 7 10Z" />
        </svg>
      </span>
    </div>
  );
}

/** One shelf: the books standing on it, then the board they rest on. */
function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="relative flex items-end gap-[4px] overflow-hidden px-2.5 sm:gap-[5px] sm:px-3">
        {children}
        {/* Contact shadow, sitting right where everything meets the board */}
        <div className="pointer-events-none absolute inset-x-1 bottom-0 h-3 bg-[radial-gradient(ellipse_at_50%_100%,rgba(0,0,0,0.6),transparent_70%)]" />
      </div>
      {/* The board */}
      <div
        className="h-[10px] rounded-[2px]"
        style={{
          background: "linear-gradient(180deg,#8A6A49 0%,#6B4E35 55%,#4A3728 100%)",
          boxShadow: "0 5px 10px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

const PER_SHELF = 4;

/**
 * The bookcase. Hobbies stand on it as books — spine photo out, cloth-bound
 * lower spine with the session count — and the case fills downward, a new
 * shelf at a time, as more hobbies get logged.
 *
 * Everything here is CSS and inline SVG: layered warm browns with a grain
 * pattern for the carcass, per-book contact shadows for depth, and a few
 * ceramic and plant objects for company. Deliberately stylized rather than
 * photoreal — it should read as a drawing of a shelf, not a bad photograph
 * of one.
 */
export function HobbyShelf({ items: override }: { items?: HobbySession[] } = {}) {
  const derived = useSessionsByHobby();
  const items = override ?? derived;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          This shelf is empty. Log a session and it starts filling up.
        </p>
        <Link
          to="/create"
          className="mt-4 inline-block rounded-full px-5 py-2 text-sm text-white [background-image:var(--gradient-brand)]"
        >
          Log the first session
        </Link>
      </div>
    );
  }

  // Chunk into shelves, so the case grows downward instead of scrolling sideways.
  const rows: HobbySession[][] = [];
  for (let i = 0; i < items.length; i += PER_SHELF) rows.push(items.slice(i, i + PER_SHELF));
  const lastRow = rows[rows.length - 1];
  const roomOnLastShelf = PER_SHELF - lastRow.length;

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-2.5 pt-3 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.75)] sm:p-3 sm:pt-4"
      style={{
        background:
          "repeating-linear-gradient(93deg,rgba(0,0,0,0.055)_0px,rgba(0,0,0,0.055)_1px,transparent_1px,transparent_6px)," +
          "linear-gradient(160deg,#8A6A49 0%,#6B4E35 45%,#4A3728 100%)",
      }}
    >
      {/* Interior back panel */}
      <div
        className="rounded-[12px] pt-3"
        style={{
          background: "linear-gradient(180deg,#2E2118 0%,#3B2C20 55%,#33261B 100%)",
          boxShadow:
            "inset 0 14px 28px rgba(0,0,0,0.72), inset 0 -6px 14px rgba(0,0,0,0.45), inset 6px 0 14px rgba(0,0,0,0.35)",
        }}
      >
        {rows.map((row, rowIndex) => {
          const isLast = rowIndex === rows.length - 1;
          return (
            <div key={rowIndex} className={rowIndex > 0 ? "pt-4" : undefined}>
              <Shelf>
                {/* A plant trails from the left of the top shelf — desktop
                    only, since a phone shelf needs every pixel for books. */}
                {rowIndex === 0 && (
                  <span className="hidden sm:block">
                    <TrailingPlant />
                  </span>
                )}

                {row.map((item) => (
                  <HobbyBook key={item.key} item={item} />
                ))}

                {/* On a shelf that isn't full, the objects sit at the far end
                    and the books at the near one — so the empty run between
                    them reads as a styled shelf rather than a gap. */}
                {isLast && roomOnLastShelf > 0 && (
                  <div className="ml-auto flex shrink-0 items-end gap-2 sm:gap-3">
                    {roomOnLastShelf > 2 && <Stone />}
                    {roomOnLastShelf > 1 && <Vase />}
                    <Plaque />
                  </div>
                )}
              </Shelf>
            </div>
          );
        })}
      </div>

      {/* Warm light falling in from the top-left of the case */}
      <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(130%_80%_at_12%_-10%,rgba(255,232,190,0.14),transparent_58%)]" />
    </div>
  );
}
