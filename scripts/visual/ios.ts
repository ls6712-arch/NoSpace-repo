// iOS Safari gotchas, checked in the page:
//  - any input/textarea/select under 16px makes iOS zoom the page on focus;
//  - the fixed bottom tab bar must take env(safe-area-inset-bottom) (home
//    indicator), which needs viewport-fit=cover and the --safe-bottom token.
// The safe-area check doesn't depend on a real inset: it overrides --safe-bottom
// on the bar (transitions off: a global * rule animates padding) and confirms the bar's padding follows it, and that the token is declared as
// env(safe-area-inset-bottom).
export interface IosResult { smallInputs: { sel: string; fontSize: number }[]; inputs: number; safe?: { viewportFitCover: boolean; tokenIsEnv: boolean; barFollowsToken: boolean | null } }

export function iosChecksInPage(): IosResult {
  const out: IosResult = { smallInputs: [], inputs: 0 };
  const els = [...document.querySelectorAll<HTMLElement>("input, textarea, select")].filter((e) => {
    const t = (e as HTMLInputElement).type;
    if (["hidden", "checkbox", "radio", "range", "file", "submit", "button", "color"].includes(t)) return false;
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  });
  for (const e of els) {
    try { e.focus({ preventScroll: true }); } catch { /* not focusable */ }
    const fs = parseFloat(getComputedStyle(e).fontSize); out.inputs++;
    if (fs < 16) out.smallInputs.push({ sel: e.tagName.toLowerCase() + (e.getAttribute("aria-label") ? `[${e.getAttribute("aria-label")}]` : e.getAttribute("placeholder") ? `[${e.getAttribute("placeholder")}]` : ""), fontSize: fs });
    e.blur();
  }
  const bar = [...document.querySelectorAll<HTMLElement>("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= innerHeight - 1 && n.getBoundingClientRect().width >= innerWidth - 1);
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  // A computed custom property already has env() substituted, so read the declaration from the stylesheet.
  let declared = "";
  const walk = (rules: CSSRuleList) => { for (const r of rules) { if (r instanceof CSSStyleRule) { const v = r.style.getPropertyValue("--safe-bottom"); if (v) declared = v; } else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules); } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ } }
  let follows: boolean | null = null;
  if (bar && getComputedStyle(bar).display !== "none") {
    const before = bar.style.getPropertyValue("--safe-bottom"); bar.style.transition = "none"; bar.style.setProperty("--safe-bottom", "37px");
    follows = Math.abs(parseFloat(getComputedStyle(bar).paddingBottom) - 37) < 0.5;
    if (before) bar.style.setProperty("--safe-bottom", before); else bar.style.removeProperty("--safe-bottom");
  }
  out.safe = { viewportFitCover: /viewport-fit=cover/.test(meta), tokenIsEnv: /env\(\s*safe-area-inset-bottom/.test(declared), barFollowsToken: follows };
  return out;
}
