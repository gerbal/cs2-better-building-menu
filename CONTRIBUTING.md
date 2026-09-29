# Contributing

## Setting up

- **C#.** The .NET 10 SDK and an installed copy of the game. The build reads
  the game's managed assemblies from `$CS2_GAME_PATH/Cities2_Data/Managed`.
  `CS2_GAME_PATH` defaults to the Steam install under
  `~/.local/share/Steam/steamapps/common/Cities Skylines II`
  (`Directory.Build.props`).
- **UI.** Node 22.13 or later, then `npm ci --ignore-scripts` in `BetterBuildingMenu/UI`.
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
repository, so a test that fails locally fails there too. See
[docs/ci.md](docs/ci.md).

### Tests

Some of the mod's state is still process-wide statics: `Mod`'s settings and
silhouette cache. The C# test classes run in parallel, so no test may set
one: give the code under test an object of its own instead, as
`CatalogIndex` and `PlacedUniques` allow.

A test cannot reach Unity's native side, such as a `LogManager` logger or
`Mod`'s static initializer; see [docs/ci.md](docs/ci.md).

### Warnings

Warnings fail the build in CI, in the mod and in the tests
(`Directory.Build.props`); a local build reports them but does not fail on
them. To build as CI does, start clean, because an incremental build does
not repeat warnings for what it does not recompile:

```sh
rm -rf BetterBuildingMenu/obj BetterBuildingMenu/bin BetterBuildingMenu.Tests/obj BetterBuildingMenu.Tests/bin
CI=true ./build.sh backend
CI=true ./build.sh test
```

Most warnings will be nullable:

- A field a system sets in `OnCreate` is declared `= null!`. Elsewhere, write
  a check the compiler can follow (below) rather than add `!`.
- A value that can really be missing is declared nullable, with readers that
  check it.

net48's `string.IsNullOrEmpty` and `IsNullOrWhiteSpace` carry no
annotations, so the compiler cannot see a check made with them. Write the
check as a pattern it can follow instead of adding `!` after it:
- `text is { Length: > 0 }` for `!string.IsNullOrEmpty(text)`;
- `text?.Trim() is { Length: > 0 } trimmed` for
  `!string.IsNullOrWhiteSpace(text)`.

A method that answers that question for its caller, such as
`BuildingCatalogGrouping.IsGrouped`, says so with `[NotNullWhen(true)]`.

### Shared contracts

The ids and numbers both sides use (sort columns, group dimensions, facet ids,
availability options, the Load more step, the asset menu's height range and width)
are C#'s, and the UI reads them from
`UI/src/domain/sharedContracts.generated.ts`. Change the C#, then run
`CS2_WRITE_CONTRACTS=1 ./build.sh test` and commit the file it writes; the C#
tests fail while the two disagree. Never edit the generated file by hand.

## Trying it in game

```sh
./build.sh all
./build.sh package      # artifacts/BetterBuildingMenu
```

Deploy by copying the packaged folder into the game's `Mods/` directory.

A Debug build logs the index audits (see [docs/indexing.md](docs/indexing.md),
"The menu audit"). Releases follow
[docs/release-checklist.md](docs/release-checklist.md).

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

For `.cs`, `.ts`, `.tsx` and `.scss` alike, a comment says why the code is
the way it is, in about three lines. No past tense, no issue ids, no
measurements, no commit hashes, no `file:line` references.

- Longer rationale goes in `docs/indexing.md` or `docs/design-notes.md`, under
  a heading, with a one-line pointer from the code:
  `See docs/indexing.md, "Load timing".` Headings are the anchors, so renaming
  one means updating its pointers.
- Measurements and dated findings go in the pull request that makes them.
  What a later reader needs from them goes in `docs/`, as current fact.
- `docs/` follows the same rule: it says how things are and why, not how
  they came to be. Open questions and things not yet checked in game go in
  a [GitHub issue](https://github.com/gerbal/cs2-better-building-menu/issues).

## Commits

Conventional prefixes, as in the history: `fix:`, `feat:`, `docs:`,
`refactor:`, `perf:`, `chore:`. The subject says what changed for the player
or the reader, in a sentence.

## Glossary

| Term | Meaning |
|---|---|
| Asset menu | Vanilla's name for one of its toolbar menus (Roads, Zones, Police & Administration and so on) and for what opens from it. This mod draws its own in place of vanilla's asset grid (`AssetMenu`, bindings and types named `AssetMenu*`): the build menu, with the strip and the results, beside the control pane. The menu the player opens decides what it lists. |
| Strip | The category tabs across the top of the asset menu (`MenuCategoryStrip`): vanilla's second tier, or tiers and branches where those cut a menu better. |
| Control pane | The column beside the results with the count, Group by, Sort by and view mode (`ControlPane`). |
| Filter rail | The row of filter icons, each opening a dropdown of one facet's options (`FilterRail`). |
| Facet | One filter dimension, such as role, source, availability, content, theme or placement, with its options. Computed in C# (`BuildingCatalogFacet*`). |
| Index | Every indexed prefab as a `PrefabIndex`, filed in the `CatalogIndex` that `PrefabIndexingSystem` publishes as `Index`. |
| Processor | An `IPrefabCategoryProcessor`: decides whether a prefab is indexed, and under which category. A pass runs them in the order `PrefabCategoryProcessors` lists them. |
| Full / partial pass | A rebuild of the whole index, or a re-read of the prefabs that changed. See `docs/indexing.md`. |
| Catalog | The index as the asset menu sees it. `BuildingCatalogAdapter` projects index entries into `BuildingCatalogEntry` rows, `CatalogView` answers one refresh's questions from them, and `BuildingCatalogQueryEngine` filters, sorts and pages them into a `BuildingCatalogPage`. |
| Asset menu state | The query the asset menu is showing (`AssetMenuState`), held in C#. |
