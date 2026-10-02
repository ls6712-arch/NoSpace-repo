import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";

/** True only for a real, loadable upload — a placeholder illustration makes
 * a poor cover photo, so it never shows up as a swatch option here. */
function hasRealMedia(post: Post) {
  return !!post.media && /^https?:\/\//.test(post.media);
}

/**
 * Owner-only "Edit cover" trigger + panel for the Studio's cover state
 * (sql/profile-cover.sql: cover_title, cover_tagline, cover_post_id — each
 * nullable, each falling back sensibly when unset). Title defaults to your
 * display name, tagline can start from your bio, and the photo picker offers
 * your most recently pinned Moments (or, lacking any, your most recent real
 * photos) — up to three swatches, matching the reference spec.
 */
export function CoverEditor({ posts }: { posts: Post[] }) {
  const { profile, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [postId, setPostId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const candidates = (() => {
    const withMedia = posts.filter(hasRealMedia);
    const pinned = withMedia.filter((p) => p.pinned);
    const pool = pinned.length > 0 ? pinned : withMedia;
    return pool.slice(0, 3);
  })();

  const openPanel = () => {
    setTitle(profile?.cover_title ?? profile?.display_name ?? "");
    setTagline(profile?.cover_tagline ?? profile?.bio ?? "");
    setPostId(profile?.cover_post_id ?? candidates[0]?.id ?? null);
    setOpen(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await updateProfile({
      cover_title: title.trim() || null,
      cover_tagline: tagline.trim() || null,
      cover_post_id: postId,
    });
    setSaving(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 rounded-control border border-on-media/40 bg-scrim-solid/35 px-3.5 py-1.5 text-small text-on-media transition-colors"
      >
        <Pencil className="size-3.5" />
        Edit cover
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim-solid/70 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="ns-paper-theme w-full max-w-[620px] rounded-control border border-[var(--line)] bg-[var(--paper-raised)] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lead" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                Make it yours
              </h2>
              <button
                type="button"
                onClick={() => !saving && setOpen(false)}
                aria-label="Close"
                className="text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <label className="mb-1 block text-caption text-[var(--ink-soft)]" htmlFor="cover-title">
              Title
            </label>
            <input
              id="cover-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="mb-4 w-full rounded-control border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-lead text-[var(--ink)] outline-none focus:border-[var(--coral-deep)]"
              style={{ fontFamily: "var(--font-serif)" }}
            />

            <label className="mb-1 block text-caption text-[var(--ink-soft)]" htmlFor="cover-tagline">
              Tagline
            </label>
            <textarea
              id="cover-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={2}
              maxLength={160}
              className="mb-4 w-full resize-none rounded-control border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-body italic text-[var(--ink)] outline-none focus:border-[var(--coral-deep)]"
              style={{ fontFamily: "var(--font-serif)" }}
            />

            <p className="mb-1.5 text-caption text-[var(--ink-soft)]">Cover photo</p>
            {candidates.length === 0 ? (
              <p className="mb-4 text-caption text-[var(--ink-faint)]">
                Pin a Moment with a photo first — that's what shows up here.
              </p>
            ) : (
              <div className="mb-5 flex gap-2">
                {candidates.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setPostId(post.id)}
                    className="h-16 w-[90px] shrink-0 overflow-hidden rounded-control"
                    style={{
                      border: postId === post.id ? "2px solid var(--coral-deep)" : "1px solid var(--line)",
                    }}
                    aria-label={`Use ${post.caption || "this photo"} as the cover`}
                    aria-pressed={postId === post.id}
                  >
                    <PostMedia
                      media={post.media}
                      type={post.type}
                      hobbySlug={post.hobbySlug}
                      seed={post.id}
                      preview
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-control px-4 py-2.5 text-small text-on-brand transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--coral-deep)" }}
            >
              {saving ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
