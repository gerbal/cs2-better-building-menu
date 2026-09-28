<img src="BetterBuildingMenu/Properties/Logo.svg" alt="Better Building Menu" width="160" align="left" style="margin-right:16px">

# Better Building Menu

A Cities: Skylines II mod. Click any build menu on the toolbar and, instead of
the row of icons, you get a panel: search, the menu's category tabs, and its
assets as a grid, list, cards or table, with sorting, grouping, filters and
stats on hover. The menu you clicked decides what is in the list.

Published on Paradox Mods as [mod 158589](https://mods.paradoxplaza.com/mods/158589/Windows).
The listing there is the player-facing description; this file is for people
working on the code.

---

## Layout

* `BetterBuildingMenu/` — the C# mod (systems, prefab index, options) and the
  UI under `UI/` (React, built into the mod's `.mjs` bundle).
* `BetterBuildingMenu.Tests/` — the C# tests.
* `BetterBuildingMenu/Properties/` — store listing (`PublishConfiguration.xml`),
  logo, cover and screenshots.

## How it fits together

1. `PrefabIndexingSystem` indexes every prefab once per city load, and again
   for prefabs that change while playing.
2. `BuildingCatalogAdapter` turns that index into catalog rows.
3. On each refresh, `CatalogView` narrows the rows to the open menu, and
   `BuildingCatalogQueryEngine` filters, sorts and pages them. `CatalogView`
   also works out the tabs, filter options and value ranges.
4. `BuildingMenuUISystem` sends the result to the UI as bindings.
5. The React UI, which extends vanilla's `AssetMenu`, draws it and sends the
   player's clicks and keystrokes back as triggers.

The query (search text, filters, sort) lives in C# as
`BuildingCatalogLensState`, so the UI only ever holds one page of results.
The glossary in [CONTRIBUTING.md](CONTRIBUTING.md) explains the terms.

## Build and test

```sh
./build.sh all                              # C# (Debug) and UI
./build.sh test                             # C# tests
(cd BetterBuildingMenu/UI && npm test)      # UI typecheck, lint, unit and render suites
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup and trying a build in game.

## Docs

* [CONTRIBUTING.md](CONTRIBUTING.md): setup, building, the project's rules,
  glossary.
* [docs/roadmap.md](docs/roadmap.md): open work.
* [docs/release-checklist.md](docs/release-checklist.md): what to run before
  a release.
* [docs/ci.md](docs/ci.md): what CI runs, and the private game assemblies the
  C# job builds against.
* [docs/compatibility.md](docs/compatibility.md): how popular mods fare
  beside this one, and why.
* [docs/indexing.md](docs/indexing.md) and
  [docs/design-notes.md](docs/design-notes.md): why the indexer and the UI
  work the way they do. The code links to their headings.
* [docs/vanilla-upgrades.md](docs/vanilla-upgrades.md): how the game handles
  building upgrades, which the extension picker builds on.
* [docs/FORK.md](docs/FORK.md): where the code came from, and its license.

## Compatibility

No Harmony patches, and nothing is written to the save. Find It can be
installed alongside. See [docs/compatibility.md](docs/compatibility.md) for
other mods.

## Credits

Forked from **Find It 1.5.8** by **T. D. W.** and rebuilt around the vanilla
menus. Credits carried over from that project: **YenYang** (UI),
**Algernon** (contributions, and for allowing the original project to be taken
on), **Chameleon** (icons), **Baka-gourd** (focus handling). MIT licensed; see
[LICENSE](LICENSE), and [docs/FORK.md](docs/FORK.md) for the basis.
