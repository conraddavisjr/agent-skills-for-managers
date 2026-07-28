#!/usr/bin/env python3
"""Render assets/hero.svg to an animated GIF.

The SVG is the source of truth. This script exists only for places that cannot
display an animated SVG — a slide, a conference talk, a social card. Regenerate
after editing the SVG; never hand-edit the GIF.

Prerequisites:

    brew install librsvg imagemagick gifsicle

Three tools, because each does one part: `rsvg-convert` rasterises the SVG,
`magick` assembles the PNG frames into a GIF, and `gifsicle` optimises the
result. (gifsicle reads GIF only — it cannot take the PNGs directly.)

How it works: CSS animation can't be rasterised directly, so each frame is a
copy of the SVG with the animations switched off and the animated properties
pinned to their value at that instant. The dashes are the motion that matters;
the node pulse is reproduced from the same keyframe shape.

Usage:
    python3 scripts/render-gif.py [--frames 28] [--width 1200] [--out assets/hero.gif]
"""

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "hero.svg"

# One dash cycle is 120 user units — see `@keyframes march` in the SVG.
DASH_PERIOD = 120.0


def check_tools() -> None:
    missing = [t for t in ("rsvg-convert", "magick", "gifsicle") if not shutil.which(t)]
    if missing:
        sys.exit(
            f"missing: {', '.join(missing)}\n"
            f"install with:  brew install librsvg imagemagick gifsicle"
        )


def pulse_scale(phase: float) -> float:
    """Mirror `@keyframes pulse`: rest, a brief swell at 9%, rest by 24%."""
    p = phase % 1.0
    if p < 0.09:
        return 1.0 + 0.055 * (p / 0.09)
    if p < 0.24:
        return 1.0 + 0.055 * (1 - (p - 0.09) / 0.15)
    return 1.0


def resolve_tokens(svg: str, theme: str) -> str:
    """Inline the CSS custom properties as literal values.

    librsvg does not implement custom properties, so `stroke: var(--hairline)`
    is simply dropped — which is why an unresolved render loses the node rings
    entirely and draws everything in default black. Substituting the literals up
    front is what makes the raster match the browser.
    """
    base = re.search(r"svg \{\s*(--[\s\S]*?)\}", svg).group(1)
    tokens = dict(re.findall(r"(--[\w-]+):\s*([^;]+);", base))

    if theme == "dark":
        dark = re.search(
            r"@media \(prefers-color-scheme: dark\) \{\s*svg \{([\s\S]*?)\}\s*\}", svg
        ).group(1)
        tokens.update(dict(re.findall(r"(--[\w-]+):\s*([^;]+);", dark)))

    # The media query can't apply in a static raster, so drop it either way.
    svg = re.sub(
        r"@media \(prefers-color-scheme: dark\) \{\s*svg \{[\s\S]*?\}\s*\}", "", svg
    )
    for name, value in tokens.items():
        svg = svg.replace(f"var({name})", value.strip())

    # `currentColor` reaches the glyphs by inheritance from each lane's `color`.
    # librsvg resolves that unreliably through use-element shadow trees, so pin
    # it to the one lane still visible.
    lane = re.search(r"\.people \{ color: ([^;]+); \}", svg)
    if lane:
        svg = svg.replace("currentColor", lane.group(1).strip())
    return svg


def freeze(svg: str, t: float) -> str:
    """Return the SVG with animation disabled and properties pinned at time t (0..1)."""
    offset = -DASH_PERIOD * t

    # Kill every animation so the rasteriser sees a static document. The rules
    # are a mix of one-per-line and inline, so match the declaration itself.
    svg = re.sub(r"animation:\s*(march|pulse)[^;]*;", "", svg)

    # Pin the marching dashes.
    svg = svg.replace(
        "stroke-dasharray: 1 11;",
        f"stroke-dasharray: 1 11; stroke-dashoffset: {offset:.2f};",
    )
    svg = svg.replace(
        "stroke-dasharray: 1 9;",
        f"stroke-dasharray: 1 9; stroke-dashoffset: {offset:.2f};",
    )

    # Pin each node's pulse. d1/d2/d3 are thirds of a cycle apart.
    pinned = "".join(
        f"    .{cls} {{ transform: scale({pulse_scale(t + shift):.4f}); }}\n"
        for cls, shift in (("d1", 0.0), ("d2", 0.333), ("d3", 0.666))
    )
    return svg.replace("</style>", pinned + "  </style>")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, default=28, help="frames in one loop")
    ap.add_argument("--width", type=int, default=1200, help="output width in px")
    ap.add_argument("--delay", type=int, default=10, help="hundredths of a second per frame")
    ap.add_argument("--colors", type=int, default=64, help="palette size")
    ap.add_argument("--theme", choices=("light", "dark"), default="light",
                    help="which token set to bake in; also picks the flatten colour")
    ap.add_argument("--out", type=Path, default=ROOT / "assets" / "hero.gif")
    args = ap.parse_args()

    check_tools()
    svg = resolve_tokens(SRC.read_text(), args.theme)

    # Both lanes share one speed here so a short loop closes seamlessly; on the
    # web they run at 7s and 5.6s precisely so they *don't* resolve.
    svg = svg.replace(".code { --speed: 5.6s; }", "")

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        pngs = []
        for i in range(args.frames):
            frame = tmpdir / f"f{i:03d}.svg"
            png = tmpdir / f"f{i:03d}.png"
            frame.write_text(freeze(svg, i / args.frames))
            subprocess.run(
                ["rsvg-convert", "-w", str(args.width), "-o", str(png), str(frame)],
                check=True,
            )
            pngs.append(png)
            print(f"  frame {i + 1}/{args.frames}", end="\r", flush=True)

        print()
        args.out.parent.mkdir(parents=True, exist_ok=True)

        # PNG frames -> GIF. The illustration has a transparent background, so
        # flatten onto a solid colour matching the theme; a GIF's 1-bit alpha
        # would otherwise fringe the antialiased strokes.
        backdrop = "#0d1117" if args.theme == "dark" else "white"
        raw = tmpdir / "raw.gif"
        subprocess.run(
            ["magick", "-delay", str(args.delay), "-loop", "0",
             *map(str, pngs), "-background", backdrop, "-alpha", "remove",
             "-layers", "OptimizeFrame", str(raw)],
            check=True,
        )
        # Then let gifsicle do what it is actually good at.
        subprocess.run(
            ["gifsicle", "--loop", "--optimize=3", "--colors", str(args.colors),
             str(raw), "-o", str(args.out)],
            check=True,
        )

    kb = args.out.stat().st_size / 1024
    out = args.out.resolve()
    shown = out.relative_to(ROOT) if out.is_relative_to(ROOT) else out
    print(f"wrote {shown} ({kb:.0f} KB, {args.frames} frames)")


if __name__ == "__main__":
    main()
