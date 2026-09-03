import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { hobbies } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { ProductCard } from "../components/ProductCard";
import { Button } from "../components/ui/button";

export function Shop() {
  const [searchParams] = useSearchParams();
  const { listings } = useContent();
  const hobbyParam = searchParams.get("hobby") ?? searchParams.get("category");
  const [selected, setSelected] = useState(hobbyParam ?? "all");

  useEffect(() => {
    setSelected(hobbyParam ?? "all");
  }, [hobbyParam]);

  const filtered = selected === "all" ? listings : listings.filter((p) => p.hobbySlug === selected);

  return (
    <div className="min-h-screen py-14">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl mb-3">The marketplace</h1>
          <p className="text-muted-foreground text-lg">
            Physical goods, digital guides, and courses — all made by real creators.
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <div className="flex flex-wrap gap-2 justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <Button
              variant="ghost"
              onClick={() => setSelected("all")}
              className={selected === "all" ? "text-white [background-image:var(--gradient-brand)]" : "text-muted-foreground"}
            >
              All
            </Button>
            {hobbies.map((hobby) => (
              <Button
                key={hobby.slug}
                variant="ghost"
                onClick={() => setSelected(hobby.slug)}
                className={
                  selected === hobby.slug
                    ? "text-white [background-image:var(--gradient-brand)]"
                    : "text-muted-foreground"
                }
              >
                {hobby.shortName}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-6 text-center text-sm text-muted-foreground">
          {filtered.length} listing{filtered.length === 1 ? "" : "s"}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground mb-4">Nothing here yet</p>
            <Button variant="outline" onClick={() => setSelected("all")}>
              View everything
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
