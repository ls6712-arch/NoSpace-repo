import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { RewardsProvider } from "./context/RewardsContext";
import { ContentProvider } from "./context/ContentContext";
import { SocialProvider } from "./context/SocialContext";
import { ConnectionsProvider } from "./context/ConnectionsContext";

export default function App() {
  return (
    <AuthProvider>
      <RewardsProvider>
        <ContentProvider>
          <SocialProvider>
            <ConnectionsProvider>
              <CartProvider>
                <RouterProvider router={router} />
              </CartProvider>
            </ConnectionsProvider>
          </SocialProvider>
        </ContentProvider>
      </RewardsProvider>
    </AuthProvider>
  );
}
