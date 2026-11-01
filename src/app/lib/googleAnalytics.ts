/**
 * Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set (Vercel, Production
 * only), and only ever runs on the live site, never on staging, previews or
 * localhost. Skipped for anyone whose browser sends Do Not Track or Global
 * Privacy Control.
 *
 * The app routes with the hash, so GA's own page tracking would see one page
 * ("/") and would also read sign-in and password reset tokens out of the hash.
 * So page views are sent by hand, with an address built here: the first part of
 * the route only ("/moment", "/u", "/i"), never an id, username, invite code or
 * token. See docs/seo-and-analytics.md.
 */
import { PRODUCTION_HOSTNAMES, SITE_ORIGIN } from "../config";

const ID_PATTERN = /^G-[A-Z0-9]{4,}$/;

/** "#/moment/123?x=1" becomes "/moment". Anything that is not a route becomes "/". */
export function analyticsPath(hash: string): string {
  const m = /^#\/([A-Za-z0-9_-]+)/.exec(hash);
  return m ? `/${m[1]}` : "/";
}

export function shouldLoadAnalytics(
  id: string | undefined,
  hostname: string,
  optedOut: boolean,
): id is string {
  return !!id && ID_PATTERN.test(id) && PRODUCTION_HOSTNAMES.includes(hostname) && !optedOut;
}

type Gtag = (...args: unknown[]) => void;

export function initGoogleAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const optedOut = nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
  if (!shouldLoadAnalytics(id, window.location.hostname, optedOut)) return;

  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // gtag.js only reads the real `arguments` object, not an array.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", id, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  let last = "";
  const sendPageView = () => {
    const path = analyticsPath(window.location.hash);
    if (path === last) return;
    last = path;
    w.gtag("event", "page_view", {
      page_path: path,
      page_location: `${SITE_ORIGIN}${path}`,
      page_referrer: "",
    });
  };
  sendPageView();
  window.addEventListener("hashchange", sendPageView);
}
