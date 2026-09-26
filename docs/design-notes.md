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

## Hand-rolled floating surfaces in Cohtml

Observed on Cohtml 1.64.0.7 (game 1.6.0); not re-checked on 2.2.1.3 (game
1.6.2f1), whose flex layout is a new algorithm, so re-measure before relying on
either workaround there.

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

## The card against vanilla

The card's facts come in two tiers. Those in vanilla's tier follow the binder that draws the
same fact in the game's own tooltip (`PrefabUISystem`), and take the label key that binder
passes, so they read as vanilla's in each of the game's languages, with our English as the
fallback. A fact no binder shows, such as stormwater capacity or transport type, is in our tier
under our label. A test holds every fact in vanilla's tier to its binder's exact key, and every
other fact to ours.

Where the card differs from vanilla on purpose:

- **Upkeep is the budget-free figure.** Vanilla scales it by the service's current budget, which
  is city state rather than a fact about the building, and the base figure is the more useful
  reference. Vanilla's upkeep is also a range whose top prices the burned resources at market;
  the card names each resource and its amount under the upkeep instead.
- **A network's cost and upkeep are rounded once, per kilometre.** Upkeep rounds the
  per-kilometre product, which is what `NetUtils.GetUpkeepCost` charges; vanilla rounds the
  per-cell figure first (¢487/km/mo. against ¢500). Cost adds each auxiliary network's share
  before rounding; vanilla rounds a cell's own cost before multiplying by 125 and truncates each
  share on its own, so a cell cost of 12.4 reads ¢1,550/km on the card and ¢1,500 in vanilla.
  So a network whose cost or upkeep for a cell rounds to nothing still shows a line, where
  vanilla leaves it off.
- **Power output is one figure**, the top of vanilla's range: vanilla shows the plant's own
  output up to that plus every source that can add to it, as 0–400,000 for an incinerator. The
  table's column and sort need one number. A network whose sub-objects hold a power plant,
  without one owning the network, shows no output or voltage; vanilla sums its sub-objects'.
- **A telecom facility's capacity keeps its decimal**; vanilla rounds it up.
- **Nothing is drawn for nothing.** A percentage effect that rounds to zero draws no line, where
  vanilla binds every one but `CriminalMonitorProbability`, zeros included. A transformer with
  no capacity draws no capacity line, where vanilla binds a zero.
- **Effect numbers are invariant**, beside English labels, so a comma-decimal language reads
  "1.5" in an effect line beside "1,5" elsewhere on the card. This waits on the translation
  work in [roadmap.md](roadmap.md).
- **Some labels stay ours.** "Voltage"; "Water pipes", where the game's "Pipes" would sit beside
  a road's own "Carries" line; a zone's upkeep, which its renters pay, where the game's
  `Properties.UPKEEP` names what the city pays to run a building; helicopters and purification,
  each one fact for several of vanilla's lines (`MEDICAL_`, `FIRE_` and
  `POLICE_HELICOPTER_COUNT`; `WATER_` and `SEWAGE_PURIFICATION_RATE`); and the headline
  capacity, which vanilla names per service (`PATIENT_CAPACITY`, `STUDENT_CAPACITY` and so on)
  where the card draws one line with a unit. The table's columns and range filters keep our
  cost and upkeep labels, which are shorter.
- **A network's cost takes the building's key**, `Properties.CONSTRUCTION_COST`. The key its
  binder passes, `Common.ASSET_CONSTRUCTION_COST`, is in no locale, so it would read "Cost" in
  every language.
- **Transport stops are one line per kind**, where vanilla draws one map of them.
- **An upgrade with both a pollution level and a pollution change** shows two lines under the
  same name, as vanilla's does; vanilla tells the change apart with an icon, which the card
  does not draw.
