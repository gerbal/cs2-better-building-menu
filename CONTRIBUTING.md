# Contributing

## Setting up

- **C#.** The .NET 10 SDK and an installed copy of the game. The build reads
  the game's managed assemblies from `$CS2_GAME_PATH/Cities2_Data/Managed`.
  `CS2_GAME_PATH` defaults to the Steam install under
  `~/.local/share/Steam/steamapps/common/Cities Skylines II`
  (`Directory.Build.props`).
- **UI.** Node 22.13 or later, then `npm ci --ignore-scripts` in `BetterBuildingMenu/UI`.
  Run it again after pulling a change to `package-lock.json`: an older
  install lacks the TypeScript and eslint that `npm test` runs.
  The UI's tests stub the game's `cs2/*` modules, so they run without the game.
- **The game's source.** The private repository `gerbal/cs2-game-decompiled`
  holds the decompiled C# of the game's modding-relevant assemblies, for the
  version the mod builds against. Read it before relying on how a game system
  behaves, especially without an install. It is the game's code: never copy
  from it into this repository, an issue, a pull request or a CI log.

## Build and test

```sh
./build.sh backend                                       # the C# mod
./build.sh test                                          # xUnit; starts no game process
(cd BetterBuildingMenu/UI && npm test)                   # typecheck, lint, unit and render suites
./build.sh all                                           # C# and the UI bundle
```

Much of the mod's state is process-wide statics: the index, the placed
uniques, and more on `PrefabIndexingSystem` and `Mod`.
A test that sets one puts it back whether it passes or fails, in a `finally`
or in the test class's `Dispose`. The C# tests also run one class at a time
(`TestParallelization.cs`). Nothing needs that yet, since no class reads
what another sets, but it keeps that from becoming a race.

Warnings fail the build in CI, in the mod and in the tests: the
compiler's, the analyzers', MSBuild's and NuGet's (`Directory.Build.props`).
Both build without one. NuGet's vulnerability audit is the exception and
stays a warning, since a feed outage or a new advisory is no fault of the
change being built. A local build reports warnings but does not fail on
them. To build as CI does, start clean, because an incremental build does
not repeat warnings for what it does not recompile:

```sh
rm -rf BetterBuildingMenu/obj BetterBuildingMenu/bin BetterBuildingMenu.Tests/obj BetterBuildingMenu.Tests/bin
CI=true ./build.sh backend
CI=true ./build.sh test
```

Most warnings will be nullable: a field a system sets in `OnCreate` is
declared `= null!`, and a value that can really be missing is declared
nullable, with readers that check it.

net48's `string.IsNullOrEmpty` and `IsNullOrWhiteSpace` carry no
annotations, so the compiler cannot see a check made with them. Write the
check as a pattern it can follow instead of adding `!` after it:
- `text is { Length: > 0 }` for `!string.IsNullOrEmpty(text)`;
- `text?.Trim() is { Length: > 0 } trimmed` for
  `!string.IsNullOrWhiteSpace(text)`.

A method that answers that question for its caller, such as
`BuildingCatalogGrouping.IsGrouped`, says so with `[NotNullWhen(true)]`.
The mod has no `!` left apart from `= null!` on those `OnCreate` fields.
Where a LINQ filter in one step cannot tell the compiler about the next,
a loop that keeps only the non-null values can.

CI runs every test against the game's own assemblies, kept in a private
repository, so a test that fails locally fails there too. A test that
calls into the game, not just its types, still carries
`[Trait("Requires", "Game")]`, for a run against mock assemblies
(the workspace's `tools/game-refs/refresh.sh --mock`), which filters them out with
`CS2_TEST_FILTER=Requires!=Game`. See [docs/ci.md](docs/ci.md).

The ids and numbers both sides use (sort columns, group dimensions, facet ids,
availability options, the Load more step, the panel's height range and width)
are C#'s, and the UI reads them from
`UI/src/domain/sharedContracts.generated.ts`. Change the C#, then run
`CS2_WRITE_CONTRACTS=1 ./build.sh test` and commit the file it writes; the C#
tests fail while the two disagree. Never edit the generated file by hand.

Releases follow [docs/release-checklist.md](docs/release-checklist.md), then
[docs/publishing.md](docs/publishing.md).

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

## Comments

The rule that the 2026-09-10 comment pass applied, for `.cs`, `.ts`, `.tsx`
and `.scss` alike: a comment says why the code is the way it is, in about
three lines. No past tense, no issue ids, no measurements, no commit hashes,
no `file:line` references.

- Longer rationale goes in `docs/indexing.md` or `docs/design-notes.md`, under
  a heading, with a one-line pointer from the code:
  `See docs/indexing.md, "Load timing".` Headings are the anchors, so renaming
  one means updating its pointers.
- Measurements and dated findings go in `docs/verification.md`.

## Commits

Conventional prefixes, as in the history: `fix:`, `feat:`, `docs:`,
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
| Index | Every indexed prefab as a `PrefabIndex`, built by `PrefabIndexingSystem` into `BuildingMenuUtil.CategorizedPrefabs`. |
| Processor | An `IPrefabCategoryProcessor`: decides whether a prefab is indexed, and under which category. A pass runs them in the order `PrefabCategoryProcessors` lists them. |
| Full / partial pass | A rebuild of the whole index, or a re-read of the prefabs that changed. See `docs/indexing.md`. |
| Catalog | The index as the panel sees it. `BuildingCatalogAdapter` projects index entries into `BuildingCatalogEntry` rows, `CatalogView` answers one refresh's questions from them, and `BuildingCatalogQueryEngine` filters, sorts and pages them into a `BuildingCatalogPage`. |
| Lens state | The query the panel is showing (`BuildingCatalogLensState`), held in C#. |
