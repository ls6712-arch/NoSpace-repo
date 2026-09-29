import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { CartProvider } from "./context/CartContext";
import { RewardsProvider } from "./context/RewardsContext";
import { ContentProvider } from "./context/ContentContext";
import { SocialProvider } from "./context/SocialContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { CornersProvider } from "./context/CornersContext";
import { PrivateLogsProvider } from "./context/PrivateLogsContext";
import { SettingsProvider } from "./context/SettingsContext";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <RewardsProvider>
            <ContentProvider>
              <CornersProvider>
                <PrivateLogsProvider>
                  <SocialProvider>
                    <CategoriesProvider>
                      <CartProvider>
                        <RouterProvider router={router} />
                      </CartProvider>
                    </CategoriesProvider>
                  </SocialProvider>
                </PrivateLogsProvider>
              </CornersProvider>
            </ContentProvider>
          </RewardsProvider>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
