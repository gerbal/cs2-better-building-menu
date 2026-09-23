# Release checklist

What to run before a release, and the live check that goes with it. The upload
itself is in [publishing.md](publishing.md). Each release's results go in
[verification.md](verification.md) as a dated entry.

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

1. **Logs.** The mod's log shows one `Full pass at OnGameLoaded` for the load
   and no exceptions. `UI.log` shows no JS errors.
2. **Audit.** In the mod's log, `[MENU-COVERAGE]` reports
   `0 missing from the index` and the `[MENU-AUDIT]` census line does not end
   in `NOT CLEAN`. With ExtraLib installed, its nested child categories are
   the expected exception (see [compatibility.md](compatibility.md)).
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
