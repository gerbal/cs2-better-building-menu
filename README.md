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

`PrefabIndexingSystem` indexes every prefab once per load, and again for
prefabs that change. `BuildingCatalogAdapter` projects that index into
catalog rows. For each refresh, `CatalogView` scopes the rows to the open
menu, has `BuildingCatalogQueryEngine` filter, sort and page them, and works
out the tabs, facets and metric ranges alongside.
`BuildingMenuUISystem` publishes the results as bindings. The React UI, which
extends vanilla's `AssetMenu`, draws them, and sends what the player does back
as triggers. The query state lives in C# (`BuildingCatalogLensState`), so the
UI never holds more than a page. Terms are in the glossary in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

* [CONTRIBUTING.md](CONTRIBUTING.md): setup, boundaries, the comment rule,
  glossary.
* [docs/roadmap.md](docs/roadmap.md): open work.
* [docs/release-checklist.md](docs/release-checklist.md): what to run before
  a release. [docs/publishing.md](docs/publishing.md): uploading it, from
  Linux.
* [docs/verification.md](docs/verification.md): live checks, dated.
* [docs/compatibility.md](docs/compatibility.md): other popular mods,
  measured.
* [docs/indexing.md](docs/indexing.md) and
  [docs/design-notes.md](docs/design-notes.md): the reasoning behind the
  indexer and the UI, pointed to from the code.
* [docs/vanilla-upgrades.md](docs/vanilla-upgrades.md): how vanilla handles
  building upgrades and extensions.
* [docs/customisation-prior-art.md](docs/customisation-prior-art.md) and
  [docs/superpowers/specs/](docs/superpowers/specs/): research and the spec
  for player layout.
* [docs/FORK.md](docs/FORK.md): provenance and license.
* [docs/reviews/](docs/reviews/): code reviews, dated.

## Build and test

```sh
./build.sh all                              # C# (Debug) and UI
./build.sh test                             # C# tests
CS2_BUILD_CONFIG=Release ./build.sh all     # release build
CS2_BUILD_CONFIG=Release ./build.sh package # artifacts/BetterBuildingMenu
cd BetterBuildingMenu/UI && npm test        # UI unit and render suites
```

Deploy by copying the packaged folder into the game's `Mods/` directory. Never
leave a `.disabled` copy containing a UI bundle in `Mods/`: the asset scanner
registers it as a duplicate module.

## Compatibility

Find It may be installed alongside. Its window takes the asset-menu slot while
open and this panel returns when it closes; the object picker is Find It's
alone. No Harmony patches; nothing is written to the save.

## Credits

Forked from **Find It 1.5.8** by **T. D. W.** and rebuilt around the vanilla
menus. Credits carried over from that project: **YenYang** (UI),
**Algernon** (contributions, and for allowing the original project to be taken
on), **Chameleon** (icons), **Baka-gourd** (focus handling). MIT licensed; see
[LICENSE](LICENSE), and [docs/FORK.md](docs/FORK.md) for the basis.
