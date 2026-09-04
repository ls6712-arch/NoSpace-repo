import { Star, ShoppingCart, Heart, GraduationCap, FileDown } from "lucide-react";
import { Link } from "react-router";
import { Product } from "../data/products";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { useCart } from "../context/CartContext";
import { GeneratedArt } from "./GeneratedArt";

const typeMeta: Record<Product["type"], { label: string; icon: typeof ShoppingCart }> = {
  physical: { label: "Physical", icon: ShoppingCart },
  digital: { label: "Digital", icon: FileDown },
  course: { label: "Course", icon: GraduationCap },
};

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isInWishlist } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleWishlist(product.id);
  };

  const inWishlist = isInWishlist(product.id);
  const Meta = typeMeta[product.type];

  return (
    <Link to={`/product/${product.id}`}>
      <Card className="group overflow-hidden hover:border-border transition-all duration-300">
        <div className="relative aspect-square overflow-hidden bg-white/[0.03]">
          <GeneratedArt
            hobbySlug={product.hobbySlug}
            seed={product.id}
            className="h-full w-full transition-transform duration-500 group-hover:scale-110"
          />
          <Badge variant="outline" className="absolute top-3 left-3 bg-black/40 backdrop-blur-md border-border">
            <Meta.icon className="size-3" />
            {Meta.label}
          </Badge>
          <Button
            size="icon"
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/90 text-black hover:bg-white"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`absolute bottom-3 right-3 rounded-full backdrop-blur-md ${
              inWishlist ? "bg-[var(--coral)] text-white" : "bg-black/40 text-white hover:bg-black/60"
            }`}
            onClick={handleWishlistToggle}
          >
            <Heart className={`size-4 ${inWishlist ? "fill-white" : ""}`} />
          </Button>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-1">by {product.creator}</div>
          <h3 className="mb-2 line-clamp-1">{product.name}</h3>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              <Star className="size-3.5 fill-[var(--mustard)] text-[var(--mustard)]" />
              <span className="ml-1 text-sm">{product.rating}</span>
            </div>
            <span className="text-xs text-muted-foreground">({product.reviews})</span>
          </div>
          <div className="text-lg text-[var(--coral-text)]">${product.price.toFixed(2)}</div>
        </div>
      </Card>
    </Link>
  );
}
