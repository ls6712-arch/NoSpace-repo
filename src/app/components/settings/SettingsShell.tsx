import { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SignUpPrompt } from "../SignUpPrompt";
import { SETTINGS_SECTIONS } from "./sections";

/**
 * The one shell every Settings route renders through. lg and up: a sticky
 * left sub-nav plus one section's content on the right (max 680px). Below
 * lg: /settings alone is an index list (chevron + one-line summary per
 * section); every other Settings route shows just that section with a
 * Back link. Both trees always render — which one shows is pure CSS
 * (hidden/lg:hidden) — so resizing across the breakpoint never loses
 * in-progress state.
 */
export function SettingsShell({
  activeKey,
  isIndexRoute = false,
  children,
}: {
  activeKey: string;
  /** True only for the bare /settings route: mobile shows the index list
   * instead of `children`, even though desktop still shows `children`
   * (Appearance) with Appearance marked active in the sub-nav. */
  isIndexRoute?: boolean;
  children: ReactNode;
}) {
  const active = SETTINGS_SECTIONS.find((s) => s.key === activeKey) ?? SETTINGS_SECTIONS[0];
  const { isConfigured, user } = useAuth();

  if (isConfigured && !user) {
    return (
      <SignUpPrompt
        title="Settings live here"
        body="Make an account to control your name, your privacy, and your data."
        cta="Create an account"
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Desktop / lg+ */}
      <div className="hidden lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <nav aria-label="Settings sections" className="sticky top-24 self-start">
          <h1 className="mb-5 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Settings
          </h1>
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((s) => {
              const isActive = s.key === active.key;
              return (
                <li key={s.key}>
                  <Link
                    to={s.path}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      "flex min-h-11 items-center gap-2.5 rounded-btn px-3 py-2 text-sm transition-colors " +
                      (isActive
                        ? "bg-accent/10 text-foreground"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground")
                    }
                  >
                    <span
                      className="ns-section-kicker w-4 shrink-0"
                      aria-hidden="true"
                      style={{ color: isActive ? "var(--accent)" : undefined }}
                    >
                      {s.n}
                    </span>
                    {s.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="max-w-[680px]">{children}</div>
      </div>

      {/* Mobile / below lg */}
      <div className="lg:hidden">
        {isIndexRoute ? (
          <>
            <h1 className="mb-6 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Settings
            </h1>
            <ul className="divide-y divide-[var(--hairline)] rounded-btn border border-border bg-card">
              {SETTINGS_SECTIONS.map((s) => (
                <li key={s.key}>
                  <Link
                    to={s.path}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                        {s.n} · {s.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {s.summary}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <Link
              to="/settings"
              className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Settings
            </Link>
            {children}
          </>
        )}
      </div>
    </div>
  );
}
