/**
 * Cloudflare Turnstile, invisible, on guest creation only. Off unless VITE_TURNSTILE_SITE_KEY is
 * set (and Supabase Auth > Attack Protection has CAPTCHA switched on with the matching secret).
 * The script loads only when a guest is about to be made, never on page load.
 */
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; "error-callback": () => void }) => string;
  remove: (id: string) => void;
};

let loading: Promise<TurnstileApi | null> | null = null;

function load(): Promise<TurnstileApi | null> {
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(w.turnstile ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

/** A Turnstile token, or null when it is switched off or couldn't be had (the server then decides). */
export async function turnstileToken(siteKey: string | null, timeoutMs = 15_000): Promise<string | null> {
  if (!siteKey) return null;
  const api = await load();
  if (!api) return null;
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.bottom = "0";
    box.style.right = "0";
    document.body.appendChild(box);
    let id = "";
    const done = (t: string | null) => {
      window.clearTimeout(timer);
      try {
        if (id) api.remove(id);
      } catch {
        // Already gone.
      }
      box.remove();
      resolve(t);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    // The widget's mode (Invisible) is chosen on the site key in the Cloudflare dashboard.
    id = api.render(box, { sitekey: siteKey, callback: (t) => done(t), "error-callback": () => done(null) });
  });
}
