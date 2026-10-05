// Image audit, run in the page. Three questions:
//  1. Does every image box keep its size when the photo arrives? (snapshot with
//     the photos held back, snapshot after release, compare)
//  2. Is every below-the-fold <img> lazy?
//  3. With every photo broken (404), does anything still show a broken-image glyph?
export interface ImgInfo { id: number; sel: string; w: number; h: number; top: number; lazy: boolean; below: boolean; loaded: boolean; broken: boolean; box: string }
export interface ImgSnapshot { imgs: ImgInfo[]; shifts: number; sources: { v: number; node: string }[] }

export function imagesInPage(opts: { tag: boolean }): ImgSnapshot {
  const out: ImgInfo[] = [];
  const els = [...document.querySelectorAll<HTMLImageElement>("img, video")];
  els.forEach((el, i) => {
    if (opts.tag) el.setAttribute("data-img-audit", String(i));
    const id = Number(el.getAttribute("data-img-audit") ?? i);
    const r = el.getBoundingClientRect();
    const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).slice(0, 3).join(".");
    const parent = el.parentElement; const pr = parent?.getBoundingClientRect();
    const isImg = el instanceof HTMLImageElement;
    out.push({
      id, sel: el.tagName.toLowerCase() + (cls ? "." + cls : "") + (el.getAttribute("alt") ? ` "${el.getAttribute("alt")!.slice(0, 24)}"` : ""),
      w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY),
      lazy: !isImg || el.loading === "lazy", below: r.top + scrollY > innerHeight * 1.2,
      loaded: isImg ? el.complete && el.naturalWidth > 0 : (el as HTMLVideoElement).readyState >= 1,
      broken: isImg && el.complete && el.naturalWidth === 0 && !!el.getAttribute("src"),
      box: pr ? `${Math.round(pr.width)}x${Math.round(pr.height)}` : "",
    });
  });
  return { imgs: out, shifts: Number((window as unknown as { __cls?: number }).__cls ?? 0), sources: (window as unknown as { __clsSrc?: { v: number; node: string }[] }).__clsSrc ?? [] };
}

/** Installed before any page script: sums layout-shift values (outside user input) into window.__cls. */
export function clsObserverInit() {
  const w = window as unknown as { __cls: number; __clsSrc: { v: number; node: string }[] };
  w.__cls = 0; w.__clsSrc = [];
  const name = (n: Node | null) => { if (!(n instanceof Element)) return "?"; const c = (typeof n.className === "string" ? n.className : "").trim().split(/\s+/).slice(0, 2).join("."); const p = n.parentElement; return `${n.tagName.toLowerCase()}${c ? "." + c : ""}${p ? " < " + p.tagName.toLowerCase() + (typeof p.className === "string" && p.className ? "." + p.className.trim().split(/\s+/)[0] : "") : ""}`; };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] }[]) {
        if (e.hadRecentInput) continue; w.__cls += e.value;
        for (const s of e.sources ?? []) w.__clsSrc.push({ v: e.value, node: name(s.node) });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch { /* unsupported engine */ }
}
