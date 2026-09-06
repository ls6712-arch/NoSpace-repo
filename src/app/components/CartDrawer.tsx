import { useState } from "react";
import { Minus, Plus, Trash2, Check } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useRewards } from "../context/RewardsContext";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { GeneratedArt } from "./GeneratedArt";

export function CartDrawer() {
  const {
    cartItems,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    cartTotal,
    cartCount,
    clearCart,
  } = useCart();
  const { recordPurchase } = useRewards();
  const [justCheckedOut, setJustCheckedOut] = useState(false);

  const handleCheckout = () => {
    recordPurchase(cartCount);
    clearCart();
    setJustCheckedOut(true);
    setTimeout(() => setJustCheckedOut(false), 2500);
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={closeCart}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-xl">Your cart ({cartItems.length})</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {justCheckedOut ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full text-white [background-image:var(--gradient-brand)]">
                <Check className="size-7" />
              </span>
              <div className="text-lg">Order placed. Thanks for supporting creators.</div>
              <div className="text-sm text-muted-foreground">
                Points added to your profile.
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-muted-foreground mb-4">Your cart is empty</div>
              <Button onClick={closeCart} variant="outline">
                Keep exploring
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-border bg-white/[0.03] p-3"
                >
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl">
                    <GeneratedArt
                      hobbySlug={item.hobbySlug}
                      seed={item.id}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm mb-0.5 line-clamp-1">{item.name}</h4>
                    <div className="text-xs text-muted-foreground mb-2">
                      by {item.creator}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                      <span className="ml-auto text-sm text-[var(--coral-text)]">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && !justCheckedOut && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex justify-between text-lg">
              <span>Total</span>
              <span className="text-[var(--coral-text)]">${cartTotal.toFixed(2)}</span>
            </div>
            <Button variant="brand" size="lg" className="w-full" onClick={handleCheckout}>
              Checkout · +{cartCount * 10} pts
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
