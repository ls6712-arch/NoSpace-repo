import { Link } from "react-router";
import type { Post } from "../../data/posts";
import { useAuth } from "../../context/AuthContext";
import { postCornerKey } from "../../lib/discoverFeed";
import { hasStartGuide, startPath } from "../../lib/startContent";
import { cn } from "../ui/utils";

/**
 * "Do this": the way from someone's Moment to the Start page for its Corner,
 * carrying the Moment so the page can say "Inspired by {name}". Only where the
 * Corner has a guide (there is a first step to show), and never on your own
 * Moment.
 */
export function DoThisLink({ post, className, onClick }: { post: Post; className?: string; onClick?: () => void }) {
  const { user } = useAuth();
  const [space = "", corner = ""] = postCornerKey(post).split("/");
  if (!corner || !hasStartGuide(space, corner) || (post.userId && post.userId === user?.id) || post.isPrivateLog) return null;
  return (
    <Link
      to={startPath(space, corner, { inspired: post.id })}
      onClick={onClick}
      className={cn("inline-flex min-h-11 items-center rounded-full border border-foreground/30 px-5 text-body font-semibold text-foreground", className)}
    >
      Do this
    </Link>
  );
}
