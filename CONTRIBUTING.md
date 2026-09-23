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

## Build and test

```sh
./build.sh backend                                       # the C# mod
./build.sh test                                          # xUnit; starts no game process
(cd BetterBuildingMenu/UI && npm test)                   # typecheck, lint, unit and render suites
./build.sh all                                           # C# and the UI bundle
```

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
| Processor | An `IPrefabCategoryProcessor`: decides whether a prefab is indexed, and under which category. |
| Full / partial pass | A rebuild of the whole index, or a re-read of the prefabs that changed. See `docs/indexing.md`. |
| Catalog | The index as the panel sees it. `BuildingCatalogAdapter` projects index entries into `BuildingCatalogEntry` rows, `CatalogView` answers one refresh's questions from them, and `BuildingCatalogQueryEngine` filters, sorts and pages them into a `BuildingCatalogPage`. |
| Lens state | The query the panel is showing (`BuildingCatalogLensState`), held in C#. |
