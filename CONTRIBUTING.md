# Contributing

## Setting up

- **C#.** The .NET 10 SDK and an installed copy of the game. The build reads
  the game's managed assemblies from `$CS2_GAME_PATH/Cities2_Data/Managed`.
  `CS2_GAME_PATH` defaults to the Steam install under
  `~/.local/share/Steam/steamapps/common/Cities Skylines II`
  (`Directory.Build.props`).
- **UI.** Node 22.13 or later, then `npm ci --ignore-scripts` in `BetterBuildingMenu/UI`.
  Run it again after pulling a change to `package-lock.json`: an older
  install can lack tools that `npm test` runs.
  The UI's tests stub the game's `cs2/*` modules, so they run without the game.
- **The game's source.** Read a decompilation of the game's assemblies (ILSpy
  or similar) before relying on how a game system behaves. It is the game's
  code, as are the assemblies themselves: never copy from either into this
  repository, an issue, a pull request or a CI log. Name the type or member
  instead.

## Build and test

```sh
./build.sh backend                                       # the C# mod
./build.sh test                                          # xUnit; starts no game process
(cd BetterBuildingMenu/UI && npm test)                   # typecheck, lint, unit and render suites
./build.sh all                                           # C# and the UI bundle
```

CI runs the C# tests against the game's own assemblies, kept in a private
repository, so CI and a local run give the same results. See
[docs/ci.md](docs/ci.md).

### Warnings

CI fails on any warning, in the mod and the tests (`Directory.Build.props`).
NuGet's vulnerability audit is the one exception, since a feed outage or a
new advisory is no fault of the change being built. A local build reports
warnings without failing. To build as CI does, start clean, because an
incremental build does not repeat warnings for files it does not recompile:

```sh
rm -rf BetterBuildingMenu/obj BetterBuildingMenu/bin BetterBuildingMenu.Tests/obj BetterBuildingMenu.Tests/bin
CI=true ./build.sh backend
CI=true ./build.sh test
```

Most warnings are about nullability. The conventions:

- A field a system sets in `OnCreate` is declared `= null!`. Use `!` nowhere
  else.
- A value that can really be missing is declared nullable, and its readers
  check it.
- net48's `string.IsNullOrEmpty` and `IsNullOrWhiteSpace` carry no nullable
  annotations, so the compiler cannot see a check made with them. Write
  `text is { Length: > 0 }` or `text?.Trim() is { Length: > 0 } trimmed`
  instead.
- A method that answers "is this non-null?" for its caller, such as
  `BuildingCatalogGrouping.IsGrouped`, says so with `[NotNullWhen(true)]`.

### Tests

- The C# test classes run in parallel, so no test may set process-wide state:
  `Mod`'s settings or the silhouette cache. Give the code under test an
  object of its own instead, as `CatalogIndex` and `PlacedUniques` allow.
- Code that calls into Unity's native side cannot run in a test at all; see
  [docs/ci.md](docs/ci.md). Keep such calls in the systems, and the logic
  they feed in plain classes under `Domain/` that a test can reach.

### Shared contracts

The ids and numbers both sides use (sort columns, group dimensions, filter
ids, availability options, the Load more step, the panel's height range and
width) are defined in C#. The UI reads them from
`UI/src/domain/sharedContracts.generated.ts`. To change one, change the C#,
then run `CS2_WRITE_CONTRACTS=1 ./build.sh test` and commit the file it
writes. The C# tests fail while the two disagree. Never edit the generated
file by hand.

## Trying it in game

```sh
./build.sh all
./build.sh package      # writes artifacts/BetterBuildingMenu/
```

Copy `artifacts/BetterBuildingMenu/` into the game's `Mods/` directory. A
Debug build logs the index audits described in
[docs/indexing.md](docs/indexing.md), "The menu audit".

Never leave a `.disabled` copy containing a UI bundle in `Mods/`: the game's
asset scanner still finds it and registers a second copy of the UI module.

Releases follow [docs/release-checklist.md](docs/release-checklist.md).

## Boundaries

- No Harmony patches, and nothing is written to the save. The mod works
  through the game's own systems, and its UI extends vanilla's modules through
  the module registry.
- `PrefabIndexingSystem` is the single source of prefab discovery. No other
  system builds its own list of prefabs.
- The UI never holds the whole catalog: C# filters, sorts and pages it, and
  sends one page at a time.
- Reflection into the game is a last resort, and must fail safe: a missing
  member costs a feature, never an exception.

## Comments and docs

A comment says why the code is the way it is, in about three lines. That
goes for `.cs`, `.ts`, `.tsx` and `.scss` alike. Comments describe the code
as it is now: history, issue numbers, commit hashes, measurements and
`file:line` references go stale, and belong in the pull request.

- Longer rationale goes in `docs/indexing.md` or `docs/design-notes.md`, under
  a heading, with a one-line pointer from the code:
  `See docs/indexing.md, "Load timing".` Headings are the anchors, so renaming
  one means updating its pointers.
- `docs/` follows the same rule: it says how things are and why, not how
  they came to be. Open questions and things not yet checked in game go in
  [docs/roadmap.md](docs/roadmap.md).

## Commits

Start the subject with a conventional prefix: `fix:`, `feat:`, `docs:`,
`refactor:`, `perf:`, `chore:`. The subject says what changed for the player
or the reader, in a sentence.

## Glossary

| Term | Meaning |
|---|---|
| Menu | One of vanilla's toolbar menus: Roads, Zones, Police & Administration and so on. The menu the player opens decides what the panel lists. |
| Panel | What this mod draws in place of vanilla's asset grid. Code also calls it the lens (`BuildingLens*`, `LensControlPane`) or the surface (`BuildingMenuSurface`). |
| Strip | The category tabs across the top of the panel (`MenuCategoryStrip`): vanilla's second tier, or tiers and branches where those cut a menu better. |
| Control pane | The column beside the results with the count, Group by, Sort by and view mode (`LensControlPane`). |
| Filter rail | The row of filter icons, each opening a dropdown of one facet's options (`FilterRail`). |
| Facet | One filter dimension, such as role, source, availability, content, theme, placement or extensions, with its options. Computed in C# (`BuildingCatalogFacet*`). |
| Index | Every indexed prefab as a `PrefabIndex`, filed in the `CatalogIndex` that `PrefabIndexingSystem` publishes as `Index`. |
| Processor | An `IPrefabCategoryProcessor`: decides whether a prefab is indexed, and under which category. A pass runs them in the order `PrefabCategoryProcessors` lists them. |
| Full / partial pass | A rebuild of the whole index, or a re-read of the prefabs that changed. See `docs/indexing.md`. |
| Catalog | The index as the panel sees it. `BuildingCatalogAdapter` projects index entries into `BuildingCatalogEntry` rows, `CatalogView` answers one refresh's questions from them, and `BuildingCatalogQueryEngine` filters, sorts and pages them into a `BuildingCatalogPage`. |
| Lens state | The query the panel is showing (`BuildingCatalogLensState`), held in C#. |
