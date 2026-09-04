// HashRouter, not BrowserRouter: this app ships as a single static HTML
// file that people sometimes open straight from disk (file://) rather than
// from a server. BrowserRouter reads the full path (e.g. the file's whole
// disk path) and fails to match any route, landing on the 404 page. Hash-
// based routing ("#/space/crafting") works identically under file://, a
// plain static host, or the published Artifact page.
import { createHashRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { CategoryFeed } from "./pages/CategoryFeed";
import { Discover } from "./pages/Discover";
import { CreatorStudio } from "./pages/CreatorStudio";
import { Profile } from "./pages/Profile";
import { PublicProfile } from "./pages/PublicProfile";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/ProductDetail";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";

export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "discover", Component: Discover },
      { path: "space/:slug", Component: CategoryFeed },
      { path: "create", Component: CreatorStudio },
      { path: "profile", Component: Profile },
      { path: "u/:username", Component: PublicProfile },
      { path: "login", Component: Login },
      { path: "shop", Component: Shop },
      { path: "product/:id", Component: ProductDetail },
      { path: "*", Component: NotFound },
    ],
  },
]);
