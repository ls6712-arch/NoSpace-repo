#!/usr/bin/env python3
"""Design-token audit for docs/design-audit.md.

Read-only: walks src/**/*.{ts,tsx,css} and counts the raw values the P0
Foundations token pass replaces. Re-run after each Phase 2 sweep to see what's
left:  python3 scripts/design-audit.py [--files]
"""
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
THEME = SRC / "styles" / "theme.css"
SHOW_FILES = "--files" in sys.argv

files = sorted(p for p in SRC.rglob("*") if p.suffix in {".ts", ".tsx", ".css"})
code = [p for p in files if p.suffix in {".ts", ".tsx"}]

def rel(p):
    return str(p.relative_to(ROOT))


report = {}

# ── Radius ─────────────────────────────────────────────────────────────────
RADIUS = re.compile(r"(?<![\w-])rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|btn|card|moment|control|\[[^\]]+\]))?(?![\w-])")
radius = Counter()
radius_files = defaultdict(Counter)
for p in code:
    for m in RADIUS.finditer(p.read_text()):
        radius[m.group(0)] += 1
        radius_files[m.group(0)][rel(p)] += 1
css_radius = Counter()
for p in files:
    if p.suffix == ".css":
        for m in re.finditer(r"border-radius:\s*([^;]+);", p.read_text()):
            css_radius[f"{p.name}: {m.group(1).strip()}"] += 1
report["radius"] = (radius, radius_files, css_radius)

# ── Type ───────────────────────────────────────────────────────────────────
TW_SIZES = "xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|caption|small|body|lead|title|display|hero"
TEXT_SIZE = re.compile(rf"(?<![\w-])text-(?:{TW_SIZES}|\[[\d.]+(?:px|rem|em)\]|\[clamp\([^\]]+\)\])(?![\w-])")
textsz = Counter()
textsz_files = defaultdict(Counter)
for p in code:
    for m in TEXT_SIZE.finditer(p.read_text()):
        textsz[m.group(0)] += 1
        textsz_files[m.group(0)][rel(p)] += 1
inline_fs = Counter()
for p in code:
    for m in re.finditer(r"fontSize:\s*['\"]?([\w.\-()%, ]+?)['\"]?[,}\n]", p.read_text()):
        inline_fs[m.group(1).strip()] += 1
css_fs = Counter()
for p in files:
    if p.suffix == ".css":
        for m in re.finditer(r"font-size:\s*([^;]+);", p.read_text()):
            css_fs[f"{p.name}: {m.group(1).strip()}"] += 1
report["type"] = (textsz, textsz_files, inline_fs, css_fs)

# text-hero is the landing page's one exception to the type scale.
HERO_ALLOWED = {"src/app/pages/Home.tsx"}
hero_misuse = [f for f in textsz_files.get("text-hero", {}) if f not in HERO_ALLOWED]

# ── Raw black/white ────────────────────────────────────────────────────────
BW = re.compile(r"(?<![\w-])(?:text|bg|border|from|via|to|fill|stroke|ring|outline|decoration|placeholder|shadow|divide)-(?:white|black)(?:/(?:\d+|\[[^\]]+\]))?(?![\w-])")
bw = Counter()
bw_files = defaultdict(Counter)
for p in code:
    for m in BW.finditer(p.read_text()):
        bw[m.group(0)] += 1
        bw_files[m.group(0)][rel(p)] += 1
report["bw"] = (bw, bw_files)

# ── Color literals outside theme.css ───────────────────────────────────────
HEX = re.compile(r"(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])")
# Not \b: Tailwind arbitrary values put "_" before rgb(, e.g. shadow-[0_8px_rgba(…)].
FUNC = re.compile(r"(?<![a-zA-Z-])(?:rgba?|hsla?)\(\s*[\d.]")
color_files = Counter()
color_kinds = Counter()
for p in files:
    if p == THEME:
        continue
    t = p.read_text()
    # skip url-fragment refs like url(#grad) and svg data URIs' %23
    hexes = [m for m in HEX.finditer(t) if not t[max(0, m.start() - 4):m.start()].endswith("url(")]
    funcs = list(FUNC.finditer(t))
    if hexes or funcs:
        color_files[rel(p)] = len(hexes) + len(funcs)
        color_kinds["hex"] += len(hexes)
        color_kinds["rgb/hsl"] += len(funcs)
report["color"] = (color_files, color_kinds)

# ── Shadows ────────────────────────────────────────────────────────────────
SHADOW = re.compile(r"(?<![\w-])shadow(?:-(?:none|2xs|xs|sm|md|lg|xl|2xl|inner|card|overlay|\[[^\]]+\]))?(?![\w-])")
shadow = Counter()
shadow_files = defaultdict(Counter)
for p in code:
    for m in SHADOW.finditer(p.read_text()):
        shadow[m.group(0)] += 1
        shadow_files[m.group(0)][rel(p)] += 1
inline_shadow = Counter()
for p in code:
    for m in re.finditer(r"boxShadow:", p.read_text()):
        inline_shadow[rel(p)] += 1
