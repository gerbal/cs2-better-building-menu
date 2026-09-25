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
- **Translations.** Every translation lacks 162 of the 223 English keys (the
  option labels fall back to English), and `ja-JP`, `pt-BR` and `uk-UA` are
  English throughout. Either connect `crowdin.yml` to a project (with a
  `languages_mapping`, since Crowdin's Chinese codes are `zh-CN` and `zh-TW`)
  or ship English only.
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

- **Finish splitting `PrefabIndexingSystem`.** The menu audit, the per-prefab
  facts and the progression and zone rules are in `Domain/`, where tests reach
  them, and the system keeps the game reads and the logging (see
  [indexing.md](indexing.md)). What is left is optional: the bonuses, parking
  and vanilla asset facts, step 4 of the plan in
  [superpowers/specs/](superpowers/specs/2026-09-24-indexer-split-design.md).
- **Per-load state.** Replace the static index, caches and registries with one
  object created per city load and handed to the systems that read it.
- **Smaller cleanups.**
  - Name the `BuildingMenuUISystem` partials by responsibility.
  - Settle on one noun for the panel (see the glossary in
    [CONTRIBUTING.md](../CONTRIBUTING.md)).
