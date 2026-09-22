import { Post } from "../../data/posts";

export type MediaFilter = "all" | "photo" | "video" | "written";

export function matchesMediaFilter(post: Post, filter: MediaFilter): boolean {
  return filter === "all" || post.type === filter;
}
