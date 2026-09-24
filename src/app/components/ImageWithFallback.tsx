import React, { useState } from "react";

const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjZmZmIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==";

export function ImageWithFallback(
  props: React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode }
) {
  const [didError, setDidError] = useState(false);

  const handleError = () => setDidError(true);

  const { src, alt, style, className, fallback, ...rest } = props;

  if (didError && fallback) {
    return (
      <div className={className} style={style}>
        {fallback}
      </div>
    );
  }

  return didError ? (
    <div
      className={`inline-flex items-center justify-center bg-surface-muted text-center align-middle ${className ?? ""}`}
      style={style}
    >
      <img
        src={ERROR_IMG_SRC}
        alt="Error loading image"
        className="opacity-40"
        {...rest}
        data-original-url={src}
      />
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      {...rest}
      onError={handleError}
    />
  );
}
