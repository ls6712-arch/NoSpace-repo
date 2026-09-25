import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ImageOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchSharedMoment } from "../lib/sharedContent";
import { Post } from "../data/posts";
import { MomentDetail } from "../components/MomentDetail";

/**
 * A standalone Moment page — the one place a Moment shared into a chat (or
 * any other link) can point to, since Moments otherwise only ever open as a
 * dialog from inside whatever grid they're already sitting in (My Space,
 * the Shelf, Discover…), with no URL of their own. Reuses MomentDetail
 * as-is: it already renders itself as a Dialog, open whenever `post` is set.
 *
 * Loaded under the viewer's own permissions (fetchSharedMoment, RLS-gated),
 * same as the compact card inside a chat bubble — a private or
 * followers-only Moment the viewer can't see comes back empty here too,
 * shown as "Not available" rather than a 404 (a 404 would say "no such
 * Moment"; this says "not for you", the same overloading a private/deleted
 * row already gets everywhere else in Phase 4).
 */
export function MomentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setPost(null);
    if (!id) {
      setLoaded(true);
      return;
    }
    (async () => {
      const result = await fetchSharedMoment(id);
      if (!cancelled) {
        setPost(result);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!loaded) return null;

  if (!post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <ImageOff className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This Moment isn't available — it may be private, deleted, or shared by someone you don't
          follow.
        </p>
      </div>
    );
  }

  return (
    <MomentDetail post={post} owned={post.userId === user?.id} onOpenChange={(open) => !open && navigate(-1)} />
  );
}
