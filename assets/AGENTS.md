# Working on `assets/`

Context for an agent asked to change the illustration. Deliberately not linked from the
README: a reader of this repo needs the commands, not the drawing's internals.

## What's here

| File | Role |
| --- | --- |
| `hero.svg` | **Source of truth.** Hand-written, meant to be edited. |
| `hero.gif` | Derived raster of the same image, for places that can't show an animated SVG. |
| `how-it-works.html` | Standalone five-panel explainer page. Nothing references it - see below. |

Never hand-edit `hero.gif`, and never treat it as authoritative. Edit the SVG, then
regenerate.

## `how-it-works.html` is unreferenced on purpose

Nothing in the repo links to, builds, or reads this file, and that is the expected state rather than an oversight.
It arrived with the `add-team-member` update as the visual narrative for that release: five panels running from the problem (a year of work, three remembered weeks) through capture, filing, patterns, and the payoff.

It cannot be surfaced from the README even if you wanted it there.
GitHub sanitises HTML embedded in Markdown, so the page renders only as a raw download.
Its real homes are a published artifact, GitHub Pages, or the Notion site, none of which this repo builds.

The page is self-contained - inline SVG, inline CSS, no assets, light and dark in one file.
It reuses the token names from `hero.svg` and adds two for the Exemplary / Improve split on the last panel.
Editing it is safe in isolation; there is no pipeline to break.

Do not delete it as dead weight.
`.gitattributes` marks `assets/*` as `linguist-documentation`, which is what stops this file from dominating GitHub's language bar.
That was the whole cost of keeping it.

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

The script is thoroughly commented; read its docstring before changing it. The one thing
worth knowing up front: librsvg doesn't implement CSS custom properties, so the script
inlines them as literals before rasterising. **Any new custom property you add to the SVG
must survive that substitution**, or it will silently render as default black.
