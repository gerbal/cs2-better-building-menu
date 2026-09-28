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
pre-blackened copy of their own icon, which the backend makes from the player's
install (`SilhouetteIcons`, sent as `silhouetteThumbnail`; `lockedThumbnail`
picks it), giving the same silhouette with no compositing effect, and fall back
to the ordinary thumbnail when no blackened copy exists. The remaining locked
signals — a lighter tile ground, locked label colour, padlock — cost nothing on
either path. The grid's, list's and table's stylesheets carry the rule this
drives.

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
Moving the chirper's toasts out of the pane's way would make this unnecessary; see
[issue #104](https://github.com/gerbal/cs2-better-building-menu/issues/104).

## Hand-rolled floating surfaces in Cohtml

The filter rail's dropdown surface (`filterRail.module.scss`, `.menu`) states size
only, because the vanilla `Dropdown` owns its own positioning and painting. A
hand-rolled popover in this engine needs two workarounds that the vanilla control
already carries:

- Anchor by `top` plus a `translateY`, not by `bottom: 100%`. A bottom-anchored
  surface lays out correctly and then refuses to paint its head.
- Put `transform: translateZ(0)` on that head to promote it to its own layer.
  Without it the head's text does not rasterise at all.

Both held on Cohtml 1.64 (game 1.6.0). Cohtml 2.2 (game 1.6.2) lays out flex with a new
algorithm, and the two surfaces the mod builds by hand paint in full, text included, with
neither workaround: `LensControlPane`'s `.pickerOptions`, anchored by a fixed `bottom` offset,
and `ChipRow`'s `.picker`, which hangs from `top: 100%`. A surface anchored by `bottom: 100%`
has not been tried on 2.2, so anchor a new one by `top` all the same.

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
- **A network's cost and upkeep are rounded once, per kilometre.** Vanilla rounds the
  per-cell figure first and multiplies it out after.
  - Upkeep: the card rounds the per-kilometre figure, which is what `NetUtils.GetUpkeepCost`
    charges (¢487/km/mo. where vanilla shows ¢500).
  - Cost: the card adds each auxiliary network's share before rounding. Vanilla rounds a cell's
    own cost before multiplying by 125, and truncates each share on its own, so a cell cost of
    12.4 reads ¢1,550/km on the card and ¢1,500 in vanilla.

  So a network whose per-cell cost or upkeep rounds to nothing still gets a line on the card,
  where vanilla leaves it off.
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
  work in [issue #98](https://github.com/gerbal/cs2-better-building-menu/issues/98).
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

## Labels in the game's words

Where the game already has a word for what a label names, the label reads the game's word, so
it appears in each of the game's languages without a translation of ours: category and
subcategory names (the editor's `Editor.ASSET_CATEGORY_TITLE`, the toolbar's `Services.NAME` and
`SubServices.NAME`), the "All" tab and chip, themes (`Assets.THEME`), the school levels and the
building roles. `GameLocaleKeys` and `CatalogIndex.SchoolTierPrefabs` hold the keys. Our English
is the fallback, and a modded theme, which has no key, keeps its prefab name.

- **A key is used only where it names the same thing, in every language.** Each is read out of
  the game's `Locale.cok` in all twelve of its languages before it is added. So some ids keep
  ours although the game has a word nearby: Park and Lights; Fences, which the game leaves
  English in German; and Foliage, which leaves out the rocks and spawners the Trees category
  holds. Ids with no counterpart keep ours too, among them Networks, Pipes, Power Lines, Transit
  Lines, Seaways, the Misc groups and Rocks & Miscellaneous.
- **Roles take a building's name.** A role reads the name of the plain building it is built
  around, as a school level does, or the toolbar tab it sits under when it has no one typical
  building. No two roles may share a name in any language, or a filter would offer the same word
  twice. The Role filter orders its options by
  id, so outside English they are not alphabetical by what they say.
- **Density tiers keep ours.** The game has no word for a tier alone. Its zone names are whole
  phrases, the zone type, the tier and, for residential and commercial zones, the region, and the
  region sits somewhere different in each language, so cutting it out leaves fragments behind. A tier
  also spans residential, commercial and office zones, which no one zone name does. The tiers are
  to be translated as the mod's own strings instead; see [issue #99](https://github.com/gerbal/cs2-better-building-menu/issues/99).
