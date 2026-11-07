// HashRouter, not BrowserRouter: hash routing ("#/space/crafting") needs no
// server rewrite rules, so any static host serves every route. (Opening the
// built file straight from disk is no longer supported: the app is split into
// ES module chunks, which browsers refuse to load over file://.)
//
// Code-split: Home, the feed, Login and the 404 page ship in the first
// download. Every other page is fetched the first time it is opened.
import { createHashRouter, redirect } from "react-router";
import { page } from "./lib/lazyPage";
import { extraConceptsEnabled, marketplaceEnabled } from "./config";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { cornerPath } from "./lib/cornerPath";
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
      { index: true, Component: Home },
      // Step 2 (invite-only sign-up): the door screen Root.tsx routes every
      // pending account to, and the arrival page an invite link points at.
      { path: "welcome", lazy: page(() => import("./pages/Welcome"), "Welcome") },
      { path: "i/:code", lazy: page(() => import("./pages/InviteArrival"), "InviteArrival") },
      { path: "my-space", Component: HomeFeed },
      { path: "calendar", lazy: page(() => import("./pages/Calendar"), "Calendar") },
      // The Week view became the calendar's Week view; old links keep working.
      { path: "week", loader: () => redirect("/calendar?view=week") },
      { path: "week/free", lazy: page(() => import("./pages/WeekFree"), "WeekFree") },
      // The sheet-of-six grid Home used to be, until the feed replaced it.
      { path: "my-space/all", lazy: page(() => import("./pages/MySpace"), "MySpace") },
      { path: "discover", lazy: page(() => import("./pages/Discover"), "Discover") },
      { path: "search", lazy: page(() => import("./pages/SearchResults"), "SearchResults") },

      { path: "circles", loader: () => redirect("/discover") },
      { path: "circles/*", loader: () => redirect("/discover") },
      { path: "create", lazy: page(() => import("./pages/Log"), "Log") },
      // What Start on a suggestion opens: the activity itself, never the camera.
      { path: "start/:spaceSlug/:cornerSlug", lazy: page(() => import("./pages/StartPage"), "StartPage") },
      { path: "people", lazy: page(() => import("./pages/People"), "People") },
      // Spaces are the categories now, so there is one page and one URL.
      { path: "category/:slug", loader: ({ params }) => redirect(`/space/${params.slug}`) },
      { path: "admin/categories", lazy: page(() => import("./pages/AdminCategories"), "AdminCategories") },
      { path: "admin/spaces", lazy: page(() => import("./pages/AdminSpaces"), "AdminSpaces") },
      { path: "admin/corners", lazy: page(() => import("./pages/AdminCorners"), "AdminCorners") },
      { path: "admin/reports", lazy: page(() => import("./pages/AdminReports"), "AdminReports") },
      { path: "admin/invites", lazy: page(() => import("./pages/AdminInvites"), "AdminInvites") },
      { path: "admin/city-picks", lazy: page(() => import("./pages/AdminCityPicks"), "AdminCityPicks") },
      { path: "admin/weekly-schedule", lazy: page(() => import("./pages/AdminStandingSlots"), "AdminStandingSlots") },
      // "Log" was the old name for creating; keep old links working.
      { path: "log", loader: () => redirect("/create") },
      // Your own profile, and anyone's at /u/:username (the server decides what each viewer gets).
      { path: "you", lazy: page(() => import("./pages/Profile"), "Profile") },
      // The old "everything about you" page is gone; keep the link working.
      { path: "you/all", loader: () => redirect("/you") },
      // The old personal page. Anyone who saved or shared /me landed on a
      // 404 after the rename; send them to My Space instead.
      { path: "me", loader: () => redirect("/my-space") },
      { path: "settings", lazy: page(() => import("./pages/Settings"), "Settings") },
      { path: "settings/appearance", lazy: page(() => import("./pages/Settings"), "AppearanceSettingsPage") },
      // Deliberately top-level, not nested under /settings/* — only
      // Appearance keeps that prefix, per the redesign spec.
      { path: "profile", lazy: page(() => import("./pages/Settings"), "ProfileSettingsPage") },
      { path: "account", lazy: page(() => import("./pages/Settings"), "AccountSettingsPage") },
      { path: "privacy", lazy: page(() => import("./pages/Settings"), "PrivacySettingsPage") },
      { path: "privacy/time", lazy: page(() => import("./pages/WhoCanSeeMyTime"), "WhoCanSeeMyTime") },
      { path: "notifications", lazy: page(() => import("./pages/Settings"), "NotificationsSettingsPage") },
      { path: "data", lazy: page(() => import("./pages/Settings"), "DataSettingsPage") },
      { path: "pause-or-leave", lazy: page(() => import("./pages/Settings"), "PauseOrLeaveSettingsPage") },
      { path: "onboarding", lazy: page(() => import("./pages/Onboarding"), "Onboarding") },
      { path: "inbox", lazy: page(() => import("./pages/Inbox"), "Inbox") },
      { path: "messages", lazy: page(() => import("./pages/Messages"), "Messages") },
      { path: "you/work/:hobbyKey", lazy: page(() => import("./pages/HobbyArchive"), "HobbyArchive") },
      // A real Space's own slug renders SpaceRoute's dispatcher; a
      // reserved (Category) slug redirects to /discover instead —
      // Categories are internal-only now, never shown to users. See
      // SpaceRoute.tsx for the reserved-slug check itself.
      { path: "space/:slug", lazy: page(() => import("./pages/SpaceRoute"), "SpaceRoute") },
      { path: "space/:slug/edit", lazy: page(() => import("./pages/EditSpace"), "EditSpace") },
      { path: "create-space", lazy: page(() => import("./pages/CreateSpace"), "CreateSpace") },
      // Every Corner's page is /corners/:slug; the old link and shared URLs still work (a merged Corner goes to the kept one).
      {
        path: "corner/:slug",
        loader: ({ params }) => {
          const slug = params.slug ?? "";
          return redirect(cornerPath(undefined, encodeURIComponent(mergedSlugTarget(slug) ?? slug)));
        },
      },
      { path: "corners", lazy: page(() => import("./pages/CornersHome"), "CornersHome") },
      {
        path: "corners/:slug",
        // A Corner merged into another goes to the kept one.
        loader: ({ params }) => {
          const merged = mergedSlugTarget(params.slug ?? "");
          return merged ? redirect(cornerPath(undefined, merged)) : null;
        },
        lazy: page(() => import("./pages/CornerDetail"), "CornerDetail"),
      },
      { path: "browse/:slug", lazy: page(() => import("./pages/Category"), "CategoryPage") },
      { path: "pursuits/new", lazy: page(() => import("./pages/CreatePursuit"), "CreatePursuit") },
      { path: "join/:token", lazy: page(() => import("./pages/JoinPursuit"), "JoinPursuit") },
      // The old per-Pursuit form is gone: one Log a Moment form, with the Pursuit pre-filled.
      { path: "pursuit/:id/moment", loader: ({ params }) => redirect(`/create?pursuit=${params.id}`) },
      { path: "pursuit/:id/recap", lazy: page(() => import("./pages/PursuitRecap"), "PursuitRecap") },
      { path: "pursuit/:id", lazy: page(() => import("./pages/Pursuit"), "Pursuit") },
      // A Moment shared into a chat (Phase 4) is the first place a Moment
      // needs a URL of its own — everywhere else it's a dialog opened from
      // inside whatever grid it's already sitting in.
      { path: "moment/:id", lazy: page(() => import("./pages/MomentPage"), "MomentPage") },
      { path: "u/:username", lazy: page(() => import("./pages/Profile"), "Profile") },
      {
        path: "u/:username/studio",
        loader: ({ params }) => (extraConceptsEnabled ? null : redirect(`/u/${params.username}`)),
        lazy: page(() => import("./pages/Studio"), "Studio"),
      },
      { path: "studio", loader: () => (extraConceptsEnabled ? null : redirect("/you")), lazy: page(() => import("./pages/Studio"), "Studio") },
      { path: "login", Component: Login },
      { path: "reset-password", lazy: page(() => import("./pages/ResetPassword"), "ResetPassword") },
      // Landing page spec §2.5. Not /privacy — that path already renders
      // the signed-in Settings > Privacy page (PrivacySettingsPage above).
      { path: "terms", lazy: page(() => import("./pages/Terms"), "Terms") },
      { path: "privacy-policy", lazy: page(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy") },
      // Buying/selling isn't live — see src/app/config.ts's
      // marketplaceEnabled. Off, both routes redirect to /discover instead
      // of rendering a page for a marketplace that isn't there.
      { path: "shop", loader: () => (marketplaceEnabled ? null : redirect("/discover")), lazy: page(() => import("./pages/Shop"), "Shop") },
      { path: "product/:id", loader: () => (marketplaceEnabled ? null : redirect("/discover")), lazy: page(() => import("./pages/ProductDetail"), "ProductDetail") },

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
    ],
  },
]);
