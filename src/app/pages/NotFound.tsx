import { Link } from "react-router";
import { Button } from "../components/ui/button";

export function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-display mb-4 text-gradient-brand">404</h1>
        <h2 className="text-title mb-4">This page doesn’t exist</h2>
        <p className="text-muted-foreground mb-6">
          Check the link, or go back home.
        </p>
        <Link to="/">
          <Button variant="brand">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
