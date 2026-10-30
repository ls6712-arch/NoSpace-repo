// HashRouter, not BrowserRouter: this app ships as a single static HTML
// file that people sometimes open straight from disk (file://) rather than
// from a server. BrowserRouter reads the full path (e.g. the file's whole
// disk path) and fails to match any route, landing on the 404 page. Hash-
// based routing ("#/space/crafting") works identically under file://, a
// plain static host, or the published Artifact page.
import { createHashRouter, redirect } from "react-router";
import { extraConceptsEnabled, marketplaceEnabled } from "./config";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { CategoryPage } from "./pages/Category";
import { cornerPath } from "./lib/cornerPath";
import { mergedSlugTarget } from "./data/hobbies";
import { CornersHome } from "./pages/CornersHome";
import { CornerDetail } from "./pages/CornerDetail";
import { SpaceRoute } from "./pages/SpaceRoute";
import { CreateSpace } from "./pages/CreateSpace";
import { EditSpace } from "./pages/EditSpace";
import { Discover } from "./pages/Discover";
import { SearchResults } from "./pages/SearchResults";
import { MySpace } from "./pages/MySpace";
import { HomeFeed } from "./pages/HomeFeed";
import { Log } from "./pages/Log";
import { Profile } from "./pages/Profile";
import { WhoCanSeeMyTime } from "./pages/WhoCanSeeMyTime";
import { Onboarding } from "./pages/Onboarding";
import { Week } from "./pages/Week";
import { WeekFree } from "./pages/WeekFree";
import { Messages } from "./pages/Messages";
import { Inbox } from "./pages/Inbox";
import { People } from "./pages/People";
import { AdminCategories } from "./pages/AdminCategories";
import { AdminSpaces } from "./pages/AdminSpaces";
import { AdminCorners } from "./pages/AdminCorners";
import { AdminReports } from "./pages/AdminReports";
import { AdminInvites } from "./pages/AdminInvites";
import { AdminCityPicks } from "./pages/AdminCityPicks";
import { HobbyArchive } from "./pages/HobbyArchive";
import { Studio } from "./pages/Studio";
import { Pursuit } from "./pages/Pursuit";
import { PursuitRecap } from "./pages/PursuitRecap";
import { CreatePursuit } from "./pages/CreatePursuit";
import { MomentPage } from "./pages/MomentPage";
import { JoinPursuit } from "./pages/JoinPursuit";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/ProductDetail";
import { Login } from "./pages/Login";
import { InviteArrival } from "./pages/InviteArrival";
import { Welcome } from "./pages/Welcome";
import { Terms } from "./pages/Terms";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import {
  Settings,
  AppearanceSettingsPage,
  ProfileSettingsPage,
  AccountSettingsPage,
  PrivacySettingsPage,
  NotificationsSettingsPage,
  DataSettingsPage,
  PauseOrLeaveSettingsPage,
} from "./pages/Settings";
import { NotFound } from "./pages/NotFound";

// The landing-page screenshot preview. These routes exist only when the app is
// built or served with `--mode landing-preview` (npm run landing:screens), where
// the database client is an in-memory one holding example people. In every other
// mode this is an empty list and the dynamic imports are compiled out, so the
// preview code and its fixtures never reach a production build.
const landingPreviewRoutes =
  import.meta.env.MODE === "landing-preview"
    ? [
        {
          path: "landing-preview/:screen",
          lazy: () => import("../landing-preview/PreviewScreen").then((m) => ({ Component: m.PreviewScreen })),
        },
        {
          path: "landing-preview/pursuit/:id",
          lazy: () => import("../landing-preview/PreviewScreen").then((m) => ({ Component: m.PreviewPursuit })),
        },
      ]
    : [];

// The component kit (/dev/kit): every foundation component and motion on one
// page. Development only; compiled out of production builds.
const devRoutes = import.meta.env.DEV
  ? [{ path: "dev/kit", lazy: () => import("./pages/dev/DevKit").then((m) => ({ Component: m.DevKit })) }]
  : [];

