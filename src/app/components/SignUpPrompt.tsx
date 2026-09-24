import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";

/**
 * The ask, made where it's earned. Shown in place of a page that genuinely
 * needs an account — never at the front door. By the time someone sees this
 * they've already browsed the spaces and decided they want to keep something,
 * so the invitation can be specific about what they get.
 *
 * Carries the current location through as `redirect`, so signing up returns
 * you to whatever you were trying to do.
 */
export function SignUpPrompt({
  title,
  body,
  cta = "Create an account",
}: {
  title: string;
  body: string;
  cta?: string;
}) {
  const { pathname, search } = useLocation();
  const redirect = encodeURIComponent(`${pathname}${search}`);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass-panel glow-violet w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h2>
        <p className="mb-7 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="flex flex-col gap-2.5">
          <Link to={`/login?redirect=${redirect}`}>
            <Button variant="brand" className="w-full" size="lg">
              {cta}
            </Button>
          </Link>
          <Link to="/discover">
            <Button variant="outline" className="w-full">
              Keep looking around
            </Button>
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground/70">
          Browsing stays free. An account is only for keeping what you make.
        </p>
      </div>
    </div>
  );
}
