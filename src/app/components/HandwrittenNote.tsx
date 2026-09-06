/**
 * A short marginal note in a casual script, tilted like something actually
 * jotted by hand rather than laid out — used sparingly, on profile pages
 * only, where the page benefits from feeling a little personal.
 */
export function HandwrittenNote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hidden -rotate-2 text-right sm:block ${className}`} aria-hidden="true">
      <p
        className="text-2xl leading-tight text-[var(--forest)]"
        style={{ fontFamily: "var(--font-hand)" }}
      >
        {children}
      </p>
      <svg
        width="72"
        height="10"
        viewBox="0 0 72 10"
        className="ml-auto mt-0.5 text-[var(--coral-deep)]"
        fill="none"
      >
        <path
          d="M2 6c10-6 20-6 30-2s24 4 38-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
