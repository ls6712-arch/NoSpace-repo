/**
 * "Only you" — the closest existing thing to a private Moment. There is no
 * literal `private` value in `Visibility` yet (`public | circle | friends`);
 * `friends` depended on the now-retired Connections feature and is the
 * closest analog until Task C adds a real one. Structurally typed (not
 * `Post["visibility"]`) so this keeps working the moment that value exists,
 * with no signature change needed here or at any call site.
 */
export function isOnlyYou(post: { visibility: string }): boolean {
  return post.visibility === "friends" || post.visibility === "private";
}
