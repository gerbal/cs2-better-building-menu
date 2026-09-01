# FindIt remediation phase 5 — delete the filter bank and the upstream residue

**Bead:** cm-jjlv.9 (epic cm-jjlv). **Argues from:** findings 3 and 10 of
`2026-09-01-architecture-review.md`. **Order:** run before phase 3
(cm-jjlv.7) — the snapshot cache phase 3 builds would otherwise have to key
on fifteen filter-bank fields and six sort modes that this phase deletes,
and `_optionsUISystem.RefreshOptions()` would sit inside the number phase 3
measures. **Follows:** phase 2 (`…-phase-2-one-scoping-taxonomy-design.md`).

## What is still running for nobody

- **The filter bank.** `FindItUtil.Filters` (15 fields), ten option sections
  under `Domain/Options`, `FindItOptionsUISystem`. Phase 1 deleted its UI
  contract (`OptionsList`, `AreFiltersSet`, `ClearFilters`, `OptionClicked`),
  so nothing can change a filter any more — yet every refresh still builds
  `Filters.GetFilterList()` and applies it inside
  `BuildingCatalogAdapter.GetIndexedBuildings`, mirrors `WithParking` into
  the query's `HasParking`, snapshots the bank into `BuildingLensLegacyFilters`
  (the UI prefixes each label with "Find It:" in the empty-state message),
  mirrors the search text into `Filters.CurrentSearch`, and calls
  `_optionsUISystem.RefreshOptions()`.
- **Its statics.** `FindItUtil.CurrentCategory/CurrentSubCategory` (readers:
  the sections), `SetSorting` and `IndexedPrefabList.Sorting/SortingDescending`
  (writers: the sorting sections; six sort modes over `PrefabTrackingSystem`
  counters), `GetCategories/GetSubCategories/GetUnfilteredPrefabs` (no
  callers), `Filters.GetCustomSearchFunction` and `Mod.RegisterAPIs` (its
  only writer), the `StrictSearch` setting (read only by `Filters`).
- **Favourites.** `FindItUtil.ToggleFavorited` has no caller; the lens never
  renders `isFavorited`. Still carried: `CustomPrefabData.json` load/save,
  the `PrefabCategory.Favorite` bucket in `CategorizedPrefabs`, the
  `ResetFavorites` settings button, `PrefabIndexBase.IsFavorited`,
  `BuildingCatalogEntry.IsFavorited` and its JSON, the TS field.
- **Detailer features.** `AutoVehiclePropGeneratorSystem` and
  `AutoQuantityPropGeneratorSystem` create per-state prop prefabs at load and
  record the swap in `FindItUtil.AssetMap`; `Mod.GetIconsMap` exposes the
  vehicle map to other mods; `CustomAreaBorderRenderSystem` renders custom
  area borders. None of them touches a building. The audit and coverage logs
  carry a "substituted counts as held" clause and a "deferred until AssetMap
  is published" gate purely to accommodate the generators.
- **`ClearGooee`** deletes another mod's folders from the user's Mods
  directory on every load.
