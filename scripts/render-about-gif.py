#!/usr/bin/env python3
"""Render assets/how-it-works.html to an animated GIF.

`how-it-works.html` is the source of truth — an interactive five-panel
carousel embedded in the published Notion template. This script exists for
places that can't run it: a GitHub README, a slide, a social card.
Regenerate after editing the HTML; never hand-edit the GIF.

Prerequisites:

    brew install librsvg imagemagick gifsicle

Why this is more than "screenshot the SVGs": each panel's illustration is an
inline <svg>, but its step label, headline and caption live in sibling HTML
(`div.cap`). Rasterising the SVGs alone would drop the words that carry the
argument. So each frame is *composed* — illustration plus text, laid out into
one standalone SVG — and only then rasterised.

Two details that matter:

1. **librsvg does not implement CSS custom properties.** `fill="var(--people)"`
   is simply dropped and the shape renders default black. Every `var(--token)`
   is substituted with its literal before rasterising — the same trick
   `render-gif.py` uses on hero.svg. A GIF also has no equivalent of
   `prefers-color-scheme`, so light and dark are separate files.

2. **The caption baseline is pinned across frames.** Panel 1's illustration is
   260 user units tall and the rest are 290. Laying each caption directly
   under its own illustration would make the text jump on every advance, so
   the illustration band is fixed at the tallest panel's height and every
   caption starts at the same y.

Usage:
    python3 scripts/render-about-gif.py [--theme light|dark] [--width 1000]
                                        [--delay 350] [--out PATH]
"""

import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "how-it-works.html"

# ── frame geometry, in user units (the raster width is a --width multiple) ──
FW, FH = 1000, 640
PAD = 20                    # canvas → stage panel
INNER = 36                  # stage panel → content
ILL_TOP = 52
ILL_BAND = 322              # tallest panel (290) at the content scale
CAP_STEP_Y = 424            # pinned: see docstring note 2
CAP_HEAD_Y = 470
CAP_BODY_Y = 512
CAP_LEADING = 29
DOTS_Y = 598

FONT = ("ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', "
        "Inter, Helvetica, Arial, sans-serif")


def check_tools() -> None:
    missing = [t for t in ("rsvg-convert", "magick", "gifsicle")
               if not shutil.which(t)]
    if missing:
        sys.exit(f"missing: {', '.join(missing)}\n"
                 f"install with:  brew install librsvg imagemagick gifsicle")


def token_maps(doc: str) -> tuple[dict, dict]:
    """Pull the light tokens from :root and the dark overrides from the
    prefers-color-scheme block."""
    root = re.search(r":root\s*\{([^}]*)\}", doc).group(1)
    light = dict(re.findall(r"(--[\w-]+):\s*([^;]+);", root))

    dark = dict(light)
    m = re.search(r"@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*"
                  r":root\s*\{([^}]*)\}", doc)
    if m:
        dark.update(dict(re.findall(r"(--[\w-]+):\s*([^;]+);", m.group(1))))
    return light, {k: v.strip() for k, v in dark.items()}


def resolve(text: str, tokens: dict) -> str:
    """Substitute every var(--x) with its literal, repeatedly, so tokens that
    reference other tokens still land."""
    for _ in range(4):
        new = re.sub(r"var\(\s*(--[\w-]+)\s*\)",
                     lambda m: tokens.get(m.group(1), "#000").strip(), text)
        if new == text:
            break
        text = new
    return text


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def parse_slides(doc: str) -> list[dict]:
    out = []
    for block in re.findall(r'<section class="slide".*?</section>', doc, re.S):
        svg = re.search(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*?)</svg>', block, re.S)
        step = re.search(r'<div class="step">(.*?)</div>', block, re.S)
        head = re.search(r"<h2>(.*?)</h2>", block, re.S)
        body = re.search(r"<p>(.*?)</p>", block, re.S)
        vb = [float(v) for v in svg.group(1).split()]
        out.append(dict(vw=vb[2], vh=vb[3], art=svg.group(2),
                        step=strip_tags(step.group(1)),
                        head=strip_tags(head.group(1)),
                        body=strip_tags(body.group(1))))
    return out


