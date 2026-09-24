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
import { CornerPage } from "./pages/Corner"; // name it CornerPage to avoid clashing with the Corner type import elsewhere
import { Discover } from "./pages/Discover";
import { SearchResults } from "./pages/SearchResults";
import { MySpace } from "./pages/MySpace";
import { Circles } from "./pages/Circles";
import { CircleBoard } from "./pages/CircleBoard";
import { Log } from "./pages/Log";
import { You } from "./pages/You";
import { Onboarding } from "./pages/Onboarding";
import { Messages } from "./pages/Messages";
import { Inbox } from "./pages/Inbox";
import { People } from "./pages/People";
import { AdminCategories } from "./pages/AdminCategories";
import { AdminSpaces } from "./pages/AdminSpaces";
import { AdminCircles } from "./pages/AdminCircles";
import { AdminCorners } from "./pages/AdminCorners";
import { AdminReports } from "./pages/AdminReports";
import { HobbyArchive } from "./pages/HobbyArchive";
import { PublicProfile } from "./pages/PublicProfile";
import { Studio } from "./pages/Studio";
import { Pursuit } from "./pages/Pursuit";
import { CreatePursuit } from "./pages/CreatePursuit";
import { AddMoment } from "./pages/AddMoment";
import { JoinPursuit } from "./pages/JoinPursuit";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/ProductDetail";
import { Login } from "./pages/Login";
import {
  Settings,
  AppearanceSettingsPage,
  ProfileSettingsPage,
  AccountSettingsPage,
  PrivacySettingsPage,
  DataSettingsPage,
  PauseOrLeaveSettingsPage,
} from "./pages/Settings";
import { NotFound } from "./pages/NotFound";

export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
    children: [
      // "/" is the landing page, for everyone. The wordmark points here from
      // every page and is the way back to what Sushii says it is — sending a
      // signed-in person to their feed instead took that away. My Space is a
      // destination of its own, at /my-space.
      { index: true, Component: Home },
      { path: "welcome", loader: () => redirect("/") },
      { path: "my-space", Component: MySpace },
      { path: "discover", Component: Discover },
      { path: "search", Component: SearchResults },

      { path: "circles", Component: Circles },
      { path: "circles/:id", Component: CircleBoard },
      { path: "create", Component: Log },
      { path: "people", Component: People },
      // Spaces are the categories now, so there is one page and one URL.
      { path: "category/:slug", loader: ({ params }) => redirect(`/space/${params.slug}`) },
      { path: "admin/categories", Component: AdminCategories },
      { path: "admin/spaces", Component: AdminSpaces },
      { path: "admin/circles", Component: AdminCircles },
      { path: "admin/corners", Component: AdminCorners },
      { path: "admin/reports", Component: AdminReports },
      // "Log" was the old name for creating; keep old links working.
      { path: "log", loader: () => redirect("/create") },
      { path: "you", Component: You },
      // The old personal page. Anyone who saved or shared /me landed on a
      // 404 after the rename; send them to My Space instead.
      { path: "me", loader: () => redirect("/my-space") },
      { path: "settings", Component: Settings },
      { path: "settings/appearance", Component: AppearanceSettingsPage },
      // Deliberately top-level, not nested under /settings/* — only
      // Appearance keeps that prefix, per the redesign spec.
      { path: "profile", Component: ProfileSettingsPage },
      { path: "account", Component: AccountSettingsPage },
      { path: "privacy", Component: PrivacySettingsPage },
      { path: "data", Component: DataSettingsPage },
      { path: "pause-or-leave", Component: PauseOrLeaveSettingsPage },
      { path: "onboarding", Component: Onboarding },
      { path: "inbox", Component: Inbox },
      { path: "messages", Component: Messages },
      { path: "you/work/:hobbyKey", Component: HobbyArchive },
      { path: "space/:slug", Component: CategoryFeed },
      { path: "corner/:slug", Component: CornerPage },
      { path: "pursuits/new", Component: CreatePursuit },
      { path: "join/:token", Component: JoinPursuit },
      { path: "pursuit/:id/moment", Component: AddMoment },
      { path: "pursuit/:id", Component: Pursuit },
      { path: "u/:username", Component: PublicProfile },
      { path: "u/:username/studio", Component: Studio },
      { path: "studio", Component: Studio },
      { path: "login", Component: Login },
      { path: "shop", Component: Shop },
      { path: "product/:id", Component: ProductDetail },

      // Old paths people may have bookmarked or shared. Kept as redirects so
      // no link that used to work quietly turns into a 404.
      //
      // /profile used to redirect here to /you — it's now the Settings
      // Profile section route instead (redesign/settings), so that redirect
      // is gone; nothing else pointed at it.

      { path: "*", Component: NotFound },
    ],
  },
]);
