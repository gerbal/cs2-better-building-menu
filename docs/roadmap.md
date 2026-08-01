# FindIt Building Menu Successor — Roadmap

The successor keeps FindIt's proven asset-discovery foundation and adds a
decision-oriented building workflow. It is not intended to discard the picker,
placement, or broad asset coverage that make Find It useful.

## Retain from Find It

- Incremental prefab indexing and mod-added asset discovery
- Comprehensive categories and subcategories
- Search, sorting, filtering, favorites, and random selection
- Picker integration and placement-tool continuity
- Locate/selection behavior and tool-options compatibility
- Settings, keybindings, localization, and the Cohtml binding helpers

## Expand for building decisions

1. **Identity and isolation** — migrate namespaces, assembly, UI, settings, and
   publishing metadata to a unique successor identity; add a build guard that
   cannot deploy the upstream `FindIt` ID.
2. **Building lens** — make buildings a first-class view with service/category
   taxonomy and a clear switch back to the complete asset catalog. The first
   slice now exposes a bounded `BuildingCatalog` page binding backed by a
   projection of `FindItUtil.CategorizedPrefabs`; it does not introduce a
   second ECS scan or send an unbounded list to Gameface. A first Gameface
   lens is now wired behind the top-bar building button with flexbox rows,
   metric columns, sort controls, bounded paging, and a scroll-constrained
   result region; selecting a row uses FindIt's existing prefab placement
   trigger.
3. **Analytical catalog** — expose data-driven columns for cost, upkeep,
   workers, capacity, utilities, pollution, and other available prefab data.
   Construction cost, upkeep, workers, capacity, electricity, water, garbage,
   water/sewage capacity, and pollution fields are now nullable and populated
   during the existing prefab index pass when their components are present.
4. **Constraint workflows** — extend the bounded query contract with range
   filters, category-scoped filters, saved filter presets, and multi-column
   sorting without moving the catalog into a giant client-side list. The first
   category-scoped control is now a bounded Education & Research capacity-floor
   preset; it maps to the existing nullable capacity metric and clears when the
   active subcategory changes.
5. **Compare and place** — compare up to three candidates, inspect their
   analytical summaries, and enter the normal placement tool without losing
   the panel context. This first bounded tray is implemented and live-smoked.
6. **Verification** — build, unit-test pure catalog/filter logic, and validate
   search/filter/sort/paging/placement on a developed save before considering a
   successor release. The 2026-07-26 parity run covers close/reopen,
   category/filter, picker continuity, and OnlyPlaced locate; its evidence is
   archived in `docs/verification.md`.

## Staged migration from the old BMO

The old `cs2-building-menu-overhaul/` remains the rollback reference. The
cutover sequence is deliberately staged:

The parity comparison is explicit rather than an identity-only fork:

| Capability | Old BMO | FindItBuildingMenu successor |
| --- | --- | --- |
| Catalog source | Dedicated `CS2BuildingRecordSource` ECS query | Existing FindIt incremental index, projected through a bounded catalog page |
| Search/category/paging | C# catalog and React table | FindIt categories/search plus the bounded building lens query |
| Filters and metrics | Analytical columns and range filters | Nullable analytical metrics, common/category filters, numeric sort, and range filters |
| Picker/place/locate | Normal placement trigger from a table row | FindIt's picker and placement path, compare `Place`, and locator actions |
| Runtime identity | `CS2BuildingMenuOverhaul` | `FindItBuildingMenu` with no upstream `77240` publisher ID |
| Rollback | Original source tree | Isolated package; never run both modules together |

1. Keep only `BootDiagnostics` and `FindItBuildingMenu` in the isolated Mods
   roots while validating a release candidate.
2. Confirm the upstream license notice and assign a new PDX publisher identity;
   do not reuse Find It's `77240` publisher ID.
3. Back up the old BMO package and remove its folder from both Mods roots. Do
   not rename it to `.disabled`, because the game still scans UI bundles in
   disabled folders.
4. Deploy the successor package to both Mods roots, launch a developed save,
   and repeat `docs/verification.md` after any identity or release-build
   change.
5. If rollback is required, stop the game, remove `FindItBuildingMenu`, and
   restore the old BMO package; never run both overlapping menu modules
   together.

## Design boundary

The fork should reuse FindIt's game integration where it is stable and isolate
new analytical behavior behind small services and typed UI bindings. Avoid a
second indexing implementation or an unconditional rewrite of FindIt's tested
placement flow.
