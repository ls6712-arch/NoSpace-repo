// Touch-target audit. Under touch emulation ((pointer: coarse) matches), finds
// every visible interactive element and hit-tests a centred 44x44 box around
// it: an element passes when all four corners of that box land on the element
// (or something inside it). That measures the real, effective hit area, so a
// padded or pseudo-element hit area counts and a neighbour stealing the
// corner shows up as a failure. A second pass reports pairs of elements whose
// 44px areas overlap, where the topmost one wins the touch.

export interface TouchItem { sel: string; text: string; w: number; h: number; inline: boolean; reason: "small" | "overlap"; stolenBy?: string; top: number; fromBottom: number }
export interface TouchOverlap { a: string; b: string; px: number }
export interface TouchResult { total: number; failing: TouchItem[]; overlaps: TouchOverlap[] }

/** Runs inside the page (serialised by Playwright) — keep it self-contained. The viewport must be tall enough to hold the whole page. */
export function touchAuditInPage(min = 44): TouchResult {
  const SEL = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [role="option"], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const name = (el: Element) => { const c = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 2).join("."); return el.tagName.toLowerCase() + (c ? "." + c : ""); };
  const label = (el: Element) => (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 32);
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.pointerEvents !== "none" && parseFloat(cs.opacity || "1") > 0.01; };
  // Containers that carry tabindex for roving focus are not tap targets themselves.
  const els = [...document.querySelectorAll(SEL)].filter(visible).filter((e) => !(e as HTMLInputElement).disabled && !e.matches('[role="tablist"], [role="tabpanel"], [role="radiogroup"], [role="menu"], [role="listbox"], [role="dialog"], [role="group"]'));
  const failing: TouchItem[] = []; const boxes: { el: Element; l: number; t: number; r: number; b: number }[] = [];
  for (const el of els) {
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const h = min / 2 - 1.5; // sub-pixel layout can shave half a pixel off an edge
    const inline = getComputedStyle(el).display === "inline";
    boxes.push({ el, l: cx - min / 2, t: cy - min / 2, r: cx + min / 2, b: cy + min / 2 });
    if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) continue;
    // Not reachable at all where it sits (scrolled out of a carousel, behind an overlay): nothing to measure.
    // Partly cut off by a scroller or clipping ancestor (a card peeking in from the edge of a carousel): scrolling reveals it.
    const cutOff = (() => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (o.overflowX === "visible" && o.overflowY === "visible") continue; const q = a.getBoundingClientRect(); if (r.left < q.left - 0.5 || r.right > q.right + 0.5 || r.top < q.top - 0.5 || r.bottom > q.bottom + 0.5) return true; } return false; })();
    if (cutOff) continue;
    const centre = document.elementFromPoint(cx, cy);
    if (!centre || !(el === centre || el.contains(centre) || centre.contains(el))) continue;
    const pts = [[cx - h, cy - h], [cx + h, cy - h], [cx - h, cy + h], [cx + h, cy + h]];
    const hits = pts.map(([x, y]) => (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight ? el : document.elementFromPoint(x, y)));
    // A tap that lands on an interactive ANCESTOR (a button inside a link) still activates the control, so it passes.
    const bad = hits.find((n) => n && !(el === n || el.contains(n) || (n.contains(el) && n.matches(SEL))));
    if (!bad) continue;
    // A corner that lands on ANOTHER interactive element is an overlap between neighbours' hit areas
    // (listed separately); a corner that lands on plain content means this element has no hit area there.
    const other = bad ? (bad as Element).closest(SEL) : null;
    const reason = other && other !== el && !el.contains(other) && !other.contains(el) ? "overlap" : "small";
    failing.push({ sel: name(el), text: label(el), w: Math.round(r.width), h: Math.round(r.height), inline, reason, stolenBy: bad ? name(bad) : undefined, top: Math.round(r.top), fromBottom: Math.round(document.documentElement.scrollHeight - r.bottom) });
  }
  const overlaps: TouchOverlap[] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
    // only count overlap that comes from the 44px expansion, not from elements that already touch
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    const realX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), realY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 1 && oy > 1 && !(realX > 0 && realY > 0)) overlaps.push({ a: `${name(a.el)} "${label(a.el)}"`, b: `${name(b.el)} "${label(b.el)}"`, px: Math.round(Math.min(ox, oy)) });
  }
  return { total: els.length, failing, overlaps };
}
