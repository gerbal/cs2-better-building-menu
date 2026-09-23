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
- **Translations.** Every translation lacks about 200 of the 271 English
  keys (the option labels fall back to English), and `ja-JP`, `pt-BR` and
  `uk-UA` are English throughout. Either connect `crowdin.yml` to a project (with a
  `languages_mapping`, since Crowdin's Chinese codes are `zh-CN` and `zh-TW`)
  or ship English only. `Options.LABEL[…LotWidth]` and `…LotDepth` are
  referenced and missing, and about 33 keys are referenced nowhere.
- **Unmeasured paths.** Placing an upgrade through the upgrades picker, and
  Road Builder's discarded roads leaving the panel, are known only from
  reading the code.

## Structure

- **Rendering cost.** Memoise the rows, share one hover context, and read
  the bindings through one module, so a hover or a page does not re-render
  the whole panel.
- **Split `PrefabIndexingSystem` further.** It is one partial class across six
  files (see [indexing.md](indexing.md)). Moving the menu audit and
  `PopulateAnalyticalData` into classes of their own would let a test reach
  the mapping from a prefab's components to its facts.
- **An atomic full pass.** Build the new index beside the old one and swap at
  the end, keeping the old index if the pass throws.
- **Per-load state.** Replace the static index, caches and registries with one
  object created per city load and handed to the systems that read it.
- **Refresh from the UI side.** Let `BuildingMenuUISystem.OnUpdate` notice a
  new `IndexGeneration` and refresh once, while the panel is open, rather than
  the indexer calling into the UI.
- **Smaller cleanups.**
  - Name the `BuildingMenuUISystem` partials by responsibility.
  - Delete the dead side of the two C#/TypeScript pairs that have drifted
    apart: the minimum panel width, and the density order.
  - Settle on one noun for the panel (see the glossary in
    [CONTRIBUTING.md](../CONTRIBUTING.md)).
