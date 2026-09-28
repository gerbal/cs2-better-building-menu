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

Then replace the whole body of `<ChangeLog>` in `PublishConfiguration.xml` with that
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
  render suites. It also holds the five version sources together, so it fails
  on a half-done bump.
- `package` writes `artifacts/BetterBuildingMenu/` and refuses a package that
  still carries a Find It identity. Give it the same `CS2_BUILD_CONFIG` as the
  build, or it copies whatever Debug DLL is on disk.

## Deploy

Copy `artifacts/BetterBuildingMenu/` into the game's `Mods/` directory, or let
`build.sh` do it into an empty, isolated one; it refuses to overwrite a target:

```sh
CSII_SUCCESSOR_MODS_DIR=/path/to/empty/isolated/Mods ./build.sh deploy
```

Never leave a `.disabled` copy containing a UI bundle in `Mods/`: the asset
scanner registers it as a duplicate module.

Check that the deployed DLL is the one you built before trusting a run. A stale
Debug DLL copied over a Release build logs as healthily as the right one.
Metadata strings are UTF-16, so `-el` is required:

```sh
strings -el "<Mods>/BetterBuildingMenu/BetterBuildingMenu.dll" | grep '<a literal from the change>'
```

## Live check

On a developed save:

1. **Logs.** A release build logs two Info lines a load: `OnLoad`, and one
   `Full prefab indexing: … prefabs (… locked) in …s`. The mod's log shows no
   exceptions, and `UI.log` shows no JS errors.
2. **Audit.** A release build does not compute the audit, so run this step on
   a Debug build of the same commit. In the mod's log, `[MENU-COVERAGE]`
   reports `0 missing from the index`, and the `[MENU-AUDIT]` census line does
   not end in `NOT CLEAN`. With ExtraLib installed, its nested child
   categories are the expected exception (see
   [compatibility.md](compatibility.md)).
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
