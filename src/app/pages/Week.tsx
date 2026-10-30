import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { WEEK_PLACEHOLDER, WEEK_SIGNED_OUT } from "../lib/homeCopy";

/**
 * Week: a placeholder for now, behind the Week tab. No data yet. Someone not
 * signed in gets the same sign-up prompt as You.
 */
export function Week() {
  const { user, isConfigured } = useAuth();
  if (isConfigured && !user) {
    return <SignUpPrompt title={WEEK_SIGNED_OUT.title} body={WEEK_SIGNED_OUT.body} cta={WEEK_SIGNED_OUT.cta} />;
  }
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-8 pt-6">
      <h1 className="text-display font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
        {WEEK_PLACEHOLDER.title}
      </h1>
      <p className="text-body text-muted-foreground">{WEEK_PLACEHOLDER.line}</p>
      <Link to="/my-space" className="inline-flex min-h-11 items-center text-body font-semibold text-accent-text underline-offset-4 hover:underline">
        {WEEK_PLACEHOLDER.back}
      </Link>
    </div>
  );
}
