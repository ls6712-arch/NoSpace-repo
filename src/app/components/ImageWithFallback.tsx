import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { variantSrcSet, variantUrl } from "../lib/imageVariants";
import { cn } from "./ui/utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading" | "width" | "height" | "srcSet"> & {
  src?: string | null;
  /** Describes the photo; leave "" for a purely decorative one. */
  alt?: string;
  /** Sizes and rounds the box (and is where `aspect-*`, `size-*`, `rounded-*` go). */
  className?: string;
  /** Classes for the <img> itself (hover zoom, object position). */
  imgClassName?: string;
  /**
   * The box's aspect ratio as CSS (`"4 / 3"`, `"1 / 1"`). Set it whenever the
   * box isn't already sized by `className`, so the page doesn't jump when the
   * photo arrives.
   */
  aspect?: string;
  fit?: "cover" | "contain";
  /** Above the fold: load now, at high priority. Everything else is lazy. */
  priority?: boolean;
  /** Display width in CSS px; when image transforms are on, a copy this size is requested. */
  width?: number;
  /** Shown instead of the default placeholder when the photo can't load. */
  fallback?: ReactNode;
  /** Called once when the photo (and its original, if a resized copy failed) can't load. */
  onFail?: () => void;
};

/**
 * The one way to show a photo. The box keeps its size while the photo loads
 * (a soft placeholder colour, then the photo fades in over it), loads lazily
 * unless `priority`, asks for a resized copy when image transforms are on, and
 * degrades the same way everywhere when the photo is missing or broken: the
 * resized copy falls back to the original, the original falls back to
 * `fallback` (or a quiet "photo unavailable" tile), never a broken-image glyph.
 */
export function ImageWithFallback({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  aspect,
  fit = "cover",
  priority = false,
  width,
  fallback,
  onFail,
  style,
  onLoad,
  onError,
  ...rest
}: Props) {
  const original = src ?? "";
  const resized = width && original ? variantUrl(original, { width }) : original;
  const [stage, setStage] = useState<"resized" | "original" | "failed">(original ? "resized" : "failed");
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setStage(original ? "resized" : "failed");
    setLoaded(false);
  }, [original]);

  // A cached photo is already complete before React attaches onLoad; show it at once, no fade.
  const setImg = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  const handleError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (e) => {
    onError?.(e);
    if (stage === "resized" && resized !== original) {
      setStage("original");
      return;
    }
    setStage("failed");
    onFail?.();
  };

  const boxStyle = { ...(aspect ? { aspectRatio: aspect } : null), ...style };

  if (stage === "failed") {
    return (
      <span
        role="img"
        aria-label={alt || "Photo unavailable"}
        className={cn("relative flex items-center justify-center overflow-hidden bg-surface-muted text-muted-foreground", className)}
        style={boxStyle}
      >
        {fallback ?? <ImageOff className="size-6" strokeWidth={1.6} aria-hidden="true" />}
      </span>
    );
  }

  const url = stage === "resized" ? resized : original;
  return (
    <span className={cn("relative block overflow-hidden bg-surface-muted", className)} style={boxStyle}>
      <img
        {...rest}
        ref={setImg}
        src={url}
        srcSet={stage === "resized" && width ? variantSrcSet(original, width) : undefined}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : null)}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={handleError}
        className={`size-full transition-opacity duration-base ease-standard ${fit === "contain" ? "object-contain" : "object-cover"} ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
      />
    </span>
  );
}
