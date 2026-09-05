// HashRouter, not BrowserRouter: this app ships as a single static HTML
// file that people sometimes open straight from disk (file://) rather than
// from a server. BrowserRouter reads the full path (e.g. the file's whole
// disk path) and fails to match any route, landing on the 404 page. Hash-
// based routing ("#/space/crafting") works identically under file://, a
// plain static host, or the published Artifact page.
import { createHashRouter, redirect } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { CategoryFeed } from "./pages/CategoryFeed";
import { Discover } from "./pages/Discover";
import { MySpace } from "./pages/MySpace";
import { Circles } from "./pages/Circles";
import { Log } from "./pages/Log";
import { You } from "./pages/You";
import { Messages } from "./pages/Messages";
import { HobbyArchive } from "./pages/HobbyArchive";
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
      { path: "my-space", Component: MySpace },
      { path: "circles", Component: Circles },
      { path: "log", Component: Log },
      { path: "you", Component: You },
      { path: "messages", Component: Messages },
      { path: "you/work/:hobbyKey", Component: HobbyArchive },
      { path: "space/:slug", Component: CategoryFeed },
      { path: "u/:username", Component: PublicProfile },
      { path: "login", Component: Login },
      { path: "shop", Component: Shop },
      { path: "product/:id", Component: ProductDetail },

      // Old paths people may have bookmarked or shared. Kept as redirects so
      // no link that used to work quietly turns into a 404.
      { path: "create", loader: () => redirect("/log") },
      { path: "profile", loader: () => redirect("/you") },

      { path: "*", Component: NotFound },
    ],
  },
]);
