# FindIt remediation phase 2 — one scoping taxonomy

**Bead:** cm-jjlv.6 (epic cm-jjlv). **Argues from:** finding 2 of
`2026-09-01-architecture-review.md`. **Follows:** phase 1
(`2026-09-01-findit-remediation-phase-1-search-and-binding-contract.md`),
which deleted the search worker and the eleven orphaned bindings, and
added `BindingManifestTests`, which this phase leans on.

## The problem, as it actually is

`BuildingCatalogQuery` carries three generations of scoping:

| Fields | Source | Where it applies today |
|---|---|---|
| `Category`, `SubCategory` | upstream FindIt's `PrefabCategory`/`PrefabSubCategory` enums | Nowhere. `FindItUISystem.Methods.cs:59-60` hard-codes both to `""` on every refresh. |
| `BuildMenuSection`, `BuildMenuSubCategory` | `VanillaBuildMenuTaxonomy`, a hand-built table that reconstructs the vanilla menu from the upstream enums plus `ZoneType` | Only when no vanilla menu is scoped (`BuildingCatalogQueryEngine.cs:194` skips `MatchesBuildMenu` whenever `IsScopedToMenu`). The chip row already hides the Section/Type chips in that case (`lensScopeChips.ts`). So this taxonomy is exactly the navigation of the "All menus" mode. |
| `UiMenu`, `UiCategory` | the game's own `UIObject.m_Group` tree, read at index time into `PrefabIndex.UiMenuName`/`UiCategoryName` | Every menu opened from the toolbar or the menu chip. `PrefabIndex.cs:155`'s SPIKE asked whether this reproduces vanilla exactly; the tree has since been proven on Roads, Landscaping and Areas (`Bindings.cs:166-175`) and is the path every menu takes. |

Around them:

- `VanillaMenuPresets` maps toolbar menu names to `(PrefabCategory, PrefabSubCategory, IsZoning)`. Since the tree path opens the lens on ANY named menu, the enum half of every preset is overwritten by `UiMenu` scoping. Its one live job is `IsZoning`, which gates the `ReplaceVanillaZonesMenu` setting. `SetBuildingLensMenu` still has an empty `if (zoning) { }` block from the deleted zoning renderer.
- `UnlockMilestone` on the query, `_buildingLensUnlockMilestone`, `ResetBuildingLensMilestone()` and its six call sites are constant `-1` since phase 1 deleted `SetBuildingLensMenuMilestone`.
- `StripMatches` ORs the development-branch, asset-type and density matches regardless of `StripAxis`, so the axis the adapter publishes is not the axis the predicate honours.
- **`VanillaMenuAudit` is not what finding 2 said.** Both audit passes in `PrefabIndexingSystem` (`[MENU-AUDIT]`, `[MENU-COVERAGE]`) compare the game's own placements against the index's `UiMenuName`/`UiCategoryName` — they audit how completely the index covers the tree, not drift between the two taxonomies. That is the guard that caught the roads-cost bug. It stays; the review's sentence is corrected below.

## Decision

Commit to `UiMenu`/`UiCategory`. Delete the other two generations, the
taxonomy that fed one of them, the presets, and the milestone plumbing.
Make the strip predicate honour its axis. Add no replacement navigation:
the user's call on 2026-09-01 was that the UI as implemented is good
enough and inherited FindIt concepts are to be shed, not re-expressed.

What the player loses in "All menus" mode: the Section picker (Zones /
Signature / Service / Networks / Favorites) and the Type picker
(`PrefabSubCategory`). What covers it: the menu chip lists every vanilla
menu under the game's own names; grouping and facets are unchanged.
Favorites had no favouriting UI in the lens at all (`isFavorited` is
shipped and never rendered); Networks as a cross-menu view is what the
Roads menu already is via `NetworkMenuExtension`.

## Design

### 1. Query

