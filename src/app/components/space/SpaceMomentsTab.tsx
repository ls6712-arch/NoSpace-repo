import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { rowToPost } from "../../context/ContentContext";
import { useAuth } from "../../context/AuthContext";
import { MomentCard, MOMENT_GRID } from "../MomentCard";
import { MomentDetail } from "../MomentDetail";
import type { SpaceRow } from "../../lib/spaces";
import type { Post } from "../../data/posts";

export function SpaceMomentsTab({ space, isActiveMember }: { space: SpaceRow; isActiveMember: boolean }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[] | "loading">("loading");
  const [openPost, setOpenPost] = useState<Post | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      // RLS already scopes this to what the caller can actually see: an
      // approved link on an Open Space (or one they're an active member
      // of), plus their own pending links and a host's view of every
      // pending one. posts.user_id references auth.users, not profiles,
      // so there's no FK PostgREST can embed through — a separate
      // profiles lookup, same as ContentContext's own refetchRealPosts.
      const { data } = await supabase
        .from("space_moments")
        .select("added_at, posts(*)")
        .eq("space_id", space.id)
        .order("added_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []).map((r: any) => r.posts).filter(Boolean);
      const userIds = [...new Set(rows.map((p: any) => p.user_id as string))];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
        : { data: [] as { id: string; display_name: string }[] };
      const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));
      if (cancelled) return;
      setPosts(rows.map((row: any) => rowToPost(row, nameById.get(row.user_id) ?? "Someone")));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [space.id]);

  if (posts === "loading") return <div className="min-h-[30vh]" />;

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {isActiveMember ? "No Moments here yet. Be the first." : "No Moments here yet."}
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className={MOMENT_GRID}>
        {posts.map((post) => (
          <MomentCard key={post.id} post={post} surface="feed" onOpen={() => setOpenPost(post)} />
        ))}
      </div>
      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
