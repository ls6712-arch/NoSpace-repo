import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { ArrowLeft, Heart, ShoppingCart, Star } from "lucide-react";
import { useContent } from "../context/ContentContext";
import { useCart } from "../context/CartContext";
import { getHobby } from "../data/hobbies";
import { Button } from "../components/ui/button";
import { GeneratedArt } from "../components/GeneratedArt";

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findListing, listingsByHobby } = useContent();
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const product = findListing(Number(id));
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Listing not found</h2>
          <Link to="/shop">
            <Button variant="outline">Back to marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hobby = getHobby(product.hobbySlug);
  const related = listingsByHobby(product.hobbySlug)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);
  const inWishlist = isInWishlist(product.id);

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="container mx-auto px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="grid md:grid-cols-2 gap-10 mb-16">
          <div className="relative aspect-square rounded-3xl overflow-hidden border border-border">
            <GeneratedArt
              hobbySlug={product.hobbySlug}
              seed={product.id}
              className="w-full h-full"
            />
            <Button
              size="icon"
              variant="ghost"
              className={`absolute top-5 right-5 rounded-full backdrop-blur-md ${
                inWishlist ? "bg-[var(--coral)] text-white" : "bg-black/40 text-white"
              }`}
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart className={`size-5 ${inWishlist ? "fill-white" : ""}`} />
            </Button>
          </div>

          <div className="glass-panel rounded-3xl p-8">
            {hobby && (
              <Link to={`/space/${hobby.slug}`} className="text-sm text-[var(--coral-text)] mb-2 inline-block">
                {hobby.name}
              </Link>
            )}
            <h1 className="text-3xl md:text-4xl mb-2">{product.name}</h1>
            <div className="text-sm text-muted-foreground mb-4">by {product.creator}</div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < Math.floor(product.rating) ? "fill-[var(--mustard)] text-[var(--mustard)]" : "text-white/20"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>

            <div className="text-4xl mb-6 text-[var(--coral-text)]">${product.price.toFixed(2)}</div>

            <p className="text-muted-foreground mb-8 leading-relaxed">{product.description}</p>

            {product.colors && product.colors.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm">Choose a color</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-full border text-sm transition-all ${
                        selectedColor === color
                          ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 text-sm">Select size</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-full border text-sm transition-all ${
                        selectedSize === size
                          ? "border-transparent text-white [background-image:var(--gradient-brand)]"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button variant="brand" size="lg" className="w-full mb-2" onClick={() => addToCart(product)}>
              <ShoppingCart className="size-4" />
              Add to cart · +10 pts on checkout
            </Button>
          </div>
        </div>

        {related.length > 0 && (
          <div>
            <h2 className="text-3xl mb-6 text-center">More from {hobby?.shortName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`}>
                  <div className="group rounded-2xl overflow-hidden border border-border hover:border-border transition-colors">
                    <div className="aspect-square overflow-hidden bg-white/[0.03]">
                      <GeneratedArt
                        hobbySlug={item.hobbySlug}
                        seed={item.id}
                        className="w-full h-full transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="mb-1 line-clamp-1 text-sm">{item.name}</h3>
                      <div className="text-[var(--coral-text)]">${item.price.toFixed(2)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