`BuildingCatalogQuery` loses `Category`, `SubCategory`, `BuildMenuSection`,
`BuildMenuSubCategory`, `UnlockMilestone`, and the `AnyMilestone` constant.
`UiMenu`, `UiCategory`, `StripAxis`, `StripTabs`, `SchoolTier` and every
facet/range field stay. `IsScopedToMenu` stays as written.
`ResetWindowIfPredicatesChanged` is unchanged: it compares whole records.

### 2. Engine

`BuildingCatalogQueryEngine`:

- `MatchesBuildMenu` and `IsScopedToMenuTree` are deleted; the enum
  predicates on `Category`/`SubCategory` and the `UnlockMilestone`
  predicate are deleted. `MatchesVanillaMenuTree` is the only scope
  predicate, called unconditionally (it already returns true when both
  fields are empty).
- `StripMatches(entry, tab)` becomes `StripMatches(entry, tab, axis)`:
  - `StripAxes.Development` → `entry.DevTreeBranch == tab`
  - `StripAxes.AssetType` → `AssetTypeOf(entry) == tab`
  - `StripAxes.Density` → `DensityMatches(entry, tab)`
  - `StripAxes.Category`, empty, unknown → false (the category axis is
    `UiCategory`, which has its own field)
  The predicate at `:162` passes `query.StripAxis`. A test asserts that a
  density-formatted tab does not match under the development axis and a
  branch name does not match under the density axis; that test must fail
  on the old `||` before the change lands (necessary-not-sufficient rule).
- `AssetTypeOf` still reads `entry.Category == "Networks"`; the entry's
  Category string is out of scope (see below).

### 3. Domain

Deleted files: `Domain/VanillaBuildMenuTaxonomy.cs`,
`Domain/VanillaBuildMenuSelection.cs`, `Domain/VanillaMenuPresets.cs`,
`Domain/UIBinding/BuildingLensSectionUIEntry.cs`,
`Domain/UIBinding/BuildingLensSubCategoryUIEntry.cs`.

`BuildingCatalogEntry` loses `VanillaSection` and `VanillaSubCategory`
(never serialized; only `MatchesBuildMenu` read them) and
`BuildingCatalogAdapter.Project` loses the `VanillaBuildMenuTaxonomy.Resolve`
call.

The Zones check becomes a constant. `NetworkMenuExtension.RoadsMenu`
already names one vanilla menu; a sibling `VanillaMenus` static in
`Domain/` holds `Roads` (moved, with `NetworkMenuExtension.RoadsMenu`
forwarding to it) and `Zones = "Zones"`, with an `IsZones(string?)`
helper that trims and compares ordinal-ignore-case, the same way
`NetworkMenuExtension.IsExtended` does.

`GameLocaleKeys` drops the two entries keyed on
`VanillaBuildMenuTaxonomy.ServiceBuildings` and `.AllBuildings`. The
`nameof(PrefabCategory.ServiceBuildings)` entry beside them carries the
same key and stays.

`VanillaMenuAudit` stays. Its `<summary>` and the review spec's sentence
"VanillaMenuAudit exists to detect drift between the two" are corrected
to say what it does: compare the game's placements against the index's
tree fields.

### 4. Systems

`FindItUISystem`:

- Fields deleted: `_buildingLensSection`, `_buildingLensSubCategory`,
  `_buildingLensUnlockMilestone`; bindings deleted: `BuildingLensSection`
  / `SetBuildingLensSection`, `BuildingLensSubCategory` /
  `SetBuildingLensSubCategory`, `BuildingLensSectionList`,
  `BuildingLensSubCategoryList`. Handlers `SetBuildingLensSection`,
  `SetBuildingLensSubCategory`, `ResetBuildingLensMilestone` deleted with
  every call site.
- `VanillaMenuSelected` becomes one path: echo guard → resolve the menu
  name → if it is empty, yield to vanilla → if it is Zones and
  `ReplaceVanillaZonesMenu` is off, yield → otherwise scope
  (`_buildingLensUiMenu = name`, clear category/strip/school tier,
  refresh categories), reset the window, take ownership, and open with
  the existing "one refresh either way" dance. The comments that explain
  the echo guard and `activatePrefab: false` are kept verbatim.
