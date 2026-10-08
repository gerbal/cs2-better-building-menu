# Design notes

Rationale that is too long for a code comment. The code carries one-line pointers to the headings below.

## Escape closes the asset menu unconditionally

`shouldClearOnEscape` in `domain/vanillaMenuWatch.ts` asks one question: is the
asset menu open (and is Find It's own panel not up)? It clears the *game's* toolbar
selection rather than hiding our asset menu, reusing the path the toolbar button
takes — `VanillaMenuWatcher`'s close branch picks up the resulting null, so the
asset menu has one way to close rather than two. `ClearAssetSelection` nulls menu,
category and asset together, so no vanilla grid appears in the gap.

The absence of a second condition is the point. Vanilla keeps its menu open when
a tool is cancelled, and matching that would mean holding on the press that
disarms the tool and closing on the next. Telling those two presses apart from a
DOM listener is not possible: both available signals — elapsed time since the
tool disarmed, and what the tool last reported as — depend on the game's disarm
notification, which races the keypress. Closing on every Escape is
deterministic, and the divergence is accepted: cancelling a tool with Escape
also puts the menu away. The pause menu still works, because the game opens it
when Escape finds nothing to close, and the asset menu is gone after the first press.

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

## Patching vanilla's layout for the asset menu

`useVanillaLayoutForAssetMenu` in `mods/BuildingMenu/vanillaLayout.ts` makes two
changes to elements the game owns, applied on mount and undone on unmount. Both
are imperative and scoped to the mount rather than expressed as a stylesheet
rule: a rule would restyle the game for the whole session, including while the
asset menu is closed and for whatever other mod is looking at the same node. A
missing module or class makes the patch a silent no-op.

**`toolLayout` left-aligned.** Vanilla centres its side + main + side trio in
the screen, which puts the main column too far right for the asset menu and its
control pane to fit beside the tool-options column. Left-aligned, the main
column starts far enough left that everything fits. Only vanilla's own element
can decide this: a container of ours can neither shift left over the options
column nor fit to the right of it.

**The toolbar sunk to `z-index: -1`.** The chirper hangs off `toolbar` and the
asset menu hangs off `main-container`. Both are children of `game-main-screen` at
`z-index: auto`, so they paint in tree order and the toast covers the control
pane — no z-index on our own row can change that. Raising `main-container`
instead breaks the game's portalled dropdowns, which rely on tree order to win,
while lowering the toolbar changes exactly the one pair. The toolbar still
renders (the screen paints no background behind it) and stays hit-testable.
Moving the chirper's toasts out of the pane's way would make this unnecessary; see
[issue #104](https://github.com/gerbal/cs2-better-building-menu/issues/104).

## The asset menu's width and the control pane

The player sets the build menu's width by dragging the strip on its right edge,
and shows or hides the control pane with the button beside the X. Both are saved
like the height: `AssetMenuCatalogWidth` and `ControlPaneShown`, hidden settings,
each pushed to its binding.

**The default width, and filling the room.** The width setting holds a width or
`Default` (0). The default is the room beside the pane, 1,091 at the reference
resolution, whether the pane is shown or hidden: the toggle changes nothing the
pane has room for. A width wider than the room beside the pane, which only a drag
with the pane hidden reaches, draws at that room while the pane is shown and comes
back when the pane goes, so the menu makes room for the pane and never the other
way round. The UI resolves this, in `resolveCatalogWidth`, because it depends on
the pane; C# only keeps the stored value well-formed.

Filling the room in view stores the default with the pane shown, and full
(`ASSET_MENU_CATALOG_FULL`, the widest band there is) with it hidden. A drag
released within 2 of the room fills it, and so does a second press on the strip
soon after the first. With the pane hidden the room is the whole band: the width
strip lies inside the menu, so a filled menu ends where the row with the pane
does, at the social icons. A settings file from before any of this reads as the
default, which draws the layout it always did.

**The width strip lies in the catalog's own margin.** An 8 rem strip down the
catalog's right side over the catalog's right padding, so the catalog keeps its
width and the table's arithmetic is untouched; the compact density's right padding
is 8 rem for it too. It carries the top strip's pill on its side, as long and half
as thick to fit the margin. While the pane is shown, the grab area continues across
the 6 rem gap to the pane, from the header down to the menu's bottom: beside the
header, and above the pane where the pane is the shorter, so that 6 rem column of
city takes no world click. It stops at the top strip; nothing grabs beside or above
that. The catalog's box clips what the strip draws, so that part is its own
element; it lights, hints and measures a press as the strip does, and it is absent
with the pane hidden so nothing reaches past the band's edge.

**The controls follow the game's own UI.** Audited against the game's stylesheet:
- The grab strips draw as the game's one panel resizer does: nothing until the mouse
  is on them, then a white fill (10 %, 15 % while dragging, whether or not the mouse
  is still on them). Their pills are the scrollbar thumb's at rest and brighten in
  white as it does, at once, never in the accent. The top strip keeps the header's
  dark paint, which is the header's own.
- At rest the width pill looks like a scrollbar thumb; the white fill under the
  mouse is what marks it as a handle. The owner chose that over a dark band, which
  the game draws nowhere.
- The pane button and the close × are 24 rem white icons on the round highlight
  theme the game's close buttons use, 10 rem apart. The pane button shows its state
  by its glyph's right column, filled or outlined, as the game's collapsible panels
  swap theirs; an accent-tinted glyph would read as keyboard focus.
- Both count badges are the game's number badge (`_numberBadge.scss`): light bold
  text on the accent with a soft shadow, sized by the text scale. On the pane button
  it sits top left, where the glyph is empty in both states, so it never covers the
  column that shows the pane's state.

**The band follows the text scale.** Vanilla's tool column, which the row starts
beside, is 380 wide at the game's own text size and grows by half the text scale's
increase, while the social icons the band runs up to stay where they are. The band
shrinks by the same amount (`assetMenuBandWidth`): 1,476 at 100 %, 1,381 at 150 %,
where the default menu is 996. With a band that ignored the text scale, the row
ran 47 past the screen's edge at 150 %, and with the pane hidden the menu's X and
its width strip went with it.

**The row is no wider than what it holds.** A row left at the band's width would
leave an empty stretch beside a narrow menu. In 0.1.x such a stretch, above the
Upgrades picker, took every click meant for the city.

**The table's arithmetic still counts the pane.** The column widths, the density
tier and the name budget were tuned against the whole row with the pane in it, so
they are handed the build menu plus the pane (`catalogLayoutWidth`) whether or not
the pane is shown. At the default width that is the number they always had.

**A narrow table drops columns.** Table view draws at the player's width and shows
as many metric columns as fit beside the name at their comfortable widths, grown
by the game's text scale (`visibleTableMetrics`). Parking, Level, Lot, Workers and
Capacity go first; the column the table is sorted by always stays. Measured in game
on Roads: below the comfortable set, a road's per-km cost ("¢3,500 /km") clips in
every row, even at the columns' minima. A first version kept the table at least
1,052 wide instead, but switching to Table at a narrow width then moved the pane,
and the View control just clicked, out from under the cursor. At the default width
all seven still fit; at 125 % text, four do.

**Cursors, the double press and the hint.** The game draws its own cursors, so
the strip uses `cursor://horizontal-can-resize` and `cursor://horizontal-resize`,
from the game's own stylesheet, as the height strip uses the vertical pair. The
double press is counted in the drag hook rather than left to a `dblclick`
listener: the first press puts up the blocker, which covers the screen, so its
release lands there and the strip never sees a whole click. A press becomes a drag
only once the pointer has moved three pixels, so the wobble inside a click neither
saves a width nor spoils the double press. Only the left button drags, as in the
game's own drags, and a move that reports no button held ends the drag where it
was, for a release the blocker never saw. The strip's hint is the game's Tooltip:
the game draws no `title` attribute, and the double press is told nowhere else.

**A drag cut short is saved.** If the asset menu closes mid-drag, by a key or by
the game, both the width and the height drag end as a release does. Left unsaved,
the dragged value sat in the binding until the next save of any setting re-pushed
the saved one, so hiding the pane could change the width.

## The release marker and the settings version

A release leaves two signs that it ran, so a later release can tell a player who upgraded from
one who installed it fresh.

- **`SettingsVersion`**, a hidden setting. A load raises a stored value below 1 to 1 and saves
  once; a higher value is kept, so a later release's version survives a return to this one. Its
  initializer stays 0 and `SetDefaults` never touches it: the game writes a key only once it
  differs from the default object's, and from then on rewrites it at every save.
- **`release.json`**, in ModsData: `version` (the format, 1), `first` (the release that first
  wrote it), `last` (the release that loaded last) and `stampBefore` (whether the silhouettes
  stamp existed before the first release that wrote the file ran). `first` and `stampBefore` are
  kept once written, since every later load finds a stamp its own cache wrote; `last` moves at
  every load. A release is the assembly version in three parts, which a later release compares.
  A marker in a later format is left as it is, and one that cannot be read is replaced.

**The order in `OnLoad`.** The marker is read and written first, because the silhouette cache
writes its stamp as it is built. The version is stepped after the settings load and before the
systems are created, so nothing is subscribed to the apply.

**Nothing here stops a load.** A failure is one warning. `FolderUtil` is first touched inside the
marker's guard, since its static constructor creates the folder and can fail. The file is written
through `release.json.tmp`, then `File.Replace`, or `File.Move` when there is no file yet: the
mod runs on net48, where `File.Move` cannot overwrite.

## The remembered view

The view the player picks in the control pane (Cards, List, Grid or Table) is kept in the hidden
setting `AssetMenuViewMode`, so the next session opens in it. Until the player picks one it holds
`""`, and the menu opens in Cards.

- **This session's pick draws first.** The UI's store keeps it, so a pick redraws at once, with
  no round trip. `chooseViewMode` draws that pick, else the stored view, else Cards, and both the
  catalog and the control pane read it, so they cannot disagree. A stored value the UI does not
  know, from a file edited by hand, draws Cards.
- **A pick saves once.** The click sends `SetAssetMenuViewMode`. C# keeps one of the four kinds,
  or `""` for anything else, and saves only when the stored value changes. The binding is
  read/write, like the sort's, so the stored view reaches the UI on its first frame; nothing is
  sent back from an effect, which would answer C#'s own echo.
- **Reset menu forgets it.** It sends `""`, so the next session opens in Cards; the store holds
  Cards for the rest of this one.

## The placement history

The mod keeps, in `ModsData/BetterBuildingMenu/history.json`, how often the player places each
prefab, per game menu: the counts, the latest placement, and the two most placed, which hold the
menu's slots. It stays on the player's computer; nothing is sent anywhere.

```json
{ "version": 1,
  "menus": { "Roads": { "latest": "<prefab>", "held": ["<prefab>", "<prefab>"],
                        "counts": { "<prefab>": 6.5 } } } }
```

- **Keys.** A menu is the game's UIAssetMenuPrefab name as the index entry holds it
  (`PrefabIndex.UiMenuName`), not the catalog row's, which shows some extra networks under Roads.
  A prefab is its prefab name, so a prefab a mod renames starts again. Every city shares one
  history.
- **Slots.** The first two prefabs placed in a menu hold its slots, most placed first. A newcomer
  takes the weaker slot once its count reaches 1.25 times that holder's (5 against 4), so two close
  favourites do not trade places.
- **Ageing.** Once a launch, as the file is read, every count halves, counts under a half go, and
  each menu keeps its eight most placed; the latest and the holders are never cut, and count
  towards the eight. Recent habits outweigh old ones, and a miscount fades. The halving alone
  does not write the file, so a launch that places nothing leaves it as it was.
- **Writing.** Only when something was placed since the last write: when the build menu closes,
  at a city load or an exit to the main menu, every two minutes, and at quit; never at each
  placement, and never through the settings. Through `history.json.tmp`, then `File.Replace`, or
  `File.Move` when there is no file yet. A crash loses at most two minutes. A write that fails
  warns once a session and is tried again at the next flush.
- **Reading.** A file that is not JSON, or has no numeric `version`, is kept as
  `history.json.bad` and the history starts empty; if it cannot be kept aside either, it is left as
  it is and nothing is counted that session. In a readable file, what is not well-formed
  (a count that is not a positive number, a holder or latest with no count) is dropped and the
  rest kept. A file from a newer release is left as it is and nothing is counted that session,
  so going back to an older release never loses a newer one's data. A file that exists but
  cannot be read is not written over that session.

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
neither workaround: `ControlPane`'s `.pickerOptions`, anchored by a fixed `bottom` offset,
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
