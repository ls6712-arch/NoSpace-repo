// WCAG contrast audit, run in the page. For every element that owns visible
// text it composites the real foreground over the real stack of backgrounds
// beneath it (elementsFromPoint, so absolutely positioned fills count), and
// compares the ratio with 4.5:1, or 3:1 for large text (>= 24px, or >= 18.66px
// bold). Text over a photo, video or illustration is judged against the scrim
// layers above it (a two-stop vertical gradient is sampled at the text's
// position), with the media assumed as bright as a very bright photo (#E6E6E6) or as dark as black:
// no scrim, or too thin a one, fails. Those elements are also listed under
// `overMedia`.
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
    if (el.closest("[aria-hidden=true]")) { out.skipped++; continue; } // decorative (separator dots) or hidden from assistive tech
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
    // Something unrelated sits above it with a fill (a dialog's dimming overlay): the user isn't reading this text right now.
    if (stack.slice(0, i).some((e) => !e.contains(el) && !el.contains(e) && straight(getComputedStyle(e).backgroundColor)[3] > 0.2)) { out.skipped++; continue; }
    // Walk down from the text's own element collecting fills until one is opaque,
    // or until the photo/video/illustration underneath: text over media is judged
    // against the scrim layers above it, with the media assumed to be as bright
    // (white) or as dark (black) as it could possibly be.
    let media = false; let opaque = false;
    type Layer = { color: RGBA; stops: RGBA[]; sampled: RGBA | null };
    const layers: Layer[] = [];
    const num = "[\\d.]+";
    const sample = (bi: string, r: DOMRect): RGBA | null => {
      const m = bi.match(/^linear-gradient\(\s*to (top|bottom),(.*)\)$/s); if (!m) return null;
      // top-level comma split, each item "<colour> [N%]"
      const items: string[] = []; let depth = 0, cur = "";
      for (const ch of m[2]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { items.push(cur.trim()); cur = ""; } else cur += ch; }
      items.push(cur.trim());
      const stops = items.map((it, idx) => {
        const pm = it.match(/\s(-?[\d.]+)%$/); const col = (pm ? it.slice(0, pm.index) : it).trim();
        return { c: col === "transparent" ? ([0, 0, 0, 0] as RGBA) : straight(col), p: pm ? parseFloat(pm[1]) / 100 : idx / Math.max(1, items.length - 1) };
      });
      if (stops.length < 2) return null;
      const u = m[1] === "top" ? (r.bottom - py) / r.height : (py - r.top) / r.height; const f = Math.min(1, Math.max(0, u));
      let lo = stops[0], hi = stops[stops.length - 1];
      for (let q = 0; q < stops.length - 1; q++) if (f >= stops[q].p && f <= stops[q + 1].p) { lo = stops[q]; hi = stops[q + 1]; break; }
      const g = hi.p === lo.p ? 0 : (f - lo.p) / (hi.p - lo.p);
      return [0, 1, 2, 3].map((j) => lo.c[j] + (hi.c[j] - lo.c[j]) * g) as RGBA;
    };
    void num;
    for (let k = i; k < stack.length && !opaque; k++) {
      const e = stack[k]; const s = getComputedStyle(e);
      if (e instanceof HTMLImageElement || e instanceof HTMLVideoElement || e instanceof HTMLCanvasElement || (e instanceof SVGSVGElement && e.getBoundingClientRect().width >= 110 && e.getBoundingClientRect().height >= 70)) { media = true; break; }
      const bi = s.backgroundImage; const bc = straight(s.backgroundColor); let stops: RGBA[] = []; let sampled: RGBA | null = null;
      if (bi && bi !== "none") {
        if (/url\(/.test(bi)) { media = true; break; }
        sampled = sample(bi, e.getBoundingClientRect());
        stops = (bi.match(/(?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)/g) ?? []).map(straight).filter((c) => c[3] > 0);
      }
      layers.push({ color: bc, stops, sampled });
      if (!sampled && ((stops.length === 0 && bc[3] >= 0.999) || (stops.length > 0 && stops.every((c) => c[3] >= 0.999)))) opaque = true;
    }
    let cands: RGBA[];
    if (media) cands = [[230, 230, 230, 1], [0, 0, 0, 1]]; // a very bright photo, and a black one
    else if (opaque) cands = [[255, 255, 255, 1]]; // page canvas behind everything
    else { const root = straight(getComputedStyle(document.documentElement).backgroundColor), body = straight(getComputedStyle(document.body).backgroundColor); cands = [over(body, over(root, [255, 255, 255, 1]))]; }
    for (let k = layers.length - 1; k >= 0; k--) {
      const L = layers[k]; const next: RGBA[] = [];
      for (const base of cands) {
        const withColor = over(L.color, base);
        if (L.sampled) next.push(over(L.sampled, withColor));
        else if (L.stops.length) for (const st of L.stops) next.push(over(st, withColor));
        else next.push(withColor);
      }
      cands = next;
    }
    if (media) out.overMedia.push(`${name(el)} "${n.textContent!.trim().slice(0, 30)}"`);
    const fgRaw = straight(cs.color); const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700); const need = large ? 3 : 4.5;
    let worst = Infinity, worstBg = cands[0], worstFg = fgRaw;
    for (const bg of cands) { const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg); const q = ratio(fg, bg); if (q < worst) { worst = q; worstBg = bg; worstFg = fg; } }
    out.checked++;
    if (worst < need - 0.005) {
      const key = `${name(el)}|${n.textContent!.trim().slice(0, 30)}|${hex(worstFg)}|${hex(worstBg)}`; if (seen.has(key)) continue; seen.add(key);
      out.failures.push({ sel: (media ? "[over photo] " : "") + name(el), text: n.textContent!.trim().slice(0, 40), fg: hex(worstFg), bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need, size });
    }
  }
  window.scrollTo(0, 0);
  return out;
}