css_shadow = Counter()
for p in files:
    if p.suffix == ".css":
        css_shadow[p.name] += len(re.findall(r"box-shadow:", p.read_text()))
report["shadow"] = (shadow, shadow_files, inline_shadow, css_shadow)

# ── Motion ─────────────────────────────────────────────────────────────────
DUR = re.compile(r"(?<![\w-])(?:duration|delay)-(?:\d+|fast|base|\[[^\]]+\])(?![\w-])")
TRANS = re.compile(r"(?<![\w-])transition(?:-(?:all|colors|opacity|shadow|transform|none|\[[^\]]+\]))?(?![\w-])")
EASE = re.compile(r"(?<![\w-])ease-(?:linear|in|out|in-out|\[[^\]]+\])(?![\w-])")
dur, trans, ease = Counter(), Counter(), Counter()
dur_files = defaultdict(Counter)
for p in code:
    t = p.read_text()
    for m in DUR.finditer(t):
        dur[m.group(0)] += 1
        dur_files[m.group(0)][rel(p)] += 1
    for m in TRANS.finditer(t):
        trans[m.group(0)] += 1
    for m in EASE.finditer(t):
        ease[m.group(0)] += 1
ms_inline = Counter()
ms_inline_files = Counter()
for p in files:
    t = p.read_text()
    for m in re.finditer(r"(?<![\w.])(\d*\.?\d+)\s*(ms|s)\b", t):
        # only CSS-ish contexts: transition/animation/duration/delay strings
        line = t[t.rfind("\n", 0, m.start()) + 1: t.find("\n", m.end())]
        if re.search(r"transition|animation|duration|delay|setTimeout|ms\b", line, re.I):
            ms_inline[f"{m.group(1)}{m.group(2)}"] += 1
            ms_inline_files[rel(p)] += 1
motion_props = Counter()
for p in code:
    t = p.read_text()
    for m in re.finditer(r"\b(duration|delay):\s*([\d.]+)", t):
        motion_props[f"motion {m.group(1)}: {m.group(2)}"] += 1
    for m in re.finditer(r"setTimeout\([^,]+,\s*(\d+)\)", t):
        motion_props[f"setTimeout {m.group(1)}"] += 1
report["motion"] = (dur, dur_files, trans, ease, ms_inline, ms_inline_files, motion_props)

# ── Section spacing ────────────────────────────────────────────────────────
SPACE = re.compile(r"(?<![\w-])(?:space-y|gap(?:-y)?|mt|mb|my|pt|pb|py)-(\d+(?:\.\d+)?|px|\[[^\]]+\])(?![\w-])")
space = defaultdict(Counter)
for p in code:
    for m in SPACE.finditer(p.read_text()):
        prop = m.group(0).rsplit("-", 1)[0] if not m.group(1).startswith("[") else m.group(0).split("-[")[0]
        space[prop][m.group(1)] += 1
report["space"] = space


def fmt(counter, limit=None):
    items = counter.most_common(limit)
    return "\n".join(f"  {v:>5}  {k}" for k, v in items)


if __name__ == "__main__":
    radius, radius_files, css_radius = report["radius"]
    print("== RADIUS (tsx/ts)", sum(radius.values()))
    print(fmt(radius))
    print("-- css border-radius")
    print(fmt(css_radius))
    textsz, textsz_files, inline_fs, css_fs = report["type"]
    print("== TEXT SIZE", sum(textsz.values()))
    print(fmt(textsz))
    if hero_misuse:
        print("!! text-hero outside the landing page:", ", ".join(hero_misuse))
    print("-- inline fontSize")
    print(fmt(inline_fs))
    print("-- css font-size")
    print(fmt(css_fs))
    bw, bw_files = report["bw"]
    print("== BLACK/WHITE", sum(bw.values()))
    print(fmt(bw))
    color_files, color_kinds = report["color"]
    print("== COLOR LITERALS", dict(color_kinds))
    print(fmt(color_files))
    shadow, shadow_files, inline_shadow, css_shadow = report["shadow"]
    print("== SHADOW", sum(shadow.values()))
    print(fmt(shadow))
    print("-- inline boxShadow")
    print(fmt(inline_shadow))
    print("-- css box-shadow")
    print(fmt(css_shadow))
    dur, dur_files, trans, ease, ms_inline, ms_inline_files, motion_props = report["motion"]
    print("== DURATION", sum(dur.values()))
    print(fmt(dur))
    print("== TRANSITION", sum(trans.values()))
    print(fmt(trans))
    print("== EASE")
    print(fmt(ease))
    print("== INLINE ms/s")
    print(fmt(ms_inline))
    print(fmt(ms_inline_files))
    print("-- motion/setTimeout props")
    print(fmt(motion_props))
    print("== SPACING")
    for prop, c in sorted(report["space"].items()):
        print(prop, sum(c.values()))
        print(fmt(c, 12))
    if SHOW_FILES:
        for title, d in [("radius", radius_files), ("text", textsz_files), ("bw", bw_files), ("shadow", shadow_files), ("dur", dur_files)]:
            print(f"\n######## {title} by file")
            for k in sorted(d):
                print(k)
                print(fmt(d[k]))
