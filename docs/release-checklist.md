# Release checklist

What to run before a release, and the live check that goes with it. The
maintainer uploads the package to Paradox Mods with the game's own
`ModPublisher`, which reads `BetterBuildingMenu/Properties/PublishConfiguration.xml`.

## Version

The version is stated in five places, and all five change together:

- `<Version>` in `BetterBuildingMenu/BetterBuildingMenu.csproj`;
- `modinfo.json`;
- `BetterBuildingMenu/UI/mod.json`;
- `ModVersion` in `BetterBuildingMenu/Properties/PublishConfiguration.xml`;
- a new first entry in `BetterBuildingMenu/Changelog.json`.

Then REPLACE the body of `<ChangeLog>` in `PublishConfiguration.xml` with that
entry's text. The element holds one version's notes, not a running history:
the store shows it under the version, so an older section left in it is
published as part of the new version's notes. `npm test` in
`BetterBuildingMenu/UI` fails until all five agree and the `<ChangeLog>` opens
with the new number. If the game's minor version has moved, update
`GameVersion` too.

## Build and test

From the repository root:

```sh
./build.sh backend                       # C# mod, Debug
./build.sh test                          # xUnit on net10; starts no game process
(cd BetterBuildingMenu/UI && npm ci --ignore-scripts && npm test)
CS2_BUILD_CONFIG=Release ./build.sh all
CS2_BUILD_CONFIG=Release ./build.sh package
```

- The UI step typechecks the source and tests, lints, then runs the unit and
  render suites.
- `package` writes `artifacts/BetterBuildingMenu/`. Give it the same
  `CS2_BUILD_CONFIG` as the build, or it copies whatever Debug DLL is on disk.

## Deploy

Copy `artifacts/BetterBuildingMenu/` into the game's `Mods/` directory.

## Live check

On a developed save:

1. **Logs.** The mod's log (`BetterBuildingMenu.log`, in the game's `Logs`
   folder) shows one `Full prefab indexing: … prefabs (… locked) in …s` line
   for the load and no exceptions. `UI.log` shows no JS errors.
2. **Audit.** The audit is logged at Debug, which a Debug build turns on. For
   a release build, launch the game with `-logsEffectiveness=Debug`, or in
   developer mode set the `BetterBuildingMenu` logger to Debug in the debug
   panel's Logs tab and load the save again. Then `[MENU-COVERAGE]` reports
   `0 missing from the index`, and the `[MENU-AUDIT]` census line does not end
   in `NOT CLEAN`.
