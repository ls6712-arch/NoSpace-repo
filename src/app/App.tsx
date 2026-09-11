import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { RewardsProvider } from "./context/RewardsContext";
import { ContentProvider } from "./context/ContentContext";
import { SocialProvider } from "./context/SocialContext";
import { ConnectionsProvider } from "./context/ConnectionsContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { CornersProvider } from "./context/CornersContext";
import { PrivateLogsProvider } from "./context/PrivateLogsContext";

export default function App() {
  return (
    <AuthProvider>
      <RewardsProvider>
        <ContentProvider>
          <CornersProvider>
            <PrivateLogsProvider>
              <SocialProvider>
                <ConnectionsProvider>
                  <CategoriesProvider>
                    <CartProvider>
                      <RouterProvider router={router} />
                    </CartProvider>
                  </CategoriesProvider>
                </ConnectionsProvider>
              </SocialProvider>
            </PrivateLogsProvider>
          </CornersProvider>
        </ContentProvider>
      </RewardsProvider>
    </AuthProvider>
  );
}
