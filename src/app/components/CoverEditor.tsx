import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { captureOpener, restoreFocus } from "../lib/returnFocus";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";
import { Button } from "./ui/button";
import { notify } from "./ui/toaster";
import { TOAST } from "../lib/stateCopy";
import { InlineError } from "./StateViews";

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
  const [error, setError] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

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
    setError(null);
    const result = await updateProfile({
      cover_title: title.trim() || null,
      cover_tagline: tagline.trim() || null,
      cover_post_id: postId,
    });
    setSaving(false);
    // Keep the dialog (and what was typed) open on failure.
    if (result?.error) return setError(result.error);
    notify(TOAST.changesSaved);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 rounded-[20px] border px-3.5 py-1.5 text-sm text-white transition-colors"
        style={{
          backgroundColor: "rgba(42,36,29,0.35)",
          borderColor: "rgba(248,242,229,0.4)",
        }}
      >
        <Pencil className="size-3.5" />
        Edit cover
      </button>

      {/* Radix Dialog: focus moves in, Escape and the backdrop close it,
          focus returns to "Edit cover", and the page behind can't scroll.
          It stays put while a save is in flight. */}
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-[80] ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast"
            style={{ backgroundColor: "rgba(20,17,13,0.72)" }}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onOpenAutoFocus={() => {
              opener.current = captureOpener();
            }}
            onCloseAutoFocus={(e) => {
              if (restoreFocus(opener.current)) e.preventDefault();
            }}
            className="ns-paper-theme fixed top-1/2 left-1/2 z-[80] max-h-[90vh] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-md border border-[var(--line)] bg-[var(--paper-raised)] p-8 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-base data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast"
          >
            <div className="mb-5 flex items-center justify-between">
              <DialogPrimitive.Title className="text-[19px]" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                Make it yours
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                disabled={saving}
                aria-label="Close"
                className="text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <label className="mb-1 block text-[12.5px] text-[var(--ink-soft)]" htmlFor="cover-title">
              Title
            </label>
            <input
              id="cover-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="mb-4 w-full rounded border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[17px] text-[var(--ink)] outline-none focus:border-[var(--coral-deep)]"
              style={{ fontFamily: "var(--font-serif)" }}
            />

            <label className="mb-1 block text-[12.5px] text-[var(--ink-soft)]" htmlFor="cover-tagline">
              Tagline
            </label>
            <textarea
              id="cover-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={2}
              maxLength={160}
              className="mb-4 w-full resize-none rounded border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[14.5px] italic text-[var(--ink)] outline-none focus:border-[var(--coral-deep)]"
              style={{ fontFamily: "var(--font-serif)" }}
            />

            <p className="mb-1.5 text-[12.5px] text-[var(--ink-soft)]">Cover photo</p>
            {candidates.length === 0 ? (
              <p className="mb-4 text-xs text-[var(--ink-faint)]">
                Pin a Moment with a photo first — that’s what shows up here.
              </p>
            ) : (
              <div className="mb-5 flex gap-2">
                {candidates.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setPostId(post.id)}
                    className="h-16 w-[90px] shrink-0 overflow-hidden rounded"
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

            <InlineError message={error} className="mb-2 text-center" />
            <Button type="button" variant="coral" className="h-auto w-full py-2.5" onClick={save} busy={saving}>
              Done
            </Button>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