- **Settings nothing reads:** `ApplyMimic`, `SmoothScroll`, `ScrollSpeed`,
  `RowSize`, `ColumnSize`, `ExpandedRowSize`, `ExpandedColumnSize`,
  `RightRowSize`, `RightColumnSize`, `NoAssetImage`, `HideBrandsFromAny`
  (only gated upstream's "Any" bucket), `StrictSearch`.
- **Files.** `FindIt/UI.zip` — 38 MB, a zipped `node_modules` (7,232 files),
  tracked. `FindIt/Changelog.json` — upstream FindIt's 53 releases.
  `Properties/PublishConfiguration.xml` — upstream's description, features
  and thanks under this mod's name.
- **Processors.** Finding 10 said "30 category processors classify
  props/trees/decals/vehicles the lens never lists". That is wrong for
  whatever vanilla places in a menu: Landscaping's 368 entries ARE trees,
  shrubs, terraforming and surfaces, reached through
  `BelongsInCatalog(placedInAnyMenu)`. Which processors feed nothing the
  lens can show is not knowable from the source.

## Decision

Delete everything above except the processors, which are deleted by
census: a permanent `[PROCESSOR-CENSUS]` log line reports, per processor,
how many prefabs it indexed and how many of those the lens can show (a
building/network, or placed in any vanilla menu); every processor whose
second number is zero on Porterville 3 goes, and the audit and the menu
totals are re-checked afterwards.

Kept on purpose: the picker (`PickerToolSystem`, `PickerUISystem`,
`PickerTooltipSystem`, `Domain/Options/Picker/ObjectFilterOption`,
`PickerFlags`) — it opens the lens on a placed building and has its own
one-section bank; `PrefabTrackingSystem` — `OnLocateButtonClicked` reads
its placed-entity list; `ServiceCoverageOverlaySystem`; `HideRandomAssets`
— the indexer honours it; `FindItUtil.CategorizedPrefabs` as the index
store — replacing it is phase 3's business, not a deletion.

## Design

### 1. The filter bank (C#)

Delete `Domain/Filters.cs`, `Domain/Options/*.cs` (ten files; the `Picker/`
subfolder stays), `Systems/FindItOptionsUISystem.cs`,
`Domain/BuildingLensLegacyFilterSnapshot.cs`, `Domain/Enums/PrefabSorting.cs`
if nothing else names it.

`OptionsUISystem` keeps only what `ObjectFilterOption` and `PickerUISystem`
use: `GetAssetName` and `RefreshOptions`. The abstract `TriggerSearch`,
`RefreshLens`, `GetBuildingLensFacetGroup`, `ToggleBuildingLensFacetOption`
and `PickerUISystem`'s stub overrides go.

`BuildingCatalogAdapter.GetIndexedBuildings` loses the `filters` local and
its `.Where(prefab => filters.All(...))`.

`FindItUISystem`: the `_optionsUISystem` field and its `OnCreate` lookup,
`_BuildingLensLegacyFilters` field and registration, `CaptureLegacyFilters`
and its publish, `_optionsUISystem.RefreshOptions()` with its comment, the
`HasParking = FindItUtil.Filters.WithParking …` lines in the query build,
the `FindItUtil.Filters.CurrentSearch` mirror in `SearchChanged` and
`ResetBuildingLensMenu`.

`BuildingCatalogQuery.HasParking` and the engine's `HasParking` predicate
go (the entry's `HasParking` stays: it is a sort column and a facet-visible
fact). `OfferedSortColumns` keeps `"HasParking"`.

`FindItUtil`: delete `Filters`, `CurrentCategory`, `CurrentSubCategory`,
`GetCategories`, `GetSubCategories`, `GetUnfilteredPrefabs`, `SetSorting`;
`Find(prefab, setCategory, out id)` becomes `Find(prefab, out id)`.
`IndexedPrefabList` loses `Sorting`/`SortingDescending` and `Sort`; the
ordered list is by `Name` then `PrefabName`, which was the default.

`Mod.RegisterAPIs` goes with `Filters.GetCustomSearchFunction`.

### 2. The filter bank (TS)

`buildingLensFilterSummary.ts` loses `legacyFilters` (input field, count,
the "Find It:" details) and `BuildingCatalog.tsx` loses the
`BuildingLensLegacyFilters$` read and the `legacyFilters` argument; the
three test cases that pass `legacyFilters` go. `BindingManifestTests`
confirms both sides.

### 3. Favourites

Delete `Domain/CustomPrefabData.cs`, `FindItUtil.customPrefabsData`,
`IsFavorited`, `ToggleFavorited`, `UpdateFavoritesList`, `ResetFavorites`,
`SaveCustomPrefabData`, `LoadCustomPrefabData`, `FavoritePack`; the
`Mod.OnLoad` call; the `ResetFavorites` button in `FindItSettings`;
`PrefabIndexBase.IsFavorited`; the indexer's `IsFavorited` assignment and
the `PrefabCategory.Favorite` bucket writes (`AddPrefab`) and
`RemoveItem`'s favourite handling; `PrefabCategory.Favorite` and
`PrefabSubCategory.Favorite` enum members if nothing else names them;
`BuildingCatalogEntry.IsFavorited` (constructor parameter and the
`"isFavorited"` JSON property) and the TS `isFavorited` field. The twelve
test fixtures that pass `IsFavorited: false` drop the argument; the
page-write property-name test drops `"isFavorited"`.

### 4. Detailer residue and files

Delete `Systems/AutoVehiclePropGeneratorSystem.cs`,
`Systems/AutoQuantityPropGeneratorSystem.cs`,
`Systems/CustomAreaBorderRenderSystem.cs`, their `UpdateAt` registrations,
`Mod.GetIconsMap`, `Mod.ClearGooee` and its `RegisterUpdater`,
`FindItUtil.AssetMap` and the `MovingObjectPrefab → "Prop_"` rename in
`Find`.

`VanillaMenuAudit.Compare` loses its `substitutedPrefabNames` parameter and
the `IsHeld` substitution clause; the audit test for substitution goes.
`PrefabIndexingSystem.LogVanillaMenuAudit` stops passing `AssetMap.Keys` and
drops `verdictReady`; `LogVanillaMenuCoverage` drops the "deferred" gate and
the `substituted` counter. The prop originals that the generators used to
replace are now expected to be indexed by `PropPrefabCategoryProcessor`
(its query already includes `QuantityObjectData`), so Landscaping's audit
must read Missing = 0 without the clause.

`FindItSettings` loses the twelve dead settings and `IsShelfHidden` stays;
`Locale.json` loses their labels/descriptions.

`git rm FindIt/UI.zip`, add `FindIt/UI.zip` to `.gitignore`.
`FindIt/Changelog.json` becomes this mod's own: one `0.1.0` entry naming
what it is and the 2026-09-01 remediation. `Properties/PublishConfiguration.xml`
keeps the "no upstream ID" comment and gets a description that is true of
this mod (building lens inside the vanilla menus, table/grid/list, facets,
metric ranges, coverage overlay, picker) with no upstream thanks, features
or forum link; the `ChangeLog` element mirrors `Changelog.json`.

### 5. Processors, by census

`PrefabIndexingSystem.RunIndex` records, per processor, the indexed count
and — after the vanilla placements are known — the lens-relevant count:
`IsBuilding`-equivalent (`Category` is Buildings/ServiceBuildings/Networks)
or `IsPlacedInAnyMenu(id)`. One `[PROCESSOR-CENSUS]` line per processor
after `Indexed Prefabs Count`, e.g.
`[PROCESSOR-CENSUS] TreePrefabCategoryProcessor indexed=412 lens=412`.

After a live run on Porterville 3, every processor with `lens=0` is deleted
(file + nothing else: they are discovered by reflection). Any processor
with `lens>0` stays, whatever finding 10 said.

### 6. Live verification

Porterville 3, `--no-steam --headless`: `[MENU-AUDIT]` clean with Missing
= 0 on every menu (no substitution clause); `[LENS-REFRESH]` Roads 228,
unscoped 3,995 unchanged, Landscaping ≥ 368; the census line for every
surviving processor shows `lens>0`; zero exceptions; the options screen
lists only settings something reads.

## Out of scope

- `FindItUtil.CategorizedPrefabs` and the upstream `PrefabCategory` /
  `PrefabSubCategory` enums as the index's shape — phase 3.
- The picker's own bank and `OptionsUISystem` beyond the trim above.
- Any change to what the lens shows.
