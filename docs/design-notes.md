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

## The Width steps

The build menu draws at one of five widths, the same rectangle in every menu. The setting holds
the step's number, 1 to 5, never a width, because the widths follow the screen: a screen is
1,080 rem tall at any aspect, so 16:9 is 1,920 rem wide, 21:9 about 2,520 and 32:9 about 3,840.

- **The room** runs from the tool options' right edge at the game's own text size (x 396) to 1 rem
  short of the social column, which starts 48 rem from the screen's right edge. On 16:9 it is
  1,475 wide.
- **A step's width** is 706, the game's own build menu's, plus its share of the room beyond 706,
  rounded to the whole rem. The shares are the 16:9 steps' exact ones, 0, 187, 385, 574 and 769
  over 769, so 16:9 gives 706, 893, 1,091, 1,280 and 1,475; 21:9 gives 706, 1,039, 1,391, 1,728
  and 2,075; 32:9 gives 706, 1,360, 2,052, 2,713 and 3,395. The first step is 706 on every screen,
  and a screen with no room beyond 706 draws 706 at every step.
- **The nearest step** to a width is the one whose width on this screen is closest, a tie going
  to the narrower. The settings migration uses it to turn an earlier release's width into a step.
- **One rule, two copies.** `WidthSteps` in C# holds the numbers and the rule. The UI computes the
  same widths from the generated copy, in `widthSteps.ts`, which a test holds to C#'s own widths
  at 16:9, 21:9 and 32:9, and decides where the box sits for a step.

## The box at its Width step, and the control pane

The build menu draws at its Width step (see "The Width steps"), the same rectangle in every menu,
and shows or hides the control pane with the button beside the X. The step is the hidden setting
`AssetMenuWidthStep` and the pane `ControlPaneShown`, each pushed to its binding. The UI turns the
step into a width on this screen, in `widthSteps.ts`.

