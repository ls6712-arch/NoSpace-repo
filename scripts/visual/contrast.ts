// WCAG contrast audit, run in the page. For every element that owns visible
// text it composites the real foreground over the real stack of backgrounds
// beneath it (elementsFromPoint, so absolutely positioned fills count), and
// compares the ratio with 4.5:1, or 3:1 for large text (>= 24px, or >= 18.66px
// bold). Text over a photo/video can't be judged from CSS: it's skipped and
// listed under `overMedia` so it stays visible in the report.
export interface ContrastFailure { sel: string; text: string; fg: string; bg: string; ratio: number; need: number; size: number }
export interface ContrastResult { checked: number; failures: ContrastFailure[]; overMedia: string[]; skipped: number }

export function contrastInPage(): ContrastResult {
  type RGBA = [number, number, number, number];
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  // Canvas normalises any CSS colour (color-mix, oklab, color(srgb)…) to rgba.
  const parse = (c: string): RGBA => {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  };
  const straight = (c: string): RGBA => {
    const m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return parse(c);
  };
  const over = (top: RGBA, bottom: RGBA): RGBA => { const a = top[3] + bottom[3] * (1 - top[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) as RGBA; };
  const lum = (c: RGBA) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a: RGBA, b: RGBA) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c: RGBA) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const name = (el: Element) => { const cls = (typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "").trim().split(/\s+/).slice(0, 2).join("."); return el.tagName.toLowerCase() + (cls ? "." + cls : ""); };

  const out: ContrastResult = { checked: 0, failures: [], overMedia: [], skipped: 0 };
  const seen = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || done.has(el) || !n.textContent?.trim()) continue;
    if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    done.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || (el as HTMLButtonElement).disabled || el.closest("[disabled],[aria-disabled=true],[inert]")) { out.skipped++; continue; }
    const range = document.createRange(); range.selectNodeContents(n); const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > innerHeight * 40) { out.skipped++; continue; }
    if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || (cs.color === "rgba(0, 0, 0, 0)")) { out.skipped++; continue; } // gradient/clip text
    let opacity = 1; for (let e: Element | null = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity); if (opacity < 0.05) { out.skipped++; continue; }
    // Scroll into the probe point: elementsFromPoint only sees the viewport.
    const px = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), py = r.top + r.height / 2;
    let stack: Element[] = [];
    if (py >= 0 && py < innerHeight) stack = document.elementsFromPoint(px, py); else { window.scrollTo(0, window.scrollY + py - innerHeight / 2); const r2 = range.getBoundingClientRect(); stack = document.elementsFromPoint(px, Math.min(Math.max(r2.top + r2.height / 2, 0), innerHeight - 1)); }
    // Hidden behind something that isn't its own ancestor/descendant (an open dialog's overlay, a covering panel): not what the user sees.
    let i = stack.indexOf(el); if (i < 0) i = stack.findIndex((e) => el.contains(e));
    if (i < 0 && cs.pointerEvents === "none") i = stack.findIndex((e) => e.contains(el));
    if (i < 0) { out.skipped++; continue; }
    // Walk down from the text's own element collecting fills until one is opaque.
    let cands: RGBA[] = [[0, 0, 0, 0]]; let media = false; let opaque = false;
    const layers: { color: RGBA; stops: RGBA[] }[] = [];
    for (let k = i; k < stack.length && !opaque; k++) {
      const e = stack[k]; const s = getComputedStyle(e);
      if (e instanceof HTMLImageElement || e instanceof HTMLVideoElement || e instanceof HTMLCanvasElement) { media = true; break; }
      const bi = s.backgroundImage; const bc = straight(s.backgroundColor); let stops: RGBA[] = [];
      if (bi && bi !== "none") {
        if (/url\(/.test(bi)) { media = true; break; }
        stops = (bi.match(/(?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)/g) ?? []).map(straight).filter((c) => c[3] > 0);
      }
      layers.push({ color: bc, stops });
      if ((stops.length === 0 && bc[3] >= 0.999) || (stops.length > 0 && stops.every((c) => c[3] >= 0.999))) opaque = true;
    }
    if (media) { out.overMedia.push(`${name(el)} "${n.textContent!.trim().slice(0, 30)}"`); continue; }
    cands = [[255, 255, 255, 1]]; // page canvas behind everything
    if (!opaque) { const root = straight(getComputedStyle(document.documentElement).backgroundColor), body = straight(getComputedStyle(document.body).backgroundColor); cands = [over(body, over(root, [255, 255, 255, 1]))]; }
    for (let k = layers.length - 1; k >= 0; k--) {
      const L = layers[k]; const next: RGBA[] = [];
      for (const base of cands) {
        const withColor = over(L.color, base);
        if (L.stops.length) for (const st of L.stops) next.push(over(st, withColor)); else next.push(withColor);
      }
      cands = next;
    }
    const fgRaw = straight(cs.color); const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700); const need = large ? 3 : 4.5;
    let worst = Infinity, worstBg = cands[0], worstFg = fgRaw;
    for (const bg of cands) { const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg); const q = ratio(fg, bg); if (q < worst) { worst = q; worstBg = bg; worstFg = fg; } }
    out.checked++;
    if (worst < need - 0.005) {
      const key = `${name(el)}|${n.textContent!.trim().slice(0, 30)}|${hex(worstFg)}|${hex(worstBg)}`; if (seen.has(key)) continue; seen.add(key);
      out.failures.push({ sel: name(el), text: n.textContent!.trim().slice(0, 40), fg: hex(worstFg), bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need, size });
    }
  }
  window.scrollTo(0, 0);
  return out;
}
