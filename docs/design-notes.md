# Design notes

Rationale that is too long for a code comment. The code carries one-line pointers to the headings below.

## Escape closes the lens unconditionally

`shouldClearOnEscape` in `domain/vanillaMenuWatch.ts` asks one question: is the
lens open (and is Find It's own panel not up)? It clears the *game's* toolbar
selection rather than hiding our panel, reusing the path the toolbar button
takes — `VanillaMenuWatcher`'s close branch picks up the resulting null, so the
lens has one way to close rather than two. `ClearAssetSelection` nulls menu,
category and asset together, so no vanilla grid appears in the gap.

The absence of a second condition is the point. Vanilla keeps its menu open when
a tool is cancelled, and matching that would mean holding on the press that
disarms the tool and closing on the next. Telling those two presses apart from a
DOM listener is not possible: both available signals — elapsed time since the
tool disarmed, and what the tool last reported as — depend on the game's disarm
notification, which races the keypress. Closing on every Escape is
deterministic, and the divergence is accepted: cancelling a tool with Escape
also puts the menu away. The pause menu still works, because the game opens it
when Escape finds nothing to close, and the lens is gone after the first press.

## Locked artwork for vector thumbnails

Vanilla silhouettes an unplaceable asset by filtering its thumbnail. Cohtml
rasterises an SVG at draw time, and any compositing effect over one forces a
re-rasterise per composite, which the surface does not survive: a `filter` makes
locked vector tiles flicker and sometimes never draw at all, a `mask-image`
flickers, and an `opacity` below 1 makes the icon vanish outright. Raster
thumbnails under the same rules are stable, which is what isolates the cause.

This is not a corner case — networks use vector icons throughout, so a large,
permanent slice of the Transportation catalog is vector-thumbnailed. Any locked
treatment that filters the thumbnail is therefore broken for that slice.

`hasVectorThumbnail` in `domain/buildingLockState.ts` splits the two paths.
Rasters keep vanilla's filter, which works over them. Vector entries swap to a
pre-blackened copy of their own icon supplied by the backend (`lockedThumbnail`),
giving the same silhouette with no compositing effect, and fall back to the
ordinary thumbnail when no blackened copy exists. The remaining locked signals —
dimmed tile ground, locked label colour, padlock — cost nothing on either path.
`buildingGrid.module.scss` carries the rule this drives.

## Patching vanilla's layout for the lens

`useVanillaLayoutForLens` in `mods/BuildingMenu/vanillaLayout.ts` makes two
changes to elements the game owns, applied on mount and undone on unmount. Both
are imperative and scoped to the mount rather than expressed as a stylesheet
rule: a rule would restyle the game for the whole session, including while the
panel is closed and for whatever other mod is looking at the same node. A
missing module or class makes the patch a silent no-op.

**`toolLayout` left-aligned.** Vanilla centres its side + main + side trio in
the screen, which puts the main column too far right for this panel and its
control pane to fit beside the tool-options column. Left-aligned, the main
column starts far enough left that everything fits. Only vanilla's own element
can decide this: a container of ours can neither shift left over the options
column nor fit to the right of it.

**The toolbar sunk to `z-index: -1`.** The chirper hangs off `toolbar` and the
lens hangs off `main-container`. Both are children of `game-main-screen` at
`z-index: auto`, so they paint in tree order and the toast covers the control
pane — no z-index on our own row can change that. Raising `main-container`
instead breaks the game's portalled dropdowns, which rely on tree order to win,
while lowering the toolbar changes exactly the one pair. The toolbar still
renders (the screen paints no background behind it) and stays hit-testable.
This is a stopgap; the real fix is moving the toast lane.

## Hand-rolled floating surfaces in Cohtml 1.64

The filter rail's dropdown surface (`filterRail.module.scss`, `.menu`) states size
only, because the vanilla `Dropdown` owns its own positioning and painting. A
hand-rolled popover in this engine needs two workarounds that the vanilla control
already carries:

- Anchor by `top` plus a `translateY`, not by `bottom: 100%`. A bottom-anchored
  surface lays out correctly and then refuses to paint its head.
- Put `transform: translateZ(0)` on that head to promote it to its own layer.
  Without it the head's text does not rasterise at all.

Both apply to any floating surface built by hand rather than taken from the game's
own controls.
