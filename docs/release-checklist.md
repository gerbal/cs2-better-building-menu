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
   - the panel replaces the grid, with the category strip across the top;
   - tiles draw their icons, with no placeholders;
   - a search finds an asset, and Enter arms the best match;
   - a long menu offers Load more.
4. **Views.** Switch through grid, list, cards and table, and drag the
   resize edge.
5. **Place.** Arm an asset from a tile and place it. Escape closes the panel.
6. **Options.** Flip each option under Options › Better Building Menu with a
   menu open, and see it take effect.
7. **Upgrades.** On a release that touches them, open the upgrades picker from
   a placed service building.
