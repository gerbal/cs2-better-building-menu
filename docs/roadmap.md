# Roadmap

Open work, roughly in order of value. What has shipped is in
`BetterBuildingMenu/Changelog.json`, and how it was checked is in
[verification.md](verification.md). The reviews in [reviews/](reviews/) hold
the detail behind the structural items.

## Player-facing

- **Player layout.** Let players re-categorise the panel: move an asset to
  another tab or menu, and create, rename, reorder, merge or hide tabs. The
  spec and its adversarial review are in
  [superpowers/specs/](superpowers/specs/), awaiting the owner's review.
- **Translations.** Every key in `Locale.json` has a translation in each of
  the thirteen languages, drafted by machine on 2026-09-25 rather than by
  native speakers, and without the game's own locale to match its terms
  against. A native speaker's pass is still worth having, through pull
  requests or `crowdin.yml` connected to a project (with a
  `languages_mapping`, since Crowdin's Chinese codes are `zh-CN` and `zh-TW`).
  Some English reaches the player through no key at all:
  - the sort picker's names (`buildingLensSortPresentation.ts`), drawn under
    the translated "Sort by";
  - the compact table's column headers ("Upk", "Wkr", "Lvl", "Park", "Cap"
    in `buildingLensLayout.ts`) and the lot column's "Lot dimensions" title;
  - the UI register's unplumbed strings (`localizableStrings.ts`); twelve of
    the keys it marks plumbed are read by nothing (GroupedBy, SortedBy,
    SortByOption, the sort directions and the Zone fragments);
  - most group headings built in C# (Other, Stations, density tiers, cost
    bands, role names);
  - a resource's name in an unlock requirement and a zone's traded goods,
    which could take the game's `Resources.TITLE[…]`.

  And the units after a number ("households", "jobs", "bays") have one form
  per language, so in Polish, Russian and Ukrainian, which inflect by count,
  they read wrong for some counts. Fixing that needs plural forms in the code.
- **The density-tier keys.** `ZoneLow` through `ZoneSignature` are kept because
  `GameLocaleKeyTests` requires them, but nothing reads them: the density
  headings come from `BuildingCatalogLabels.DensityTier`, which returns English
  that the query engine also matches on. Either give those headings a label
  separate from the match key and look it up through these keys, or drop the
  keys and the test together.
- **Unmeasured paths.** Placing an upgrade through the upgrades picker, and
  Road Builder's discarded roads leaving the panel, are known only from
  reading the code.

## Structure

- **Split `PrefabIndexingSystem` further.** It is one partial class across six
  files (see [indexing.md](indexing.md)). Moving the menu audit and
  `PopulateAnalyticalData` into classes of their own would let a test reach
  the mapping from a prefab's components to its facts.
- **Per-load state.** Replace the static index, caches and registries with one
  object created per city load and handed to the systems that read it.
- **Smaller cleanups.**
  - Name the `BuildingMenuUISystem` partials by responsibility.
  - Settle on one noun for the panel (see the glossary in
    [CONTRIBUTING.md](../CONTRIBUTING.md)).
