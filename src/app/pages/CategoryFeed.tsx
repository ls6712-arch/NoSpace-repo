import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Plus, Users, X } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { HobbyTile } from "../components/HobbyTile";
import { circlesByHobby } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useRewards } from "../context/RewardsContext";
import { ContentCard } from "../components/ContentCard";
import { ProductCard } from "../components/ProductCard";
import { GeneratedArt } from "../components/GeneratedArt";
import { HobbyActivity } from "../components/HobbyActivity";
import { usePeopleInHobby } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { PersonActions } from "../components/PersonActions";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Everyone present in this hobby — the people who post here and the people
 * exploring it. This is the intended way to find someone: through the craft
 * you both do, rather than a global list of accounts ranked by popularity.
 */
function PeopleTab({ hobbySlug, hobbyName }: { hobbySlug: string; hobbyName: string }) {
  const { people, loading } = usePeopleInHobby(hobbySlug);

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Looking…</div>;
  }

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Nobody's turned up in {hobbyName} yet. Share something here, or choose
          Keep exploring on a post, and you'll be the first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-5 max-w-lg text-sm text-muted-foreground">
        People who share {hobbyName} work here, or who are exploring it. No
        follower counts — tap through to see what they're making.
      </p>
      <PeopleRow people={people} />
    </div>
  );
}

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
          <div key={circle.id} className="rounded-2xl border border-border p-4">
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
                className="text-xs text-[var(--coral-text)] mt-3"
                onClick={() => setExpanded((e) => (e === circle.id ? null : circle.id))}
              >
                {expanded === circle.id ? "Hide updates" : "View updates"}
              </button>
            )}

            {expanded === circle.id && (
              <div className="mt-3 space-y-2">
                {feed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No updates here yet.</p>
                ) : (
                  feed.map((post) => (
                    <div key={post.id} className="text-xs text-muted-foreground rounded-lg bg-surface-muted px-3 py-2">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const hobby = getHobby(slug);
  // Which specific hobby the feed is narrowed to, e.g. ?hobby=pottery. Kept in
  // the URL so Discover can link straight into a filtered space and so a
  // filtered view is shareable.
  const activeSub = searchParams.get("hobby") ?? "";
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

  const allPosts = publicFeedByHobby(hobby.slug);
  const posts = activeSub ? allPosts.filter((p) => p.subHobby === activeSub) : allPosts;
  const listings = listingsByHobby(hobby.slug);
  const circles = circlesByHobby(hobby.slug);

  const countFor = (subSlug: string) =>
    allPosts.filter((p) => p.subHobby === subSlug).length;
  const activeLabel = hobby.subItems.find((s) => s.slug === activeSub)?.label;

  const setSub = (subSlug: string) => {
    const next = new URLSearchParams(searchParams);
    if (subSlug) next.set("hobby", subSlug);
    else next.delete("hobby");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen">
      <section className="relative py-12 md:py-16 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${hobby.gradient} opacity-[0.12]`} />
        <div className="container mx-auto px-4 relative flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-sm uppercase tracking-wide text-foreground mb-2">
              {hobby.plainLabel}
            </p>
            <h1 className="text-4xl md:text-5xl mb-3">{hobby.shortName}</h1>
            <p className="text-lg mb-2 italic text-foreground">{hobby.tagline}</p>
            <p className="text-foreground text-lg max-w-xl">{hobby.description}</p>
            {/* What's happening here — never how many people are watching. */}
            <HobbyActivity hobbySlug={hobby.slug} className="mt-3 text-foreground" />
            <div className="mt-4">
              <PersonActions hobbyKeys={[activeSub ?? `space:${hobby.slug}`]} />
            </div>
          </div>
          <div className="w-full max-w-xs md:w-72 md:max-w-none shrink-0 rounded-3xl overflow-hidden border border-border bg-surface-muted">
            <GeneratedArt
              hobbySlug={hobby.slug}
              seed={hobby.slug}
              className="w-full h-auto aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      <div className="bg-surface">
      {/* What's actually inside this space — pictures, not a word list. */}
      <section className="container mx-auto px-4 pt-10">
        <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-xl">What's inside {hobby.shortName}</h2>
            <p className="text-sm text-muted-foreground">
              {activeSub
                ? "Tap it again to see everything."
                : `${hobby.subItems.length} hobbies live here — tap one to narrow what you see.`}
            </p>
          </div>
          {activeSub && (
            <button
              type="button"
              onClick={() => setSub("")}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/30"
            >
              <X className="size-3" />
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {hobby.subItems.map((s) => (
            <HobbyTile
              key={s.slug}
              hobbySlug={hobby.slug}
              subSlug={s.slug}
              label={s.label}
              active={activeSub === s.slug}
              count={countFor(s.slug)}
              onClick={() => setSub(activeSub === s.slug ? "" : s.slug)}
            />
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pt-12 pb-24">
        <Tabs defaultValue="feed">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="feed">Work</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
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
            {activeSub && (
              <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                Showing
                <span className="rounded-full border border-[var(--coral-text)]/40 bg-[var(--coral-text)]/10 px-3 py-1 text-xs text-foreground">
                  {activeLabel ?? activeSub}
                </span>
                only
              </div>
            )}
            {posts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {activeSub ? (
                  <>
                    No {(activeLabel ?? activeSub).toLowerCase()} work yet — be the
                    first.
                    <div className="mt-4">
                      <Link to={`/create?hobby=${hobby.slug}&sub=${activeSub}`}>
                        <Button variant="brand" size="sm">
                          <Plus className="size-4" />
                          Create {(activeLabel ?? activeSub).toLowerCase()}
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  "Nobody's logged anything here yet — be the first."
                )}
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
                {posts.map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="people">
            <PeopleTab hobbySlug={hobby.slug} hobbyName={hobby.shortName.toLowerCase()} />
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
    </div>
  );
}
