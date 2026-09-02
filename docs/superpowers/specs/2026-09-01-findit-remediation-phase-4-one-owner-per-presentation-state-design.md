# FindIt remediation phase 4 — one owner per piece of presentation state

**Bead:** cm-jjlv.8 (epic cm-jjlv). **Argues from:** finding 6 of
`2026-09-01-architecture-review.md`. **Follows:** phase 3 (cm-jjlv.7),
whose `CatalogView` is where the effective grouping and the group
dimensions are computed now.

## Three owners, two orders, two group trees

- **groupBy.** C# holds it on `BuildingCatalogQuery.GroupBy` and publishes
  `BuildingCatalogGroupBy`, which nothing reads (the one entry in
  `BindingManifestTests.KnownUnreadByUi`). TS holds the player's *choice*
  in a module-global `Map` behind `useLensChoice`. Both `BuildingCatalog.tsx`
  and `LensControlPane.tsx` derive the *effective* value with
  `defaultGroupDimensionFor(menuHasCategories, stripAxis, educationMenu)` and
  `BuildingCatalog.tsx` pushes it back in a `useEffect`
  (`SetBuildingCatalogGroupBy`) — the second refresh on every first open of
  a menu, visible as the doubled `Roads` line in every live run this
  session.
- **Order.** Grid, list and cards run `rankBuildingMatches(entries, search)`
  over the page C# already sorted; the table renders C#'s order. With a
  query, `rankBuildingMatches` also *drops* entries whose `matchScore` is 0
  — C# matches `PdxModsId` by `Contains`, TS scoring never looks at it, so
  a search by mod id lists in the table and vanishes from the grid.
