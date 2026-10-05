// Fixed chrome vs content, in the page: the header, the "Pursuits in progress"
// bar (fixed under the header) and the bottom tab bar must not cover each
// other or the content (header + pursuits bar judged at scroll top, tab bar at scroll bottom). Run with simulated
// safe-area insets (notch 47px, home indicator 34px) as well as none.
// problems fail --strict; warnings (content hidden under a bar) are reported until the layout decision is made.
export interface FixedBarsResult { bars: { name: string; top: number; bottom: number }[]; problems: string[]; warnings: string[] }

export function fixedBarsInPage(arg: { top: number; bottom: number; phase: "top" | "bottom" }): FixedBarsResult {
  const insets = arg;
  const root = document.documentElement;
  // A global * rule animates padding/top; measure the settled layout.
  const noAnim = document.createElement("style"); noAnim.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}"; document.head.appendChild(noAnim);
  root.style.setProperty("--safe-top", `${insets.top}px`); root.style.setProperty("--safe-bottom", `${insets.bottom}px`);
  void root.offsetHeight;
  const restore = () => { root.style.removeProperty("--safe-top"); root.style.removeProperty("--safe-bottom"); noAnim.remove(); };
  const out: FixedBarsResult = { bars: [], problems: [], warnings: [] };
  const vis = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.05 && !e.closest("[aria-hidden=true]"); };
  const header = document.querySelector("header") as HTMLElement | null;
  const tab = document.querySelector('nav[aria-label="Main"]') as HTMLElement | null;
  const pbar = [...document.querySelectorAll<HTMLElement>("section")].find((s) => getComputedStyle(s).position === "fixed" && /Pursuits in progress/.test(s.textContent ?? ""));
  const named: [string, HTMLElement | null | undefined][] = [["header", header], ["pursuits-bar", pbar], ["tab-bar", tab]];
  const live = named.filter(([, e]) => e && getComputedStyle(e).display !== "none" && (e === header || e.getBoundingClientRect().height > 0)) as [string, HTMLElement][];
  for (const [n, e] of live) { const r = e.getBoundingClientRect(); out.bars.push({ name: n, top: Math.round(r.top), bottom: Math.round(r.bottom) }); }
  const rect = (n: string) => live.find(([x]) => x === n)?.[1].getBoundingClientRect();
  const hit = (a: DOMRect, b: DOMRect) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const h = rect("header"), p = pbar && pbar.getAttribute("aria-hidden") !== "true" ? rect("pursuits-bar") : undefined, t = rect("tab-bar");
  // The non-production "not the live site" strip sits above the header in flow; production has none, so judge without it.
  const strip = [...document.querySelectorAll<HTMLElement>("[role=status]")].find((e) => /not the live site/.test(e.textContent ?? ""));
  const stripH = strip ? strip.getBoundingClientRect().height : 0;
  if (h && p && h.bottom - stripH - p.top > 1.5) out.problems.push(`pursuits bar sits under the header by ${Math.round(h.bottom - stripH - p.top)}px (insets top ${insets.top}px)`);
  if (p && t && hit(p, t)) out.problems.push("pursuits bar overlaps the tab bar");
  // Content covered: visible text/controls (outside the fixed bars) whose box is under a bar.
  // At the top of the page the header and pursuits bar must not hide content; at the bottom the tab bar must not.
  const bars = (arg.phase === "top" ? [h, p] : [t]).filter(Boolean) as DOMRect[];
  const fixedEls = live.map(([, e]) => e);
  const covered: string[] = [];
  for (const e of document.querySelectorAll<HTMLElement>("main a, main button, main h1, main h2, main h3, main p, main input")) {
    if (!vis(e) || fixedEls.some((f) => f.contains(e))) continue;
    const r = e.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight) continue;
    // Only judge it if the topmost thing at its centre is a fixed bar (that's what the user sees).
    const top = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
    if (top && fixedEls.some((f) => f.contains(top)) && bars.some((b) => hit(b, r))) covered.push(`${e.tagName.toLowerCase()} "${(e.textContent ?? "").trim().slice(0, 28)}" y=${Math.round(r.top)}-${Math.round(r.bottom)} under ${fixedEls.find((f) => f.contains(top))?.tagName.toLowerCase()}`);
  }
  if (covered.length) out.warnings.push(`content under a fixed bar: ${[...new Set(covered)].slice(0, 4).join(", ")}${covered.length > 4 ? ` +${covered.length - 4}` : ""}`);
  restore();
  return out;
}
