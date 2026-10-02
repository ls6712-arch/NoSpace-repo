// Layout-regression detector. Run in the page, it reports three things:
//   clipped    text hidden by overflow:hidden/clip (this covers `truncate`
//              and line-clamp), with whether the clipped text has a title /
//              aria-label so a pointer user can still read it
//   offscreen  text that extends past the viewport outside any scroller
//   wraps      how many lines every text block occupies, so two builds can
//              be compared for text that grew a line
// plus page-level horizontal scroll. Compare two builds with diffDetections.

export interface Flag { kind: "clipped" | "offscreen"; sel: string; text: string; axis: "x" | "y" | ""; titled: boolean }
export interface Detection { hscroll: number; flags: Flag[]; wraps: Record<string, { lines: number; fs: number }> }

/** Runs inside the page (serialised by Playwright) — keep it self-contained. */
export function detectInPage(): Detection {
  const vw = document.documentElement.clientWidth;
  const cls = (el: Element) => (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  const sel = (el: Element) => el.tagName.toLowerCase() + (cls(el) ? "." + cls(el) : "");
  const txt = (el: Element) => ((el as HTMLElement).innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
  const accessibleName = (el: Element) => {
    for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) if (a.getAttribute("title") || a.getAttribute("aria-label")) return true;
    return !!el.querySelector("[title],[aria-label]");
  };
  const inClip = (el: Element) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true; return false; };
  const out: Detection = { hscroll: document.documentElement.scrollWidth - vw, flags: [], wraps: {} };
  const clipped = (v: string) => v === "hidden" || v === "clip";
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue; // sr-only text is clipped on purpose
    const t = txt(el);
    if (t) {
      if ((r.right > vw + 1 || r.left < -1) && cs.position !== "fixed" && !inClip(el)) out.flags.push({ kind: "offscreen", sel: sel(el), text: t, axis: "x", titled: false });
      if (clipped(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.flags.push({ kind: "clipped", sel: sel(el), text: t, axis: "x", titled: accessibleName(el) });
      if (clipped(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.flags.push({ kind: "clipped", sel: sel(el), text: t, axis: "y", titled: accessibleName(el) });
    }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim()).map((n) => (n.textContent ?? "").trim()).join(" ").replace(/\s+/g, " ");
    if (own.length >= 3) {
      const tops = new Set<number>();
      for (const n of el.childNodes) { if (n.nodeType !== 3 || !(n.textContent ?? "").trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const rc of rg.getClientRects()) if (rc.width > 1) tops.add(Math.round(rc.top / 3)); }
      const k = el.tagName.toLowerCase() + "|" + own.slice(0, 60);
      if (!(k in out.wraps)) out.wraps[k] = { lines: tops.size, fs: parseFloat(cs.fontSize) };
    }
  }
  return out;
}

const keyOf = (f: Flag) => `${f.kind}|${f.sel.split(".")[0]}|${f.text}|${f.axis}`;

export interface Diff { newFlags: Flag[]; wrappedMore: { key: string; before: number; after: number; fsBefore: number; fsAfter: number }[]; untitledClips: Flag[] }

/** What `after` has that `before` didn't. Class names are ignored in the key, so a class rename never shows up as a regression. */
export function diffDetections(before: Detection | undefined, after: Detection): Diff {
  const seen = new Map<string, number>();
  for (const f of before?.flags ?? []) seen.set(keyOf(f), (seen.get(keyOf(f)) ?? 0) + 1);
  const newFlags: Flag[] = [];
  for (const f of after.flags) { const n = seen.get(keyOf(f)) ?? 0; if (n > 0) seen.set(keyOf(f), n - 1); else newFlags.push(f); }
  const wrappedMore = Object.entries(after.wraps).flatMap(([key, a]) => { const b = before?.wraps[key]; return b && a.lines > b.lines ? [{ key, before: b.lines, after: a.lines, fsBefore: b.fs, fsAfter: a.fs }] : []; });
  return { newFlags, wrappedMore, untitledClips: after.flags.filter((f) => f.kind === "clipped" && !f.titled) };
}

/** Self-test CSS: inflates every type step by 45%. A detector that can't see this is deaf. */
export const INFLATE_CSS = ".text-caption,.text-small,.text-body,.text-lead,.text-title{font-size:1.45em !important}";
