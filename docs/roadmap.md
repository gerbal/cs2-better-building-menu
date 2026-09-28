# Roadmap

Open work, roughly in order of value. What has shipped is in
`BetterBuildingMenu/Changelog.json`.

## Player-facing

- **Player layout.** Let players re-categorise the panel: move an asset to
  another tab or menu, and create, rename, reorder, merge or hide tabs.
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
- **Unchecked in game.** Known only from reading the code, or checked on an
  older game:
  - placing an upgrade through the upgrades picker;
  - Road Builder's discarded roads leaving the panel, and an edited road
    keeping its menu placement (see [indexing.md](indexing.md), "Partial
    passes");
  - whether Cohtml 2.2 (game 1.6.2) still needs the floating-surface
    workarounds (see [design-notes.md](design-notes.md), "Hand-rolled
    floating surfaces in Cohtml");
  - whether any prefab carries a `BuildingModule` buffer.
    `GetSupportedUpgrades` reads one for the modules signature towers take,
    but a census of one base-game save found none.

## Structure

- **Smaller cleanups.**
  - Move the chirper's toasts out of the control pane's way, so the lens can
    stop sinking the toolbar (see [design-notes.md](design-notes.md),
    "Patching vanilla's layout for the lens").
  - Name the `BuildingMenuUISystem` partials by responsibility.
  - Settle on one noun for the panel (see the glossary in
    [CONTRIBUTING.md](../CONTRIBUTING.md)).