- `SetBuildingLensMenu` loses the `zoning` lookup and the empty block.
- `ClearBuildingLensMenuScope` and `SearchEverything` lose the section
  widening and the `FindItUtil.CurrentCategory = Any` writes (always Any
  already; the readers are the filter bank, phase 5's).
- `RefreshBuildingCatalog` builds the query with `UiMenu`/`UiCategory`/
  `StripAxis`/`SchoolTier` and the facets; `MatchesElsewhere` widens
  with `UiMenu = ""` only; the `AutoWidenSearch` condition becomes
  `_buildingCatalogQuery.IsScopedToMenu`. That last one is a behaviour
  change on purpose: today it fires only for preset menus (whose section
  was not `AllBuildings`) and never for tree-routed ones, which was an
  accident of the two paths.
- `RefreshBuildingLensNavigation` loses the section/subcategory
  normalisation and the two list publishes.

### 5. UI

- `ChipRow.tsx`: the `section` and `subCategory` pickers, their four
  `bindValue`s and `PickerId` members go. `VanillaBuildMenuTab` moves into
  `ChipRow.tsx` as a local type.
- `lensScopeChips.ts`: `LensScopeChips` becomes `{ menu, menuCategory }`;
  `LensScopeState` loses `showZoning` and `subCategoryCount`. The header
  comment keeps the story of why the chips were hidden and adds that the
  taxonomy is now gone.
- `filterChips.ts`: the `subCategory` input and chip go.
- `vanillaBuildMenuContracts.ts` is deleted (`selectedNavigationId` has
  no caller).
- `BuildingCatalog.tsx` and `LensControlPane.tsx` drop `BuildingLensSection$`;
  `defaultGroupDimensionFor` loses its `section` parameter (its only use
  was `section == "servicebuildings"`).
- `BindingManifestTests` is the check that nothing dangles on either side.

### 6. Tests

Deleted: `VanillaBuildMenuTaxonomyTests.cs`, `VanillaMenuPresetTests.cs`,
`NetworkSectionTests.cs` (its `NetworkMenuExtension` claims already live in
`NetworkMenuExtensionTests.cs`). Trimmed: the `BuildMenuSection`/`Category`
cases in `BuildingCatalogQueryEngineTests.cs`, the milestone-narrowing
cases in `BuildingCatalogProgressionTests.cs`, the two taxonomy keys in
`GameLocaleKeyTests.cs`, and the TS `filterChips`, `lensScopeChips`,
`vanillaBuildMenuContracts`, `buildingGroups`/`buildingLensUx` cases that
name the deleted things. Added: the strip-axis test in §2.

### 7. Live verification

Porterville 3 (`--no-steam --headless`, so DLC absent: 3,995 unscoped,
368 in Landscaping as of phase 1):

1. Open Roads, Landscaping, Health & Deathcare, Zones (setting on), then
   All menus: each `[LENS-REFRESH]` total equals phase 1's for the same
   menu.
2. Inside Landscaping search `zzzz`: with `AutoWidenSearch` off the lens
   shows 0 and `BuildingCatalogMatchesElsewhere` is 0; with it on, the
   scope is released and the search runs unscoped.
3. On a development-axis menu and on Zones (density axis), click one strip
   tab: the page total equals the tab's count.
4. Zones with `ReplaceVanillaZonesMenu` off yields the menu to vanilla.

Record in `docs/verification.md` under a dated heading.

## Out of scope, on purpose

- `BuildingCatalogEntry.Category`/`SubCategory` strings and
  `PrefabIndex.Category`/`SubCategory` enums: grouping, sorting, labels
  and `NetworkMenuExtension` read them, and the entry type itself is
  phase 3's (cm-jjlv.7).
- `FindItUtil.CategorizedPrefabs`, `CurrentCategory`, `CurrentSubCategory`
  and the option sections that read them: phase 5 (cm-jjlv.9).
- Any new navigation for "All menus" mode.
