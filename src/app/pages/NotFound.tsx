import { Link } from "react-router";
import { Button } from "../components/ui/button";

export function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-8xl mb-4 text-gradient-brand">404</h1>
        <h2 className="text-2xl mb-4">This space doesn't exist</h2>
        <p className="text-muted-foreground mb-6">
          But eight other hobby spaces do, and they're worth a look.
        </p>
        <Link to="/">
          <Button variant="brand">Back home</Button>
        </Link>
      </div>
    </div>
  );
}
