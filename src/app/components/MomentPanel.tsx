import { useState } from "react";
import { Link } from "react-router";
import { Bookmark, ArrowUpRight } from "lucide-react";
import { Post, postCorner } from "../data/posts";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { circles } from "../data/circles";
import { REACTIONS, useReactionState } from "./PostReactions";
import { usePursuitTitle } from "../lib/pursuitTitle";
import { toggleSaved, isSaved } from "../lib/journal";
import { MomentDetail } from "./MomentDetail";
import { Avatar, AvatarFallback } from "./ui/avatar";

const hasRealMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function visibilityLabel(post: Post): string {
  if (post.visibility === "circle" && post.circleId != null) {
    return circles.find((c) => c.id === post.circleId)?.name ?? "Circle";
  }
  return "PUBLIC";
}

function timeLabel(createdAt: number): string {
  const d = new Date(createdAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + `, ${time}`;
}

export function MomentPanel({ post }: { post: Post }) {
  const [openDetail, setOpenDetail] = useState(false);
  const { mine, toggle } = useReactionState(post.id);
  const [saved, setSaved] = useState(() => isSaved(post.id));
  const pursuitTitle = usePursuitTitle(post.pursuitId);

  const space = getHobby(post.hobbySlug)?.name;
  const cornerSlug = postCorner(post);
  const corner = cornerSlug ? (subHobbyLabel(cornerSlug) ?? cornerSlug) : undefined;
  const metaParts = [pursuitTitle, space, corner].filter(Boolean);
  const isTextOnly = !hasRealMedia(post);

  const bookmark = () => {
    toggleSaved(post.id);
    setSaved(isSaved(post.id));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <Link
          to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs">{initials(post.creator)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-base" style={{ fontFamily: "var(--font-serif)" }}>
              {post.creator}
            </span>
            {metaParts.length > 0 && (
              <span className="block truncate text-xs text-muted-foreground">
                {metaParts.join(" · ")}
              </span>
            )}
          </span>
        </Link>
        <span className="shrink-0 text-right">
          <span className="ns-section-kicker block rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            {visibilityLabel(post)}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{timeLabel(post.createdAt)}</span>
        </span>
      </div>

      <div className="mt-4">
        {isTextOnly ? (
          <p
            className="myspace-caption text-left italic sm:text-center"
            style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
          >
            "{post.caption}"
          </p>
        ) : (
          <>
            <img
              src={post.media}
              alt=""
              className="aspect-[4/3] w-full rounded-xl object-cover sm:aspect-[3/2] xl:aspect-[16/9]"
              style={{ maxHeight: "70dvh" }}
            />
            {post.caption && (
              <p className="myspace-caption mt-3 text-center italic text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
                "{post.caption}"
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        {/* Phone: three equal-width reaction buttons on their own row,
            Bookmark + OPEN on a second row. Tablet and up: all one row, as
            in the mockup. */}
        <ul className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
          {REACTIONS.map(({ id, label }) => {
            const pressed = mine.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggle(id)}
                  className={
                    "ns-section-kicker flex min-h-11 w-full items-center justify-center transition-colors sm:w-auto sm:justify-start " +
                    (pressed ? "text-accent" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-end gap-4 sm:mt-0 sm:justify-normal">
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Remove from Try This" : "Try This"}
            onClick={bookmark}
            className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bookmark className="size-4" style={{ fill: saved ? "currentColor" : "none" }} />
          </button>
          <button
            type="button"
            onClick={() => setOpenDetail(true)}
            className="ns-section-kicker flex min-h-11 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            OPEN
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </div>

      <MomentDetail post={openDetail ? post : null} owned={false} onOpenChange={setOpenDetail} />
    </div>
  );
}
