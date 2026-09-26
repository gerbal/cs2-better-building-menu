# Roadmap

Open work, roughly in order of value. What has shipped is in
`BetterBuildingMenu/Changelog.json`.

## Player-facing

- **Player layout.** Let players re-categorise the panel: move an asset to
  another tab or menu, and create, rename, reorder, merge or hide tabs. A
  spec is written and awaiting the owner's review; the research behind it is
  in [customisation-prior-art.md](customisation-prior-art.md).
- **Translations.** Every translation lacks 162 of the 223 English keys (the
  option labels fall back to English), and `ja-JP`, `pt-BR` and `uk-UA` are
  English throughout. Either connect `crowdin.yml` to a project (with a
  `languages_mapping`, since Crowdin's Chinese codes are `zh-CN` and `zh-TW`)
  or ship English only. The card's effect lines belong with this work: their
  labels are English and their numbers invariant, so a comma-decimal language
  reads "1.5" in an effect beside "1,5" elsewhere on the card (#62).
- **The density-tier headings.** They stay English in every language. The game
  has no word for a tier alone (see [design-notes.md](design-notes.md), "Labels
  in the game's words"), so they are to be translated as the mod's own strings.
  The headings come from `BuildingCatalogLabels.DensityTier`, which returns
  English that the query engine also matches on: give them a label separate
  from the match key, looked up through the mod's `ZoneLow` through
  `ZoneSignature` keys, which `GameLocaleKeyTests` requires and nothing reads
  yet. This belongs with the translation work above.
- **Unmeasured paths.** Placing an upgrade through the upgrades picker, and
  Road Builder's discarded roads leaving the panel, are known only from
  reading the code.

## Structure

- **Smaller cleanups.**
  - Name the `BuildingMenuUISystem` partials by responsibility.
  - Settle on one noun for the panel (see the glossary in
    [CONTRIBUTING.md](../CONTRIBUTING.md)).