**Where the box sits.** The row, the box and while shown the pane beside it, starts at the tool
options column's right edge, where vanilla's layout is left-aligned for it (see "Patching
vanilla's layout for the asset menu"): x 396 at the game's own text size. That column is 380 wide
and grows by half the text scale's increase, so the row starts at 415 at 110% and 453 at 130%.

**Where a step stops.**
- Steps 1 to 3 stop 6 rem short of the chirper, which starts 414 rem from the screen's right edge
  (x 1,506 on 16:9): the box's limit is 420 from the edge, x 1,500 on 16:9. Steps 4 and 5 run on
  over it, by the player's choice, to the room's right edge, 1 rem short of the social column.
- A step wider than its room narrows to it, never below 706. So at larger text step 3 narrows
  rather than reach the chirper (1,085 at 110%, 1,047 at 130%), and step 5 ends at the room's edge.
- Beside the pane, which is 379 wide with a 6 rem gap and may run to the social column's edge,
  steps 1 to 3 narrow to the room left beside it, and a step 4 or 5 that does not fit draws as the
  widest step that does. The stored step is kept and comes back when the pane hides. On 16:9 at
  the game's own text size, steps 4 and 5 draw as step 3, which is 0.2.4's own row: the box to
  1,487 and the pane to 1,872.

**The right edge snaps.** A drag shows the box following the pointer, between the narrowest and
the widest step the edge can snap to; beside the pane those are only the steps that fit. The
release snaps to the nearest step, a tie to the narrower, and sends one `SetAssetMenuWidthStep`,
which C# keeps and saves only when it changes. The box keeps the snapped width until the stored
step comes back from C#, so it does not flash the old width for the round trip. The drag is the
hook's own state, so the catalog's table, which budgets its columns from the stored step, moves
its columns at the release.

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
with the pane hidden, so nothing reaches past the room's edge.

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

**The row is no wider than what it holds.** A row left wider than the box and the pane
would leave an empty stretch beside a narrow menu. In 0.1.x such a stretch, above the
Upgrades picker, took every click meant for the city.

**The table's arithmetic still counts the pane.** The column widths, the density tier
and the name budget were tuned against the whole row with the pane in it, so they are
handed the build menu plus the pane (`catalogLayoutWidth`) whether or not the pane is
shown. At step 3 that is the number they always had.

**A narrow table drops columns.** Table view draws at the step's width and shows as many
metric columns as fit beside the name at their comfortable widths, grown by the game's
text scale (`visibleTableMetrics`). Parking, Level, Lot, Workers and Capacity go first;
the column the table is sorted by always stays. Below the comfortable set, a road's
per-km cost ("¢3,500 /km") clips in every row, even at the columns' minima. At step 3
all seven fit; at 125 % text step 3 narrows to 1,043.5 beside the pane and three fit; at
the first step, cost and upkeep.

**Cursors and the hint.** The game draws its own cursors, so the strip uses
`cursor://horizontal-can-resize` and `cursor://horizontal-resize`, from the game's own
stylesheet, as the height strip uses the vertical pair. A press becomes a drag only once
the pointer has moved three pixels, so the wobble inside a click moves nothing. Only the
left button drags, as in the game's own drags, and a move that reports no button held
ends the drag where it was, for a release the blocker never saw. The strip's hint is the
game's Tooltip, since the game draws no `title` attribute; it says the edge snaps.

**A drag cut short is saved.** If the asset menu closes mid-drag, by a key or by the
game, both the width and the height drag end as a release does, so the step or the
height the player dragged to is kept.

## The release marker and the settings version

A release leaves two signs that it ran, so a later release can tell a player who upgraded from
one who installed it fresh.

- **`SettingsVersion`**, a hidden setting: the settings file's format version, 0 in a file no
  release has stepped. 0.2.5 writes 1; the settings migration stores 2 once it has run, and keeps
  a higher value, a later release's (see "The settings migration"). Its initializer stays 0 and
  `SetDefaults` never touches it: the game writes a key only once it differs from the default
  object's, and from then on rewrites it at every save.
- **`release.json`**, in ModsData: `version` (the format, 1), `first` (the release that first
  wrote it), `last` (the release that loaded last) and `stampBefore` (whether the silhouettes
  stamp existed before the first release that wrote the file ran). `first` and `stampBefore` are
  kept once written, since every later load finds a stamp its own cache wrote; `last` moves at
  every load. A release is the assembly version in three parts, which a later release compares.
  A marker in a later format is left as it is, and one that cannot be read is replaced.

**The order in `OnLoad`.** What ModsData holds is read first (`ReleaseMarkerFile.ReadPrior`, see
"Who is an upgrader"), then the marker is written, both before the silhouette cache writes its
stamp as it is built. The settings migration runs after the settings load and before the systems
are created, so nothing is subscribed to the apply.

**Nothing here stops a load.** A failure is one warning. `FolderUtil` is first touched inside
`ReadPriorInstall`'s guard, since its static constructor creates the folder and can fail. The
file is written through `release.json.tmp`, then `File.Replace`, or `File.Move` when there is no
file yet: the mod runs on net48, where `File.Move` cannot overwrite.

## Who is an upgrader

A player who ran a release before the Width steps, 0.1.0 to 0.2.5, keeps the width they had; a
new player gets the game's own. `UpgraderTest.Decide` tells them apart from the signs earlier
releases left. It answers only while the stored settings version is below 2, before this release
has saved anything. The first sign that answers decides, and the answer names it:

1. **`SettingsVersion` 1,** which 0.2.5 writes.
2. **A `release.json` whose `first` is a release before 0.3.0,** the first with the Width steps. A
   marker this release or a later one wrote is no sign: a first launch whose settings save never
   landed leaves one. A `first` that is not one to three whole numbers answers nothing.
3. **A key an earlier release wrote,** among the key names the settings file holds: the six 0.2.4
   declares (`AssetMenuHeight`, `AssetMenuCatalogWidth`, `ControlPaneShown`,
   `ReplaceVanillaBuildMenu`, `AutoWidenSearch`, `AssetMenuTileSize`), 0.1.0-0.2.2's
   `BuildingLensPanelHeight` and `BuildingLensTileSize`, 0.1.0-0.1.3's `ShowCoverageOverlay`,
   `SelectPrefabOnOpen` and `HideRandomAssets`, and 0.2.5's `AssetMenuViewMode`. Development
   builds before 0.1.0 also wrote `ApplyMimic` and `DefaultAlignmentStyle`, which no release
   declared, so those are no sign.
4. **The silhouettes stamp as it stood before any release with the Width steps ran:** the marker's
   `stampBefore` when there is a marker, else whether the stamp existed when `OnLoad` began. Every
   release since 0.1.0 writes the stamp at load, so it finds a 0.2.4 player whose file holds no key.

Otherwise the player is new.

**Read before anything writes.** `ReleaseMarkerFile.ReadPrior` reads the marker and the stamp
first in `OnLoad`, before the marker is written and before the silhouette cache writes its stamp.
A marker that is corrupt or in a newer format reads as none. The key names come from the parsed
settings file (`SettingsFileKeys`): the fragments the game keeps on its setting asset, else the
file's own text, whose first line names the setting.

**What it cannot tell.** A 0.2.4 player whose file holds no key and whose ModsData folder is gone
reads as new; anyone who once ran 0.1 or later reads as an upgrader, however long ago.

## The settings migration

The game rewrites every key already in the settings file at its current value, so a changed
default never reaches a player whose file holds the key. `SettingsMigration.Migrate` moves a file
an earlier release wrote, once. At load, after the settings load and before the systems are
created, every step newer than the stored `SettingsVersion` runs, the version is stored, and the
settings are saved once, only if a value moved. It works on `ISettingsValues`, which the settings
class implements, so its tests never build the settings class. A second load finds the version
current and changes nothing; a version above this release's, a later release's, is left alone.
On every load of a file at this version or earlier, a stored Width step outside 1 to 5 becomes
1 and is saved; a later release's file is not touched.

**Version 2, the Width steps.**
- The hidden `Upgrader` is set for an upgrader (see "Who is an upgrader").
- A height within 0.1 of an earlier release's default, 420 (0.2.3 to 0.2.5) or 155 (an unreleased
  build's), becomes 149: the catalog height that makes the menu, under its 14 rem top strip and
  45 rem header, as tall as the game's own, 208. Any other height is the player's and is kept.
- An upgrader's width becomes the Width step nearest the one they had, on this screen. The legacy
  `AssetMenuCatalogWidth` of 0, 0.2.4's default, drew the room beside the pane, 1,091 on any
  screen: the third step on 16:9, the second on 21:9 and 32:9. A dragged width gives the step
  nearest it, 735 the first. Everyone else gets the first step.

**It cannot tell a choice from an old default.** A player who chose 420, 155 or 735 by hand moves
with the defaults, once.

**Legacy keys stay declared.** `AssetMenuCatalogWidth` stays a property, which only the migration
reads, so the game keeps its key in the file: it drops a key no property reads at its next save.
`SetDefaults` touches neither it nor `SettingsVersion`.

**An unreadable file.** A read of the key names that throws gives no keys and the migration still
runs, so the file is treated as one with no signs.

**What it logs.** One Debug line, `[SETTINGS-MIGRATION]`: the versions, the key names the file
held, the marker and the stamp as they stood, the sign that decided, and each value that moved.

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

## Reset the build menu

Every setting's shipped value lives in `SettingsDefaults`, whose constants the settings class's
initializers read, so the two cannot drift; `SetDefaults` is `SettingsDefaults.Apply`.

- **What a reset puts back.** `Apply` writes every stored setting's shipped value: the height,
  the Width step, the upgrader flag, the control pane, the remembered view, Replace the vanilla
  build menu, Searching widens automatically and Tile size. It leaves `SettingsVersion`, which
  records the migration, and the legacy `AssetMenuCatalogWidth`, which only the migration reads.
- **Then the version.** `SettingsDefaults.Reset` stores this release's settings version after the
  shipped values, keeping a later release's, so the next load migrates nothing: an upgrader put
  back to a new player's values stays put back, even in a file whose migration never ran.
- **What it leaves.** It touches no file but the settings: `history.json` and `release.json`
  stay as they are.
- **Pure.** Both work on `ISettingsValues`, which holds every setting the class stores; a test
  holds the two lists equal, so a setting a reset would miss fails the tests.
- **The control pane.** `ControlPaneShown` ships on and Reset puts it back on; increment 7
  will split the two (initializer on, Reset off) and name the exception in the defaults shape test.

**The button.** Options › Better Building Menu › UI / UX ends with Reset the build menu…, which the
game draws as a button that asks first (`[SettingsUIButton]`, `[SettingsUIConfirmation]`, the
question under its `Options.WARNING` key). Its property has a setter and no getter: the game's
settings diff skips what it cannot read, so the button is never saved. The setter resets, then
saves once.

**Rows that wait for Replace.** While Replace the vanilla build menu is off, every other row is
greyed out (`[SettingsUIDisableByCondition]` on Replace, inverted) and its description reads
"Off while Replace the vanilla build menu is off." The game asks a description getter with no
arguments and redraws it every frame, so each such row has its own one-line getter, through
`OptionRows.DescriptionId`.

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
- **Reading.** A file that is not JSON, has no numeric `version`, or has a version below 1, is
  kept as `history.json.bad` and the history starts empty; if it cannot be kept aside either, it
  is left as it is and nothing is counted that session. In a readable file, what is not
  well-formed (a count that is not a positive number, a holder or latest with no count) is
  dropped and the rest kept. A file from a newer release is left as it is and nothing is counted
  that session, so going back to an older release never loses a newer one's data. A file that
  exists but cannot be read is not written over that session. When `history.json` is missing but
  `history.json.tmp` holds a version 1 history, as after a first flush killed before its move,
  that is read instead and written out at the next flush; any other `.tmp` is ignored.

## Counting placements

`PlacementWatchSystem` counts what the player places with the game's own tools into the placement
history, whatever "Replace the vanilla build menu" holds: it watches the tools, not the menu.

- **What counts.** The game's object, net, area and route tools, by exact type: a mod's tool can
  derive from one of them and inherit its id, and is not counted. The object tool counts placing
  and brushing, not moving, upgrading or erasing; the area and route tools count a new district,
  surface or line, not an edit. The prefab must be indexed and in a game menu. The bulldozer and
  the zone, terrain and upgrade tools never count, so Zones has no history. The editors use the
  same tools, so only a city counts.
- **When.** The game runs `ApplyTool` only on frames a tool applies, and the system counts there.
  It also runs at `PreTool`, every frame, to read what is armed before the tool updates: a tool can
  hand over to another in the update that applies, as a move does to the default tool.
- **One placement per burst.** A building, a district or a transit line is one apply. A brush
  stroke counts once, from the press to the release: the brush applies only on held frames where
  the object fits and the pointer is over the ground, so the stroke is read from the tool's held
  state, not from unbroken applies. A road applies once per segment and counts once while the net
  tool keeps drawing from the last point placed; a right-click that ends the road, or another
  prefab, starts a new one. An apply the game repeats on the next frame, as the net and area tools
  do after a focus change, counts once. A road upgrade counts once per drag, a removal included,
  which the tool's public state cannot tell apart.
- **The fallback.** If a game update changes which frames apply, `PlacementWatchSystem.Rule`
  is set to `PerArm`: a prefab counts once, and counts again after the player arms another tool
  or prefab, or leaves the tool.
- **Never in the way.** A failure warns once a session and the game goes on. The flushes are the
  placement history's: on a close of the build menu, at a load, every two minutes and at quit.

## Search and sort over the whole result

The window the UI draws is a slice of the whole ordered result, so what Enter arms, how a sort
starts and what a list that stops says are decided over the whole result, in C#.

**Enter.** `BuildingCatalogQueryEngine` chooses Enter's target from every match of the search,
before the window is cut, whatever the sort and the grouping: the best relevance, then the
shorter name, then the first in display order. Locked rows and built uniques are skipped, since
Enter on them does nothing. The page names the target as `BestMatch` (its id, name, menu and
place in the order) and as `BestMatchId`; `AllMatchesLocked` says a search matched only rows that
cannot be placed. The UI arms the id through `SetCurrentPrefab` whether or not its row is loaded,
once the page answers the search in the box.

**A sort starts best first.** One C# table, `SortDefaults.BestFirstDescending`, generated as
`SORT_FIRST_DESCENDING`, says which sorts start highest first: workers, capacity, households, and
water and sewage capacity. Every other sort starts lowest first, which for cost and upkeep is the
cheapest. The UI reads the table where a click becomes a column and a direction
(`nextSortState`); a second click on the same sort reverses it. Households, water capacity and
sewage capacity are offered where they can move a row.

**Ties.** A sort by a number breaks its ties by cost, rows with a cost first, then by the game's
own order (`UIOrder`), the name and the id, so equal capacities show the cheaper building first.
The game's order and the name and category sorts keep their own ties.

**A list that stops says so.** The window grows from 100 rows toward a ceiling of 2,000. Whenever
fewer rows are loaded than the result holds, the footer says "Showing X of Y", with the true
total. While the window can grow it offers Load more; once it is at the ceiling with rows past it
(`Capped`), it says how to narrow the list instead: a tab, the search or a filter.

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
  to be translated as the mod's own strings instead; see
  [issue #99](https://github.com/gerbal/cs2-better-building-menu/issues/99).