def wrap(s: str, size: float, width: float) -> list[str]:
    """Greedy wrap on an estimated average advance. Approximate by design —
    the caption column is generous and a stray short line costs nothing."""
    per = size * 0.505
    limit = max(1, int(width / per))
    lines, cur = [], ""
    for word in s.split():
        cand = f"{cur} {word}".strip()
        if len(cand) <= limit:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def frame_svg(slide: dict, idx: int, total: int, style: str, tk: dict) -> str:
    ink, muted = tk["--ink"].strip(), tk["--muted"].strip()
    bg, panel = tk["--bg"].strip(), tk["--panel"].strip()
    hair, accent = tk["--hairline"].strip(), tk["--people"].strip()

    content_w = FW - 2 * PAD - 2 * INNER
    scale = content_w / slide["vw"]
    ox = PAD + INNER

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{FW}" height="{FH}" '
         f'viewBox="0 0 {FW} {FH}" font-family="{FONT}">',
         f"<style>{style}</style>",
         f'<rect width="{FW}" height="{FH}" fill="{bg}"/>',
         f'<rect x="{PAD}" y="{PAD}" width="{FW-2*PAD}" height="{FH-2*PAD}" '
         f'rx="16" fill="{panel}" stroke="{hair}" stroke-width="1.5"/>',
         # the panel's own illustration, scaled into the content column
         f'<g transform="translate({ox},{ILL_TOP}) scale({scale:.5f})">',
         slide["art"], "</g>"]

    o.append(f'<text x="{ox}" y="{CAP_STEP_Y}" font-size="13" font-weight="700" '
             f'letter-spacing="2.4" fill="{muted}">'
             f'{esc(slide["step"].upper())}</text>')
    o.append(f'<text x="{ox}" y="{CAP_HEAD_Y}" font-size="31" font-weight="650" '
             f'fill="{ink}">{esc(slide["head"])}</text>')
    for i, line in enumerate(wrap(slide["body"], 19, content_w - 40)):
        o.append(f'<text x="{ox}" y="{CAP_BODY_Y + i*CAP_LEADING}" '
                 f'font-size="19" fill="{muted}">{esc(line)}</text>')

    # Carousel dots, so a still frame still reads as one of five.
    for i in range(total):
        cx = ox + 6 + i * 20
        on = i == idx
        o.append(f'<circle cx="{cx}" cy="{DOTS_Y}" r="{5 if on else 3.5}" '
                 f'fill="{accent if on else hair}"/>')
    o.append(f'<text x="{FW-PAD-INNER}" y="{DOTS_Y+5}" font-size="14" '
             f'text-anchor="end" fill="{muted}">{idx+1} / {total}</text>')

    o.append("</svg>")
    return "\n".join(o)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme", choices=("light", "dark"), default="light")
    ap.add_argument("--width", type=int, default=1000)
    ap.add_argument("--delay", type=int, default=350,
                    help="hundredths of a second per panel")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    check_tools()

    doc = SRC.read_text()
    light, dark = token_maps(doc)
    tk = dark if a.theme == "dark" else light

    style = resolve(re.search(r"<style>(.*?)</style>", doc, re.S).group(1), tk)
    slides = parse_slides(doc)
    if not slides:
        sys.exit("no slides parsed — has how-it-works.html changed shape?")

    out = a.out or (ROOT / "assets" /
                    (f"how-it-works{'-dark' if a.theme == 'dark' else ''}.gif"))

    with tempfile.TemporaryDirectory() as td:
        pngs = []
        for i, s in enumerate(slides):
            s = dict(s, art=resolve(s["art"], tk))
            svg_path = Path(td) / f"{i:02d}.svg"
            png_path = Path(td) / f"{i:02d}.png"
            svg_path.write_text(frame_svg(s, i, len(slides), style, tk))
            subprocess.run(["rsvg-convert", "-w", str(a.width),
                            "-o", str(png_path), str(svg_path)], check=True)
            pngs.append(str(png_path))

        subprocess.run(["magick", "-delay", str(a.delay), "-loop", "0",
                        *pngs, "-layers", "OptimizePlus", str(out)], check=True)
        subprocess.run(["gifsicle", "-O3", "--colors", "128",
                        "-b", str(out)], check=True)

    kb = out.stat().st_size / 1024
    print(f"{out.relative_to(ROOT)}  {len(slides)} frames  "
          f"{a.width}px  {kb:.0f} KB  ({a.theme})")


if __name__ == "__main__":
    main()