3. **Menus.** Open Roads, Zones, Landscaping and a service menu. For each:
   - the asset menu replaces the grid where the game's own menu sits, with the search, Sort,
     Filter, Group, View and close along its top edge and its tabs along its bottom edge, each with its
     count, on one line (at large text the range stays and the last tabs clip), and the menu
     208 tall at its Width step;
   - tiles draw their icons, with no placeholders;
   - a search finds an asset, and Enter arms the best match;
   - a long menu offers Load more, and a list past 2,000 rows says how to narrow it;
   - pick a building, open another menu, then this one again: it opens on that building's tab
     with the building at the top of the list; pick a sort, and the list goes back to its top;
   - click the search box and type: Down changes the name after ↵ and Enter places that one; Esc
     clears the search, and a second Esc closes the menu; after Enter the arrow keys move the camera;
   - at a wider Width a menu with a few tabs names each one, and the mark under the menu sits under
     its toolbar button;
   - Roads and a service menu draw the list, 20 plates in the game's own size, each with its picture,
     name and cost; Zones draws the tiles, 20 pictures, with no cost, as zones have none; a wider
     Width adds columns;
   - type in Roads: the list ranks every tab's matches as one, the best first, and Sort reads Match;
     clear it: the tab and the sort come back;
   - a locked building says MS n while the city has not reached it, else Locked; a unique and an
     already-built building keep their marks; at a small Tile size a long cost shows as k or M, and
     under a sort by a number the tile's tag shows that number;
   - Roads' All names each tab on a plate with its count; Roads › Parking, mostly locked, lists what
     can be built first, then Locked and its count: a click folds the locked ones away, another
     brings them back;
   - Garbage shows its buildings bigger, two lines of them, and opens on All;
   - at Width 3, type in Roads: the fifth result sits under the first, not along the row;
   - Education's list shows each school's cost over its capacity by a person symbol, and the right end
     of the tabs names Capacity by the same symbol, or states the shared capacity (Elementary school);
     Roads › Medium Roads at the widest Width says
     100 km/h unless shown there, and only the roads at another speed show theirs; a road's cost reads
     per cell (¢44/c);
   - a name too long for its plate is cut once, with …, keeping the words that tell it apart, and never
     runs into its cost; at 130% text no plate shows part of a third name line, and each picture is
     whole; Zones' tiles that look alike carry a tag saying what tells them apart;
   - Landscaping and Signature Buildings open as icons, 45 in the game's own size, more columns at a
     wider Width; Landscaping › Nature's Boulder 01 to 08 carry their numbers on pills and share a
     shade; a locked icon is dark (bare under the game's interface styles), its lock over MS n at
     100% text; at larger text a word wider than the icon is left off, the lock alone;
   - point at a building in Roads and in Landscaping's icons: after a moment a small card, usually
     above the menu at the building's left edge, names it, with its cost, upkeep and key number in
     Roads and its name and picture in the icons, clear of the chirper at the widest Width, and it
     goes when the pointer leaves, a list opens, or a wheel scrolls the building from under a resting
     pointer;
     Options › Hover card › The game's detail slot draws the wide card above the menu, where the
     game's own detail shows, and Status line only draws no card: it names the building and its
     figures at the tabs' right end;
   - in View › Look pick Plates: the menu redraws at once and the list stays open; Roads' plates say
     their speed with its unit (80 km/h) and no symbol, and in Roads › Medium Roads at the widest
     Width the tabs' right end says "100 km/h unless shown", with no symbol; Zones' look-alike tiles
     carry their names, whole or cut, on a band across the top, or their tag where no cut fits; in
     Signature Buildings pick Tiles and read a look-alike unique or built tile: its band spans the tile
     and covers the top of the game's mark, where Standard's tag, only as wide as its text, does not
     (take a screenshot); Options › Look reads Plates; pick Standard again, and put Signature
     Buildings back on Icons with View › Default view;
   - every menu opens at the same width, the stored Width step.
4. **Views.** Open Sort, Filter, Group and View in turn and pick from each: one list at a
   time, and a click elsewhere closes it. Pick List, Icons, Tiles and Cards in View: the menu keeps
   its pick, with a dot, and another menu keeps its own; Default view takes it away. Pick a
   Group: the next open of that menu keeps it, another menu does not. Pick Cards in Roads at
   Width 3: cards as wide as their names, three rows, 11 or more, the tabs' labels among them;
   pick a building, then open Roads again: it opens on All, at that card. Pick List and a Width in View,
   and drag the right edge and the left edge: each settles on a width, the tabs' right end naming
   the step and how many buildings it shows while the edge moves; the left strip lights under the
   mouse, stops above the tabs, and widens the menu as far as the pointer travels. At the wider Widths, the tool
   options sit left of the menu with none of their buttons under it. With Options › Top edge on
   Whole lines, drag the top edge up in Roads: the tabs' right end counts the lines and buildings
   ("7 lines · 28 buildings (game: 18)"), and the release settles on whole lines. Drag it below the
   fewest lines: the tabs' right end says "Release to collapse", and the release collapses the menu to
   its search and tabs; close and reopen the menu: still collapsed; a tab (All too) or typing a
   letter opens it at the height it had, and a drag back up opens it where it lands. Collapse it
   again and double-click the edge: it opens at the game's own size, the first Width. A single
   click on the edge changes nothing. Set Top edge to Free: a drag lands where the pointer lets
   go, a drag below the fewest lines holds the least height and never collapses, and a double-click still
   restores the game's size.
5. **Place.** Arm an asset from a tile and place it. Escape closes the asset menu. Arm a
   terraforming brush from Landscaping: the menu stays, and answers a search.
6. **Options.** Flip each option under Options › Better Building Menu with a
   menu open, and see it take effect. With Control pane on, the pane shows the
   same Sort, Filter, Group and View, and View › More options… opens this page.
   With Replace the vanilla build menu off, every other row is greyed out and
   says why. Reset the build menu… asks first, then puts the options, the
   width, the height and each menu's View and Group back, and opens a collapsed
   menu; a menu open and grouped by Cost goes back to its own grouping at once.
7. **An upgrader.** Start from a settings file 0.2.4 wrote, with the pane shown in
   it: the pane stays shown, the menu opens at the Width step nearest the
   width it had, in Cards, on All, and Top edge reads Free.
8. **Upgrades.** On a release that touches them, open the upgrades picker from
   a placed service building: its frame and rows draw in the Look, Standard and Plates alike, and a
   row's tooltip card reads light on the game's dark tooltip. Its top strip drags its height as
   before: never collapsing it, never settling on lines, a double-click doing nothing.
9. **Controller.** On a release that touches the hand-off, with a gamepad:
   the game's own build menu shows, and moving the mouse brings this one
   back on the same menu.
10. **Interface style.** On a release that touches the menu's colours: with the game's
    legacy interface on, switch Interface style to Bright blue and to Dark grey-orange,
    and move Interface transparency to 0% and 100%, in Standard and in Plates. No dark text on a dark
    panel, no light text on a light one, and the lit tab keeps the game's blue.
