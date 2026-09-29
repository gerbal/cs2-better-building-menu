# Better Building Menu — Fork Record

## Provenance

- Upstream repository: `https://github.com/JadHajjar/FindIt-CSII.git`
- Upstream branch: `main`
- Upstream revision: `d865b795b1c00491aa529934b906ba5c5ce6f42c`
- Upstream release marker: `v1.5.8`
- Fork method: tracked files exported from the upstream revision.

The copied implementation retains the upstream credits in `README.md`,
including YenYang, Algernon, Chameleon, and Baka-gourd (NullPinter).

## License

The upstream `FindIt/FindIt.csproj` declares `Copyright` as `@2024 MIT license`.
Upstream carries no `LICENSE`, `COPYING` or `NOTICE` file and no license text in its
README, so that line is the whole of its license claim, and this fork is published on
it. `LICENSE` here carries that basis as the MIT terms, with T. D. W.'s 2024 copyright
line for Find It beside this fork's: MIT asks that the notice travel with every copy.
The published listing credits Find It 1.5.8 by T. D. W.; this repository also states that
basis. If the upstream author adds a license file or objects, this record and the
listing change to match.

None of Find It's store art ships here, nor its fuzzy-search engine or its favourites
feature. What is still upstream's:

- **Scaffolding.** The CS2 UI mod template's `UI/types/*.d.ts`, which every UI mod carries,
  `Resources/Blacklist.txt` and `.gitattributes`, all unchanged.
- **Translations.** 780 of the 793 strings in `Locale/*.json` are upstream's translators'
  work, unchanged. The mod's other 162 strings have no translations yet, so every language
  shows them in English.
- **Images.** `UI/src/images/find.svg` unchanged, and `lock.svg` and `unlock.svg`
  recoloured. All three came to Find It from [SVG Repo](https://www.svgrepo.com), whose
  license is set per icon, and upstream did not record which.
  `Resources/Images/ZoneResidentialMixed.svg` is covered under [Art from the
  game](#art-from-the-game).

## Unified Icon Library

The panel's category, filter and header icons are
[Unified Icon Library](https://github.com/algernon-A/UnifiedIconLibrary)'s, by algernon,
drawn by Chamëleon TBN, as Find It's were. The mod names them by `coui://uil/...` and ships
no copies: `PublishConfiguration.xml` declares that mod (Paradox Mods id `74417`) a
dependency, so the game installs it with this one. Without it those icons draw blank. Other
mods' `coui://uil/...` thumbnails pass through unchanged, and load as they do in the
game's own menus.

## Art from the game

A few images are drawn from the game's own UI art, which is the publisher's, as many mods'
icons are:

- `Resources/Images/ZoneResidentialMixed.svg`: the game's icon of that name
  (`Media/Game/Icons/`), recoloured. It came from Find It.
- `Resources/Images/LockRaster.png`: the game's `Media/Glyphs/Lock.svg`,
  rasterised and tinted. It stands in for that glyph because Cohtml re-rasterises a vector
  under a filter every frame, and the vector flickered.

## Runtime identity safety

This mod's runtime identities are its own:

- C# mod ID: `BetterBuildingMenu`
- UI mod ID: `BetterBuildingMenu`
- Assembly/root namespace: `BetterBuildingMenu`
- UI asset hosts: `betterbuildingmenu` and `betterbuildingmenusilhouettes`
- Paradox Mods id: `158589`. Upstream's `77240` must never appear in this mod's
  publish configuration.

Prefab category metadata is data compatibility rather than a runtime module
identity: the index accepts both legacy `FindIt/...` overrides from existing
assets and `BetterBuildingMenu/...` overrides written for this mod.

Find It and this mod may be installed together. Find It's panel takes the asset-menu
slot while it is open and this menu returns when it closes, its object picker is the
only one, and the two ship no file at the same shared path; see
[compatibility.md](compatibility.md).
