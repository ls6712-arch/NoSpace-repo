import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { subHobbyLabel } from "../data/hobbies";
import { categoriesFor, postInCategory } from "../data/categories";
import { circles } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useCategories } from "../context/CategoriesContext";
import { peopleInHobby, type Person } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { ContentCard } from "../components/ContentCard";
import { Button } from "../components/ui/button";

/**
 * Everything under one category: the work, the people, the Circles.
 *
 * A category is a lens over content that already exists — nothing here is
 * stored on a post. A post arrives because what its maker typed, or the
 * sub-hobby they picked, matches this category's vocabulary. That's why
 * adding a category can never orphan anyone's work: the work was never
 * labelled with the old one.
 */
export function CategoryPage() {
  const { slug = "" } = useParams();
  const { publicFeed } = useContent();
  const { categories } = useCategories();
  const [people, setPeople] = useState<Person[]>([]);

  const category = categories.find((c) => c.slug === slug);

  const posts = useMemo(() => {
    if (!category) return [];
    return publicFeed.filter((p) => postInCategory(p, category.slug, subHobbyLabel));
  }, [publicFeed, category?.slug]);

  // The Spaces feeding this category, so a quiet category still leads on.
  const relatedSpaces = useMemo(() => {
    if (!category) return [];
    const slugs = new Set(posts.map((p) => p.hobbySlug));
    return [...slugs];
  }, [posts, category?.slug]);

  const relatedCircles = useMemo(
    () =>
      category
        ? circles
            .filter((c) =>
              categoriesFor(c.name).some((cat) => cat.slug === category.slug) ||
              relatedSpaces.includes(c.hobbySlug),
            )
            .slice(0, 4)
        : [],
    [category?.slug, relatedSpaces],
  );

  useEffect(() => {
    if (relatedSpaces.length === 0) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    Promise.all(relatedSpaces.slice(0, 3).map((s) => peopleInHobby(s, 8)))
      .catch(() => [] as Person[][])
      .then((rows) => {
        if (cancelled) return;
        const seen = new Map<string, Person>();
        for (const set of rows.flat()) if (!seen.has(set.id)) seen.set(set.id, set);
        setPeople([...seen.values()].slice(0, 9));
      });
    return () => {
      cancelled = true;
    };
  }, [relatedSpaces.join(",")]);

  if (!category) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            No category here
          </h2>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-11 sm:py-14">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `color-mix(in srgb, ${category.tint} 30%, var(--cream))` }}
        />
        <div className="container mx-auto max-w-5xl px-4 relative">
          <Link
            to="/discover"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Discover
          </Link>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
            {category.name}
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-foreground">{category.description}</p>

          {category.examples.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {category.examples.map((e) => (
                <li key={e}>
                  <Link
                    to={`/discover?about=${encodeURIComponent(e)}`}
                    className="inline-flex rounded-full border border-[var(--hairline)] bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground"
                  >
                    {e}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="bg-surface pb-24 pt-8">
        <div className="container mx-auto max-w-5xl px-4">
          {people.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                People here
              </h2>
              <PeopleRow people={people} />
            </section>
          )}

          <section className="mb-10">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Work in {category.name.toLowerCase()}
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {posts.length === 0
                ? "Nothing here yet."
                : `${posts.length} ${posts.length === 1 ? "piece" : "pieces"} of work.`}
            </p>

            {posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="mx-auto mb-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Nobody's shared anything under {category.name.toLowerCase()} yet.
                  You don't need permission — type your own hobby when you create
                  something and it'll turn up here.
                </p>
                <Link to="/create">
                  <Button variant="coral">
                    <Plus className="size-4" />
                    Create something
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {posts.slice(0, 24).map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>

          {relatedCircles.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                Circles to join
              </h2>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {relatedCircles.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/circles"
                      className="flex h-full flex-col rounded-2xl border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
                    >
                      <span className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                        {c.name}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">{c.purpose}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
