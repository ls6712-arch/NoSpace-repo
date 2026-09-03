import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Plus, Users } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useRewards } from "../context/RewardsContext";
import { ContentCard } from "../components/ContentCard";
import { ProductCard } from "../components/ProductCard";
import { GeneratedArt } from "../components/GeneratedArt";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

function CirclesTab({
  hobbySlug,
}: {
  hobbySlug: string;
}) {
  const { circleFeed, isCircleJoined, joinCircle, leaveCircle } = useContent();
  const circles = circlesByHobby(hobbySlug);
  const [expanded, setExpanded] = useState<number | null>(null);

  if (circles.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No circles for this space yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {circles.map((circle) => {
        const joined = isCircleJoined(circle.id);
        const feed = expanded === circle.id ? circleFeed(circle.id) : [];
        return (
          <div key={circle.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{circle.name}</span>
                  {circle.location && (
                    <span className="text-xs text-muted-foreground">· {circle.location}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{circle.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Users className="size-3" />
                  {circle.memberCount.toLocaleString()} members
                </div>
              </div>
              <Button
                variant={joined ? "outline" : "brand"}
                size="sm"
                onClick={() => (joined ? leaveCircle(circle.id) : joinCircle(circle.id))}
              >
                {joined ? "Joined" : "Join"}
              </Button>
            </div>

            {joined && (
              <button
                type="button"
                className="text-xs text-[#38BDF8] mt-3"
                onClick={() => setExpanded((e) => (e === circle.id ? null : circle.id))}
              >
                {expanded === circle.id ? "Hide posts" : "View circle posts"}
              </button>
            )}

            {expanded === circle.id && (
              <div className="mt-3 space-y-2">
                {feed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing posted here yet.</p>
                ) : (
                  feed.map((post) => (
                    <div key={post.id} className="text-xs text-muted-foreground rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-foreground/90">{post.creator}: </span>
                      {post.caption}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CategoryFeed() {
  const { slug = "" } = useParams();
  const hobby = getHobby(slug);
  const { publicFeedByHobby, listingsByHobby, circleFeed, isCircleJoined, joinCircle, leaveCircle } =
    useContent();
  const { visitHobby } = useRewards();

  useEffect(() => {
    if (hobby) visitHobby(hobby.slug);
  }, [hobby?.slug]);

  if (!hobby) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl mb-4">That space doesn't exist</h2>
          <Link to="/">
            <Button variant="outline">Back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const posts = publicFeedByHobby(hobby.slug);
  const listings = listingsByHobby(hobby.slug);
  const circles = circlesByHobby(hobby.slug);

  return (
    <div className="min-h-screen">
      <section className="relative py-12 md:py-16 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${hobby.gradient} opacity-[0.12]`} />
        <div className="container mx-auto px-4 relative flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2">
              {hobby.plainLabel}
            </p>
            <h1 className="text-4xl md:text-5xl mb-3">{hobby.shortName}</h1>
            <p className="text-lg mb-2 italic text-muted-foreground">{hobby.tagline}</p>
            <p className="text-muted-foreground text-lg max-w-xl">{hobby.description}</p>
          </div>
          <div className="w-full max-w-xs md:w-72 md:max-w-none shrink-0 rounded-3xl overflow-hidden border border-white/10 bg-white/5">
            <GeneratedArt
              hobbySlug={hobby.slug}
              seed={hobby.slug}
              className="w-full h-auto aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <Tabs defaultValue="feed">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="feed">For you</TabsTrigger>
              <TabsTrigger value="circles">Circles{circles.length ? ` (${circles.length})` : ""}</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            </TabsList>
            <Link to={`/create?hobby=${hobby.slug}`} className="hidden sm:block">
              <Button variant="brand">
                <Plus className="size-4" />
                Contribute
              </Button>
            </Link>
          </div>

          <TabsContent value="feed">
            {posts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Nobody's posted here yet — be the first.
              </div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                {posts.map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="circles">
            <CirclesTab hobbySlug={hobby.slug} />
          </TabsContent>

          <TabsContent value="marketplace">
            {listings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No listings in this space yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {listings.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Contribute FAB for small screens */}
      <Link
        to={`/create?hobby=${hobby.slug}`}
        className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-white shadow-2xl [background-image:var(--gradient-brand)]"
      >
        <Plus className="size-4" />
        Contribute
      </Link>
    </div>
  );
}
