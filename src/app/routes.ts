// HashRouter, not BrowserRouter: hash routing ("#/space/crafting") needs no
// server rewrite rules, so any static host serves every route. (Opening the
// built file straight from disk is no longer supported: the app is split into
// ES module chunks, which browsers refuse to load over file://.)
//
// Code-split: Home, the feed, Login and the 404 page ship in the first
// download. Every other page is fetched the first time it is opened.
import { createHashRouter, redirect, type Params } from "react-router";
import { page } from "./lib/lazyPage";
import { extraConceptsEnabled, marketplaceEnabled, worldDemoEnabled } from "./config";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { cornerPath } from "./lib/cornerPath";
import { cornerParentPath } from "./lib/cornerParent";
import { mergedSlugTarget } from "./data/hobbies";
import { HomeFeed } from "./pages/HomeFeed";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";
import { RouteError } from "./pages/RouteError";
import { BootSplash } from "./components/BootSplash";

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
    // If the shell itself fails, a plain error screen with no header.
    ErrorBoundary: RouteError,
    HydrateFallback: BootSplash,
    children: [
      {
        // Any page that fails shows the error screen inside the shell, so the
        // header and tab bar stay and the person can go somewhere else.
        ErrorBoundary: RouteError,
        children: [
      // "/" is the signed-out landing page. Signed in, it goes straight to
      // Home (/my-space), the page behind the "Home" nav link and the wordmark.
      { index: true, Component: Home, handle: { kind: "tab" } },
      // Step 2 (invite-only sign-up): the door screen Root.tsx routes every
      // pending account to, and the arrival page an invite link points at.
      { path: "welcome", lazy: page(() => import("./pages/Welcome"), "Welcome"), handle: { kind: "tab" } },
      { path: "i/:code", lazy: page(() => import("./pages/InviteArrival"), "InviteArrival"), handle: { kind: "tab" } },
      { path: "my-space", Component: HomeFeed, handle: { kind: "tab", tab: "my-space" } },
      { path: "calendar", lazy: page(() => import("./pages/Calendar"), "Calendar"), handle: { kind: "tab", tab: "calendar" } },
      // The Week view became the calendar's Week view; old links keep working.
      { path: "week", loader: () => redirect("/calendar?view=week") },
      { path: "week/free", lazy: page(() => import("./pages/WeekFree"), "WeekFree"), handle: { kind: "page", legacyBack: true, tab: "calendar", parent: () => "/calendar" } },
      // The sheet-of-six grid Home used to be, until the feed replaced it.
      { path: "my-space/all", lazy: page(() => import("./pages/MySpace"), "MySpace"), handle: { kind: "page", tab: "my-space", parent: () => "/my-space" } },
      { path: "discover", lazy: page(() => import("./pages/Discover"), "Discover"), handle: { kind: "tab", tab: "discover" } },
      { path: "search", lazy: page(() => import("./pages/SearchResults"), "SearchResults"), handle: { kind: "page", parent: () => "/discover" } },

      { path: "circles", loader: () => redirect("/discover") },
      { path: "circles/*", loader: () => redirect("/discover") },
      { path: "create", lazy: page(() => import("./pages/Log"), "Log"), handle: { kind: "flow", tab: "create", parent: () => "/my-space" } },
      // What Start on a suggestion opens: the activity itself, never the camera.
      { path: "start/:spaceSlug/:cornerSlug", lazy: page(() => import("./pages/StartPage"), "StartPage"), handle: { kind: "flow", parent: (p: Params) => cornerPath(p.spaceSlug, p.cornerSlug ?? "") } },
      { path: "people", lazy: page(() => import("./pages/People"), "People"), handle: { kind: "page", tab: "discover", parent: () => "/discover" } },
      // Spaces are the categories now, so there is one page and one URL.
      { path: "category/:slug", loader: ({ params }) => redirect(`/space/${params.slug}`) },
      { path: "admin/categories", lazy: page(() => import("./pages/AdminCategories"), "AdminCategories"), handle: { kind: "page", parent: () => "/settings" } },
      { path: "admin/spaces", lazy: page(() => import("./pages/AdminSpaces"), "AdminSpaces"), handle: { kind: "page", parent: () => "/settings" } },
      { path: "admin/corners", lazy: page(() => import("./pages/AdminCorners"), "AdminCorners"), handle: { kind: "page", parent: () => "/settings" } },
      { path: "admin/reports", lazy: page(() => import("./pages/AdminReports"), "AdminReports"), handle: { kind: "page", parent: () => "/settings" } },
      { path: "admin/invites", lazy: page(() => import("./pages/AdminInvites"), "AdminInvites"), handle: { kind: "page", parent: () => "/settings" } },
      { path: "admin/city-picks", lazy: page(() => import("./pages/AdminCityPicks"), "AdminCityPicks"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "admin/weekly-schedule", lazy: page(() => import("./pages/AdminStandingSlots"), "AdminStandingSlots"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      // "Log" was the old name for creating; keep old links working.
      { path: "log", loader: () => redirect("/create") },
      // Your own profile, and anyone's at /u/:username (the server decides what each viewer gets).
      { path: "you", lazy: page(() => import("./pages/Profile"), "Profile"), handle: { kind: "tab", tab: "you" } },
      // The old "everything about you" page is gone; keep the link working.
      { path: "you/all", loader: () => redirect("/you") },
      // The old personal page. Anyone who saved or shared /me landed on a
      // 404 after the rename; send them to My Space instead.
      { path: "me", loader: () => redirect("/my-space") },
      { path: "settings", lazy: page(() => import("./pages/Settings"), "Settings"), handle: { kind: "page", legacyBack: true, parent: () => "/you" } },
      { path: "settings/appearance", lazy: page(() => import("./pages/Settings"), "AppearanceSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      // Deliberately top-level, not nested under /settings/* — only
      // Appearance keeps that prefix, per the redesign spec.
      { path: "profile", lazy: page(() => import("./pages/Settings"), "ProfileSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "account", lazy: page(() => import("./pages/Settings"), "AccountSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "privacy", lazy: page(() => import("./pages/Settings"), "PrivacySettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "privacy/time", lazy: page(() => import("./pages/WhoCanSeeMyTime"), "WhoCanSeeMyTime"), handle: { kind: "page", legacyBack: true, parent: () => "/privacy" } },
      { path: "notifications", lazy: page(() => import("./pages/Settings"), "NotificationsSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "data", lazy: page(() => import("./pages/Settings"), "DataSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "pause-or-leave", lazy: page(() => import("./pages/Settings"), "PauseOrLeaveSettingsPage"), handle: { kind: "page", legacyBack: true, parent: () => "/settings" } },
      { path: "onboarding", lazy: page(() => import("./pages/Onboarding"), "Onboarding"), handle: { kind: "flow", parent: () => "/my-space" } },
      { path: "inbox", lazy: page(() => import("./pages/Inbox"), "Inbox"), handle: { kind: "tab", tab: "inbox" } },
      { path: "messages", lazy: page(() => import("./pages/Messages"), "Messages"), handle: { kind: "tab", tab: "inbox" } },
      { path: "you/work/:hobbyKey", lazy: page(() => import("./pages/HobbyArchive"), "HobbyArchive"), handle: { kind: "page", legacyBack: true, tab: "you", parent: () => "/you" } },
      // A real Space's own slug renders SpaceRoute's dispatcher; a
      // reserved (Category) slug redirects to /discover instead —
      // Categories are internal-only now, never shown to users. See
      // SpaceRoute.tsx for the reserved-slug check itself.
      { path: "space/:slug", lazy: page(() => import("./pages/SpaceRoute"), "SpaceRoute"), handle: { kind: "page", tab: "discover", parent: () => "/discover" } },
      { path: "space/:slug/edit", lazy: page(() => import("./pages/EditSpace"), "EditSpace"), handle: { kind: "flow", tab: "discover", parent: (p: Params) => `/space/${p.slug ?? ""}` } },
      { path: "create-space", lazy: page(() => import("./pages/CreateSpace"), "CreateSpace"), handle: { kind: "flow", tab: "create", parent: () => "/discover" } },
      // Every Corner's page is /corners/:slug; the old link and shared URLs still work (a merged Corner goes to the kept one).
      {
        path: "corner/:slug",
        loader: ({ params }) => {
          const slug = params.slug ?? "";
          return redirect(cornerPath(undefined, encodeURIComponent(mergedSlugTarget(slug) ?? slug)));
        },
      },
      { path: "corners", lazy: page(() => import("./pages/CornersHome"), "CornersHome"), handle: { kind: "page", tab: "discover", parent: () => "/discover" } },
      {
        path: "corners/:slug",
        handle: { kind: "page", tab: "discover", parent: (p: Params) => cornerParentPath(p.slug) },
        // A Corner merged into another goes to the kept one.
        loader: ({ params }) => {
          const merged = mergedSlugTarget(params.slug ?? "");
          return merged ? redirect(cornerPath(undefined, merged)) : null;
        },
        lazy: page(() => import("./pages/CornerDetail"), "CornerDetail"),
      },
      // A Corner that has a room opens as the room at /corners/:slug (CornerDetail). The room's first address still works.
      { path: "corners/:slug/world", loader: ({ params }) => redirect(cornerPath(undefined, params.slug ?? "")) },
      { path: "browse/:slug", lazy: page(() => import("./pages/Category"), "CategoryPage"), handle: { kind: "page", legacyBack: true, tab: "discover", parent: () => "/corners" } },
      { path: "pursuits/new", lazy: page(() => import("./pages/CreatePursuit"), "CreatePursuit"), handle: { kind: "flow", parent: () => "/my-space" } },
      { path: "join/:token", lazy: page(() => import("./pages/JoinPursuit"), "JoinPursuit"), handle: { kind: "flow", parent: () => "/my-space" } },
      // The old per-Pursuit form is gone: one Log a Moment form, with the Pursuit pre-filled.
      { path: "pursuit/:id/moment", loader: ({ params }) => redirect(`/create?pursuit=${params.id}`) },
      { path: "pursuit/:id/recap", lazy: page(() => import("./pages/PursuitRecap"), "PursuitRecap"), handle: { kind: "page", parent: (p: Params) => `/pursuit/${p.id ?? ""}` } },
      { path: "pursuit/:id", lazy: page(() => import("./pages/Pursuit"), "Pursuit"), handle: { kind: "page", parent: () => "/my-space" } },
      // A Moment shared into a chat (Phase 4) is the first place a Moment
      // needs a URL of its own — everywhere else it's a dialog opened from
      // inside whatever grid it's already sitting in.
      { path: "moment/:id", lazy: page(() => import("./pages/MomentPage"), "MomentPage"), handle: { kind: "page", legacyBack: true, parent: () => "/my-space" } },
      { path: "u/:username", lazy: page(() => import("./pages/Profile"), "Profile"), handle: { kind: "page", legacyBack: true, parent: () => "/discover" } },
      {
        path: "u/:username/studio",
        handle: { kind: "page", legacyBack: true, parent: (p: Params) => `/u/${p.username ?? ""}` },
        loader: ({ params }) => (extraConceptsEnabled ? null : redirect(`/u/${params.username}`)),
        lazy: page(() => import("./pages/Studio"), "Studio"),
      },
      { path: "studio", loader: () => (extraConceptsEnabled ? null : redirect("/you")), lazy: page(() => import("./pages/Studio"), "Studio"), handle: { kind: "page", legacyBack: true, parent: () => "/you" } },
      { path: "login", Component: Login, handle: { kind: "flow", parent: () => "/" } },
      { path: "reset-password", lazy: page(() => import("./pages/ResetPassword"), "ResetPassword"), handle: { kind: "flow", parent: () => "/login" } },
      // Landing page spec §2.5. Not /privacy — that path already renders
      // the signed-in Settings > Privacy page (PrivacySettingsPage above).
      { path: "terms", lazy: page(() => import("./pages/Terms"), "Terms"), handle: { kind: "page", legacyBack: true, parent: () => "/" } },
      { path: "privacy-policy", lazy: page(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy"), handle: { kind: "page", legacyBack: true, parent: () => "/" } },
      // Buying/selling isn't live — see src/app/config.ts's
      // marketplaceEnabled. Off, both routes redirect to /discover instead
      // of rendering a page for a marketplace that isn't there.
      { path: "shop", loader: () => (marketplaceEnabled ? null : redirect("/discover")), lazy: page(() => import("./pages/Shop"), "Shop"), handle: { kind: "page", parent: () => "/discover" } },
      { path: "product/:id", loader: () => (marketplaceEnabled ? null : redirect("/discover")), lazy: page(() => import("./pages/ProductDetail"), "ProductDetail"), handle: { kind: "page", legacyBack: true, parent: () => "/shop" } },

      // Old paths people may have bookmarked or shared. Kept as redirects so
      // no link that used to work quietly turns into a 404.
      //
      // /profile used to redirect here to /you — it's now the Settings
      // Profile section route instead (redesign/settings), so that redirect
      // is gone; nothing else pointed at it.

      // The world demo. Staging, previews and local only: on the live site this path goes Home.
      { path: "world", loader: () => (worldDemoEnabled() ? null : redirect("/my-space")), lazy: page(() => import("./pages/WorldDemo"), "WorldDemo"), handle: { kind: "page", parent: () => "/my-space" } },

      ...landingPreviewRoutes,
      ...devRoutes,
      { path: "*", Component: NotFound },
        ],
      },
    ],
  },
]);
