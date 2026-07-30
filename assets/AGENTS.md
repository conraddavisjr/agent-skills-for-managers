# Working on `assets/`

Context for an agent asked to change the illustration. Deliberately not linked from the
README: a reader of this repo needs the commands, not the drawing's internals.

## What's here

| File | Role |
| --- | --- |
| `hero.svg` | **Source of truth.** Hand-written, meant to be edited. |
| `hero.gif` | Derived raster of the same image, for places that can't show an animated SVG. |
| `how-it-works.html` | **Source of truth.** The five-panel carousel embedded in the published Notion template. |
| `how-it-works.gif` | Derived. Light-theme frames, used in the root README. |
| `how-it-works-dark.gif` | Derived. Dark-theme frames; the README picks between them with `<picture>`. |

Never hand-edit a `.gif`, and never treat one as authoritative. Edit the source, then
regenerate.

## Editing `hero.svg`

Every string a reader sees lives between the `EDIT LABELS HERE` and `END EDIT LABELS`
markers. Stay inside them for any copy change.

Node centres sit on a fixed grid — `x = 114, 600, 1086` and `y = 142` (feedback lane),
`y = 382` (review lane). Adding a stage means copying a `<g class="pulse">` block onto the
same row and extending that lane's `flow` and `return` paths; it is a local edit, not a
redraw.

Colour and timing are CSS custom properties declared on the `svg` element: `--people`,
`--code`, `--ink`, `--muted`, `--hairline`, `--speed`. A `prefers-color-scheme: dark` block
overrides the colour tokens, so light and dark ship in one file. `prefers-reduced-motion`
is honoured — don't add animation that escapes those rules.

## The hidden review loop

A second lane (PR opened → reviewed → merged) is still in the file, wrapped in a comment
block marked `REVIEW LOOP — HIDDEN, NOT DELETED`. It was set aside because it described the
software lifecycle more than the manager's part in it — the illustration now states only the
loop it can state plainly. The `.code` style rules remain live.

Restoring it is three steps, listed at the marker: drop the comment markers, restore the
`── REVIEW LOOP ──` label to a comment of its own, and set the `svg` element's `viewBox` to
`0 0 1200 480` with `height` to match.

**If you restore it, `scripts/render-gif.py` needs a change too.** `resolve_tokens()` pins
`currentColor` to whatever `.people { color: … }` resolves to, because librsvg resolves
inheritance unreliably through `<use>` shadow trees. That shortcut is only correct while one
lane is visible — with both lanes back, the review lane would rasterise in the feedback
lane's colour. The browser-rendered SVG would still look right, so this fails only in the
GIF.

## Regenerating the GIF

```bash
brew install librsvg imagemagick gifsicle
python3 scripts/render-gif.py --width 1000
```

`--theme dark` bakes in the dark token set. A GIF has no equivalent of
`prefers-color-scheme`, so each theme is a separate file — pass `--out` to avoid clobbering
the light one.

## Regenerating the how-it-works GIFs

```bash
python3 scripts/render-about-gif.py                 # assets/how-it-works.gif
python3 scripts/render-about-gif.py --theme dark    # assets/how-it-works-dark.gif
```

Both files are referenced by the root README, so regenerate **both** or the two themes
drift apart.

This one is not a screenshot of the carousel. Each panel's illustration is an inline
`<svg>`, but its step label, headline and caption live in a sibling `div.cap` — rasterising
the SVGs alone would drop the words that carry the argument. So the script *composes* each
frame: illustration plus text, laid out into one standalone SVG, then rasterised.

Two things will bite you if you change the HTML's shape:

- The script finds panels by `<section class="slide">`, and within each one expects an
  `<svg viewBox=…>`, a `div.step`, an `h2` and a `p`. Rename or restructure those and it
  exits with `no slides parsed` rather than silently emitting a broken GIF.
- **Caption baselines are pinned across frames.** Panel 1's illustration is 260 user units
  tall and the rest are 290; laying each caption directly under its own illustration made
  the text jump on every advance. `ILL_BAND` is fixed at the tallest panel's height. If you
  add a panel taller than 290, raise `ILL_BAND` and the `CAP_*` constants together.

Same librsvg caveat as `hero.svg`: custom properties are not implemented, so every
`var(--token)` — in the `<style>` block *and* in presentation attributes like
`fill="var(--people)"` — is substituted with a literal before rasterising. An unresolved
render loses colour entirely.

The script is thoroughly commented; read its docstring before changing it. The one thing
worth knowing up front: librsvg doesn't implement CSS custom properties, so the script
inlines them as literals before rasterising. **Any new custom property you add to the SVG
must survive that substitution**, or it will silently render as default black.
