import { Link, useParams } from "react-router";
import { hobbies } from "../data/hobbies";
import { useCorners } from "../context/CornersContext";
import { useContent } from "../context/ContentContext";
import { ContentCard } from "../components/ContentCard";
import { Button } from "../components/ui/button";

/**
 * A single Corner's own page — Feed/Moments only, no Work/People/Circles/
 * Marketplace/Contribute sub-tabs like the full Space page has. The one way
 * back is the link to the parent Space; there's no other navigation here.
 */
export function CornerPage() {
  const { slug = "" } = useParams();
  const { cornersFor } = useCorners();
  const { publicFeed } = useContent();

  // A Corner's slug is only unique within its own Space — two different
  // Spaces could each have a corner slugged "basics". This flat route can't
  // disambiguate that, so it resolves to the first match across every
  // Space's corners.
  // TODO: hobbies.ts's subItems already has a few slugs that collide across
  // Spaces today (e.g. "trading-cards" in both Gaming & Tabletop and
  // Collecting & Fandom) — this silently opens whichever Space's corner
  // comes first in `hobbies`. Needs a real disambiguation key
  // (spaceSlug + slug) if this becomes a visible problem.
  let corner: { spaceSlug: string; slug: string; name: string } | undefined;
  for (const hobby of hobbies) {
    const found = cornersFor(hobby.slug).find((c) => c.slug === slug);
    if (found) {
      corner = found;
      break;
    }
  }

  if (!corner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl mb-4">That corner doesn't exist</h2>
          <Link to="/">
            <Button variant="outline">Back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const spaceSlug = corner.spaceSlug;
  const posts = publicFeed.filter((p) => p.hobbySlug === spaceSlug && p.subHobby === corner.slug);

  return (
    <div className="min-h-screen">
      <section className="container mx-auto px-4 pt-14">
        <Link
          to={`/space/${spaceSlug}`}
          className="mb-3 inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to {hobbies.find((h) => h.slug === spaceSlug)?.shortName ?? spaceSlug}
        </Link>
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          {corner.name}
        </h1>
      </section>

      <section className="container mx-auto px-4 pt-8 pb-24">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No {corner.name.toLowerCase()} work yet. Be the first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <ContentCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
