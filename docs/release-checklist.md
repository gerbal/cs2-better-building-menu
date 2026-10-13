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
   - every menu opens at the same width, the stored Width step.
4. **Views.** Open Sort, Filter, Group and View in turn and pick from each: one list at a
   time, and a click elsewhere closes it. Switch through Cards, List, Grid and Table in View,
   pick a Width there, drag the top edge, and drag the right edge: it settles on a width. At
   the wider Widths, the tool options sit left of the menu with none of their buttons under it.
5. **Place.** Arm an asset from a tile and place it. Escape closes the asset menu. Arm a
   terraforming brush from Landscaping: the menu stays, and answers a search.
6. **Options.** Flip each option under Options › Better Building Menu with a
   menu open, and see it take effect. With Control pane on, the pane shows the
   same Sort, Filter, Group and View, and View › More options… opens this page.
   With Replace the vanilla build menu off, every other row is greyed out and
   says why. Reset the build menu… asks first, then puts the options, the
   width, the height and the view back.
7. **An upgrader.** Start from a settings file 0.2.4 wrote, with the pane shown in
   it: the pane stays shown, and the menu opens at the Width step nearest the
   width it had.
8. **Upgrades.** On a release that touches them, open the upgrades picker from
   a placed service building.
9. **Controller.** On a release that touches the hand-off, with a gamepad:
   the game's own build menu shows, and moving the mouse brings this one
   back on the same menu.
10. **Interface style.** On a release that touches the menu's colours: with the game's
    legacy interface on, switch Interface style to Bright blue and to Dark grey-orange,
    and move Interface transparency to 0% and 100%. No dark text on a dark panel, no
    light text on a light one, and the lit tab keeps the game's blue.