export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
    children: [
      // "/" is the signed-out landing page. Signed in, it goes straight to
      // Home (/my-space), the page behind the "Home" nav link and the wordmark.
      { index: true, Component: Home },
      // Step 2 (invite-only sign-up): the door screen Root.tsx routes every
      // pending account to, and the arrival page an invite link points at.
      { path: "welcome", Component: Welcome },
      { path: "i/:code", Component: InviteArrival },
      { path: "my-space", Component: HomeFeed },
      { path: "week", Component: Week },
      { path: "week/free", Component: WeekFree },
      // The sheet-of-six grid Home used to be, until the feed replaced it.
      { path: "my-space/all", Component: MySpace },
      { path: "discover", Component: Discover },
      { path: "search", Component: SearchResults },

      { path: "circles", loader: () => redirect("/discover") },
      { path: "circles/*", loader: () => redirect("/discover") },
      { path: "create", Component: Log },
      { path: "people", Component: People },
      // Spaces are the categories now, so there is one page and one URL.
      { path: "category/:slug", loader: ({ params }) => redirect(`/space/${params.slug}`) },
      { path: "admin/categories", Component: AdminCategories },
      { path: "admin/spaces", Component: AdminSpaces },
      { path: "admin/corners", Component: AdminCorners },
      { path: "admin/reports", Component: AdminReports },
      { path: "admin/invites", Component: AdminInvites },
      { path: "admin/city-picks", Component: AdminCityPicks },
      // "Log" was the old name for creating; keep old links working.
      { path: "log", loader: () => redirect("/create") },
      // Your own profile, and anyone's at /u/:username (the server decides what each viewer gets).
      { path: "you", Component: Profile },
      // The old "everything about you" page is gone; keep the link working.
      { path: "you/all", loader: () => redirect("/you") },
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
      { path: "privacy/time", Component: WhoCanSeeMyTime },
      { path: "notifications", Component: NotificationsSettingsPage },
      { path: "data", Component: DataSettingsPage },
      { path: "pause-or-leave", Component: PauseOrLeaveSettingsPage },
      { path: "onboarding", Component: Onboarding },
      { path: "inbox", Component: Inbox },
      { path: "messages", Component: Messages },
      { path: "you/work/:hobbyKey", Component: HobbyArchive },
      // A real Space's own slug renders SpaceRoute's dispatcher; a
      // reserved (Category) slug redirects to /discover instead —
      // Categories are internal-only now, never shown to users. See
      // SpaceRoute.tsx for the reserved-slug check itself.
      { path: "space/:slug", Component: SpaceRoute },
      { path: "space/:slug/edit", Component: EditSpace },
      { path: "create-space", Component: CreateSpace },
      // Every Corner's page is /corners/:slug; the old link and shared URLs still work (a merged Corner goes to the kept one).
      {
        path: "corner/:slug",
        loader: ({ params }) => {
          const slug = params.slug ?? "";
          return redirect(cornerPath(undefined, encodeURIComponent(mergedSlugTarget(slug) ?? slug)));
        },
      },
      { path: "corners", Component: CornersHome },
      {
        path: "corners/:slug",
        // A Corner merged into another goes to the kept one.
        loader: ({ params }) => {
          const merged = mergedSlugTarget(params.slug ?? "");
          return merged ? redirect(cornerPath(undefined, merged)) : null;
        },
        Component: CornerDetail,
      },
      { path: "browse/:slug", Component: CategoryPage },
      { path: "pursuits/new", Component: CreatePursuit },
      { path: "join/:token", Component: JoinPursuit },
      // The old per-Pursuit form is gone: one Log a Moment form, with the Pursuit pre-filled.
      { path: "pursuit/:id/moment", loader: ({ params }) => redirect(`/create?pursuit=${params.id}`) },
      { path: "pursuit/:id/recap", Component: PursuitRecap },
      { path: "pursuit/:id", Component: Pursuit },
      // A Moment shared into a chat (Phase 4) is the first place a Moment
      // needs a URL of its own — everywhere else it's a dialog opened from
      // inside whatever grid it's already sitting in.
      { path: "moment/:id", Component: MomentPage },
      { path: "u/:username", Component: Profile },
      {
        path: "u/:username/studio",
        loader: ({ params }) => (extraConceptsEnabled ? null : redirect(`/u/${params.username}`)),
        Component: Studio,
      },
      { path: "studio", loader: () => (extraConceptsEnabled ? null : redirect("/you")), Component: Studio },
      { path: "login", Component: Login },
      // Landing page spec §2.5. Not /privacy — that path already renders
      // the signed-in Settings > Privacy page (PrivacySettingsPage above).
      { path: "terms", Component: Terms },
      { path: "privacy-policy", Component: PrivacyPolicy },
      // Buying/selling isn't live — see src/app/config.ts's
      // marketplaceEnabled. Off, both routes redirect to /discover instead
      // of rendering a page for a marketplace that isn't there.
      { path: "shop", loader: () => (marketplaceEnabled ? null : redirect("/discover")), Component: Shop },
      { path: "product/:id", loader: () => (marketplaceEnabled ? null : redirect("/discover")), Component: ProductDetail },

      // Old paths people may have bookmarked or shared. Kept as redirects so
      // no link that used to work quietly turns into a 404.
      //
      // /profile used to redirect here to /you — it's now the Settings
      // Profile section route instead (redesign/settings), so that redirect
      // is gone; nothing else pointed at it.

      ...landingPreviewRoutes,
      ...devRoutes,
      { path: "*", Component: NotFound },
    ],
  },
]);
