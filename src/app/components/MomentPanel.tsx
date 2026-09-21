import { useState } from "react";
import { Post } from "../data/posts";
import { MomentCard } from "./MomentCard";
import { MomentDetail } from "./MomentDetail";

/**
 * My Space's single large "selected" Moment — ContactSheet picks which one,
 * this just shows it. The card itself (media, meta row, caption, actions)
 * is now the shared MomentCard (docs/moment-card-and-reactions-spec.md §2),
 * at lead size since this is the one prominent Moment on screen. My Space
 * excludes the signed-in user's own Moments from this feed (MySpaceGrid.tsx),
 * so `post` here is always someone else's — MomentCard always renders the
 * icon-only reaction row, never the owner's read-only counts row.
 */
export function MomentPanel({ post }: { post: Post }) {
  const [openDetail, setOpenDetail] = useState(false);

  return (
    <>
      <MomentCard post={post} surface="mySpace" size="lead" onOpen={() => setOpenDetail(true)} />
      <MomentDetail post={openDetail ? post : null} owned={false} onOpenChange={setOpenDetail} />
    </>
  );
}
