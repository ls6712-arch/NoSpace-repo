import { useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "../components/ui/button";
import { ERROR_LINE, TRY_AGAIN } from "../lib/stateCopy";
import { NotFound } from "./NotFound";

/**
 * What a page shows when it throws while rendering or loading. Without it,
 * React Router shows its own developer screen ("Unexpected Application
 * Error!" and a stack trace) to everyone. Used twice in routes.ts: inside the
 * app shell, so the header and tab bar stay and the person can tap away, and
 * on the shell itself, in case the shell is what failed.
 *
 * "Try again" reloads the page, since a render that failed once usually fails
 * again from the same state; the reload keeps the URL.
 */
export function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  return (
    <div role="alert" className="flex min-h-[70vh] items-center justify-center px-6 animate-in fade-in duration-base">
      <div className="max-w-sm text-center">
        <h1 className="text-title mb-6">{ERROR_LINE}</h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="brand" onClick={() => window.location.reload()}>
            {TRY_AGAIN}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