- **Grouping.** C# orders by `BuildingCatalogGrouping.PrimaryKey/SecondaryKey`
  (338 lines: band edges, tier ranks, category priority); TS rebuilds the
  tree with labels in `buildGroupedView` + `groupLevelsFor` + ten label
  helpers (~500 of `buildingGroups.ts`'s 972 lines), with the band edges
  "duplicated in `buildingGroups.ts` and asserted in both test suites".

## Decision

C# owns the effective grouping, the search relevance and the group labels;
TS owns the player's view choices in one store and renders what it is
sent. Nothing about what the lens shows changes except that all four views
now agree, and the first open of a menu refreshes once.

Two judgement calls, made here: (1) while a search is active, relevance
orders rows within each group in **every** view — the table gains it where
it showed the sort column before; (2) group headings are C#'s strings,
localised in TS only where they are the game's own category names
(`groupLabelId`).

## Design

### 1. C# owns the effective groupBy

`BuildingCatalogQuery.GroupBy` holds the player's CHOICE; `""` means
"auto". `BuildingCatalogGrouping` gains

```csharp
public static string DefaultDimension(bool menuHasCategories, string? stripAxis, bool educationMenu);
public static string Effective(string? choice, bool menuHasCategories, string? stripAxis, bool educationMenu);
```

— `DefaultDimension` is `defaultGroupDimensionFor` moved (education →
`schoolTier`; categories → `menuCategory`; axis `development` →
`development`; axis `assetType` → `category`; else `category`);
`Effective` returns the choice when `IsGrouped`-or-`none`, else the
default. `CatalogView` takes an optional
`Func<CatalogView, string> groupByResolver`; `EffectiveGroupBy` memoises
its result and `Page` queries with `_query with { GroupBy = EffectiveGroupBy }`.
`FindItUISystem` passes
`view => BuildingCatalogGrouping.Effective(_buildingCatalogQuery.GroupBy, PrefabIndexingSystem.GetMenuCategories(menu).Count > 0, view.StripAxis, VanillaMenus.IsEducation(menu))`
and publishes `_BuildingCatalogGroupBy.Value = view.EffectiveGroupBy`.
`SetBuildingCatalogGroupBy("")` is accepted (auto) instead of ignored;
`ResetBuildingLensMenu` resets `GroupBy` to `""` with the sort.

TS: `groupBy` is `useValue(BuildingCatalogGroupBy$)` in both components;
`defaultGroupDimensionFor`, the push-back effect and the groupBy entry in
the store go. The picker fires `SetBuildingCatalogGroupBy(id)`; Reset
menu no longer touches groupBy on this side. `KnownUnreadByUi` becomes
empty.

### 2. C# owns relevance

`Domain/BuildingCatalogRelevance.cs`: `static int Score(BuildingCatalogEntry
entry, string query)` — `matchScore` moved: exact 1000, prefix 800,
word-start 600, substring 400 on the display name; 200 for a hit on the
prefab name, the pdx mods id or the category text; 0 otherwise.
`BuildingCatalogQueryEngine.Order` inserts, when `SearchText` is non-blank,
`ThenByDescending(score).ThenBy(name length)` between the group seed and
the chosen sort column, so relevance decides within a group and the sort
column breaks ties. TS: `rankBuildingMatches`, `matchScore`,
`stableGridOrder`, `topSearchResult` go; grid and list render `entries` in
order and Enter arms `entries[0]`. `getSearchScopeNotice` stays (it is a
different concern in the same file; the file keeps only it).

### 3. C# owns group labels

`BuildingCatalogGrouping.Labels(entry, groupBy, milestoneNames)` returns
`(string[] Path, string? LabelId)` — `groupLevelsFor` and its helpers
moved: category/subcategory labels, `menuCategoryLabel` (menu prefix
stripped, words split), `categoryTierLabel` (density tier → transit tier →
dev branch → milestone), `densityTierLabel`, school tier names, theme,
source (DLC id over provenance), footprint and cost bands with the same
edges as the ranks, milestone names with "From the start" / "Milestone N"
fallbacks, "Other" for the unnamed. `LabelId` is the `UiCategory` id for a
menu-category heading so TS can localise it; everything else is the string.

`BuildingCatalogEntry` gains `GroupPath` (`string[]`, default empty) and
`GroupLabelId` (`string?`), written as `groupPath` / `groupLabelId`.
`CatalogView.Page` sets them on the page's items for `EffectiveGroupBy`
(100 entries, not the set). `CatalogView.GroupDimensions` lists the
dimension ids that can act on `MenuSet` (`groupDimensionsFor` moved: a
dimension is offered when two entries give different primary keys;
`schoolTier` only on the education menu; `none` always); published as
`BuildingLensGroupDimensions` (string[]).

TS: `buildGroupedView` becomes `groupTreeFromPaths(entries)` — consecutive
entries with the same `groupPath` prefix form a node, nested by depth,
"Other" last is C#'s concern now; `flattenGroupedRows` walks that tree;
`groupDimensionsFor` reads the binding; `GROUP_DIMENSIONS` (ids + picker
labels) and `groupDimensionLabel`/`isGroupDimension` stay. Deleted:
`groupLevelsFor`, `menuCategoryLabel`, `categoryTierLabel`,
`densityTierLabel`, `schoolTierFor`, `SCHOOL_TIERS`, `DENSITY_TIERS`,
`COST_BANDS`, `FOOTPRINT_BANDS`, `costBandLabel`, `footprintBandLabel`,
`milestoneLabel`, `PROGRESSION_UNGATED_LABEL`, `UNGROUPED_LABEL`,
`humanizeGroupLabel`, `GroupableEntry`, `defaultGroupDimensionFor`, and the
registry entries in `localizableStrings.ts` for the moved strings.
`menuProgression.ts`/`serviceForecast.ts` comments that name
`SCHOOL_TIERS` are corrected to name the C# copy.

### 4. One store

`src/domain/lensViewStore.ts` replaces `buildingLensViewState.ts` and
`mods/useLensChoice.ts`: one object `{ viewMode, expandedId, disclosures,
anchors }` with `getLensView()`, `setLensView(partial)`,
`subscribeLensView`, `resetLensView()`, and `useLensView<T>(selector)` on
`useSyncExternalStore`. Same semantics the existing tests pin (fallbacks,
survive remount, explicit close ≠ unset, anchors per surface/viewMode/groupBy
key). groupBy is not in it.

### 5. Out of scope

`BuildingCatalog.tsx`'s size and the vanilla DOM patches (cm-jjlv.10), the
source-regex tests (cm-jjlv.11), `GroupedResults`' rendering.

## Tests

- C#: `BuildingCatalogGroupingLabelsTests` (ported from the TS "Bands",
  "Heading labels", "Density tiers", "categoryTierLabel", "transit tiers",
  "menuCategory sub-grouped by density", "The Other group" cases),
  `DefaultDimension`/`Effective` (ported from "Default grouping"),
  `BuildingCatalogRelevanceTests` (ported from `buildingSearchRank.test.ts`'s
  scoring cases), an engine test that relevance orders within a group and the
  sort column breaks ties, a `CatalogViewTests` case for `GroupDimensions`
  and `EffectiveGroupBy`, and `PageWrite_EmitsStablePageAndEntryPropertyNames`
  gains `groupPath`, `groupLabelId`.
- TS: `groupTreeFromPaths`/`flattenGroupedRows` on `groupPath` fixtures;
  `lensViewStore.test.ts` (ported from `buildingLensViewState.test.ts`);
  `buildingSearchRank.test.ts` keeps only the scope-notice cases;
  `BindingManifestTests` with an empty allowlist.

## Live verification

`949230-c`, Porterville 3: opening each of the five menus logs **one**
`[LENS-REFRESH]` (no `SetBuildingCatalogGroupBy` line); `BuildingCatalogGroupBy`
reads `menuCategory` on Roads, `development` on Electricity, `schoolTier`
on Education, `category` on All menus; grid and table show the same first
entry for `tre` inside Landscaping; a search for a `pdxModsId` (from
`BuildingCatalog.items[0].pdxModsId` on a modded entry) lists in both grid
and table; `BuildingLensGroupDimensions` on Electricity omits `schoolTier`
and includes `development`; totals unchanged (Roads 403, Landscaping 522,
Health & Deathcare 31, Zones 74, Electricity 17, All 10,536); zero
exceptions.
