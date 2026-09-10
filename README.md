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
* `BetterBuildingMenu/Properties/` — store listing (`PublishConfiguration.xml`),
  logo, cover and screenshots.
* `docs/` — [FORK.md](docs/FORK.md) (provenance and license),
  [publishing.md](docs/publishing.md) (uploading from Linux),
  [roadmap.md](docs/roadmap.md), [verification.md](docs/verification.md)
  (live checks, dated).

## Build and test

```sh
./build.sh all                          # C# (Debug) and UI
CS2_BUILD_CONFIG=Release ./build.sh all # release build
./build.sh package                      # artifacts/BetterBuildingMenu
cd BetterBuildingMenu/UI && npm test    # UI unit and render suites
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
on), **Chameleon** (icons), **Baka-gourd** (focus handling). License basis is
in [docs/FORK.md](docs/FORK.md).
