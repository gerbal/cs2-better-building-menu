# FindIt remediation phase 3 — one snapshot per scope, one pass per refresh

**Bead:** cm-jjlv.7 (epic cm-jjlv). **Argues from:** finding 4 of
`2026-09-01-architecture-review.md`. **Follows:** phase 5 (cm-jjlv.9),
which removed the filter bank and the six sort modes this cache would
otherwise have had to key on, and phase 2, which left `UiMenu`/`UiCategory`
as the only scope.

## What a refresh does today

`FindItUISystem.RefreshBuildingCatalog` calls `BeginRefresh()` — which
**clears** the adapter's projection cache — then asks the adapter eight
questions about the same query. Each answer starts from
`ProjectForMenu(menu, dlcIds)` (a full scan of `CategorizedPrefabs[Any][Any]`
— ~24,000 prefabs on Porterville 3 — through `BelongsInCatalog` and the
toolbar filter, then `Project` into a ~55-field `BuildingCatalogEntry`;
cached only within this one refresh) and then runs
`BuildingCatalogQueryEngine.InScope` — a full `Matches` pass — over it:

| Call | `InScope` passes | Notes |
|---|---:|---|
| `Query` | 3 | `matching` is a lazy `Where`; `Count()`, `Order(...)` and `ReorderableSortColumns(...)` each re-run `Matches` |
| `GetMetricBounds` | 1 | |
| `GetFacetState` | 2 | plus a SECOND full scan + projection with `ignorePackSelection: true`, uncached |
| `GetMenuCategoryCounts` | 1 | |
| `GetStripAxis` | 2–4 | `GetMenuCategoryCounts` again, `GetExpandedCategoryId` (which calls it a third time + 1 pass), `StripTabsFor` ×2 |
| `GetStripTabs` | 3–6 | `GetStripAxis` again in full, then `StripTabsFor` ×1–2 |
| `GetExpandedCategories` | 2–4 | density pass, `GetExpandedCategoryId` (+ counts), `GetExpandedCategoryTabs` (+ id again + pass) |
| `GetMenuSchoolTierCounts` | 1 | |

Fifteen to twenty passes, two projections, per refresh; and the cache is
gone before the next keystroke. Phase 5's live run put the whole-catalog
refresh at 373–506 ms and a menu at 23–85 ms (`949230-c`, ~10,500 lens
entries unscoped).

## Decision

Cache the projection **across** refreshes, keyed on everything that changes
it and invalidated by an index generation counter; and derive every
per-refresh answer from **one** scoped pass, memoised on a per-refresh view
object. Measure the stage breakdown before and after on the same prefix.
Keep `BuildingCatalogEntry` and `CategorizedPrefabs`.

## Design

### 1. Stage breakdown (permanent, and the baseline)

`[LENS-REFRESH]` gains `proj=<ms>(hit|miss) page=<ms> bounds=<ms>
facets=<ms> counts=<ms> axis=<ms> tabs=<ms> expanded=<ms> tiers=<ms>`
after the total. The adapter exposes `LastProjectionMs` and
`LastProjectionWasHit` for the first field; the rest are stopwatches around
each publish in `RefreshBuildingCatalog`. Task 1 ships only this plus §4,
deploys it to `949230-c`, and records the breakdown for the five menus, All
menus, and a search keystroke — the before-numbers.

### 2. Index generation and the snapshot cache

`PrefabIndexingSystem.IndexGeneration` (`public static int`, starts at 1)
increments — BEFORE the refresh that follows — at every point the indexed
facts change:

- end of `RunIndex`, full or partial, just before `_finditUISystem.TriggerSearch()`;
- `ApplyUnlocks`, when `changed > 0`, just before its `TriggerSearch()`;
- `OnUniqueAssetStatusChanged`, before `RefreshBuildingCatalogFromIndexing()`.

Silhouettes need no bump: `SilhouetteIconCache.UrlFor` generates on
demand, so a projection made before priming holds the same URL as one made
after.

`Services/SnapshotCache.cs` (new, pure): a `Dictionary<SnapshotKey,
BuildingCatalogEntry[]>` plus the generation it was filled at. `TryGet(key,
generation)` returns false and clears everything when `generation` differs
from the stored one; `Put(key, generation, entries)`. `SnapshotKey` is a
`readonly record struct` of `(string Menu, string DlcUnion, bool
IgnorePacks, string ThemesKey, string PacksKey, bool VanillaSelected, bool
ModsSelected)` — the toolbar selection by value, since
`VanillaToolbarSelection` is a struct holding lists. The adapter's
`_projections` dictionary and `BeginRefresh()`'s `Clear()` are replaced by
the cache; `BeginRefresh()` becomes a no-op kept for one release so the
call site reads unchanged, then deleted (it is deleted in this phase — the
system calls `Build` instead).

`GetFacetState`'s `GetIndexedBuildings(menu, ignorePackSelection: true)`
becomes the same cached projection under `IgnorePacks = true`, and is
requested only when `ToolbarSelection.SelectedPacks.Count > 0`; otherwise
the pack scope IS the ordinary snapshot.

### 3. `CatalogView`

`Services/CatalogView.cs` (new): constructed from `(BuildingCatalogEntry[]
snapshot, BuildingCatalogQuery query, Func<BuildingCatalogEntry[]>
packScope)`. It computes lazily and memoises:

- `MenuSet` — `InScope(snapshot, query with { UiCategory = "", StripTabs = null, SchoolTier = -1 })`, materialised. The one pass over the snapshot.
- `ViewSet` — `InScope(MenuSet, query)`; `TabSet` — `InScope(MenuSet, query with { StripTabs = null })`; `TierSet` — `InScope(MenuSet, query with { SchoolTier = -1, UiCategory = "" })`; `UnscopedSet` — `InScope(MenuSet, query with { UiCategory = "", StripTabs = null, SchoolTier = -1 })` (equals `MenuSet`; kept as a name so the derivations read like the code they replace).
- `Page` — `BuildingCatalogQueryEngine.Query(MenuSet, query)`.
- `MetricBounds` — `MetricBoundsOf(ViewSet)`.
- `FacetState` — `BuildFacetState(ViewSet, query, packScope needed ? InScope(packScope(), query) : ViewSet)`.
- `MenuCategoryCounts`, `ExpandedCategoryId`, `ExpandedCategoryTabs`, `ExpandedCategories`, `StripAxis`, `StripTabs`, `SchoolTierCounts` — the bodies of today's adapter methods, each reading the set it used to recompute (`MenuSet` for counts/expanded id/density; `TabSet` for `StripTabsFor`; the `GetStripTabs` building-nodes sub-call filters `TabSet` by `StripMatches(entry, BuildingValue)`; `TierSet` for tiers) and the memoised siblings instead of calling each other's public entry points.

The adapter gains `public CatalogView Build(BuildingCatalogQuery query)`
(snapshot lookup + view). Its public per-query methods
(`Query`, `GetMetricBounds`, `GetFacetState`, `GetMenuCategoryCounts`,
`GetExpandedCategoryId`, `GetExpandedCategoryTabs`, `GetExpandedCategories`,
`GetStripAxis`, `GetStripTabs`, `GetMenuSchoolTierCounts`) become one-line
delegations to `Build(query).X` so existing callers and tests hold.
`RefreshBuildingCatalog` calls `Build` once, and once more with `UiMenu =
""` only for `MatchesElsewhere` (its own snapshot key, also cached).

### 4. The engine enumerates once

`BuildingCatalogQueryEngine.Query` materialises `matching` with
`.ToArray()` before `Count()`, `Order(...)` and `ReorderableSortColumns`.

### 5. Out of scope

`BuildingCatalogEntry` (a cached projection costs once per generation;
deleting the type rewrites the engine and its tests for no measured gain),
`CategorizedPrefabs` as the store, the UI's groupBy push-back that makes a
first open refresh twice (cm-jjlv.8), and `Project` itself.

## Tests

- `SnapshotCacheTests`: same key + same generation hits; a different key
  misses; a new generation misses AND empties the cache; the key treats two
  equal toolbar selections as equal and a different pack list as different.
- `CatalogViewTests`: on the engine tests' `SampleEntries` (plus entries
  carrying `UiMenu`/`UiCategory`/`DevTreeBranch`/`EducationLevel`), every
  property equals the result of the static helpers it replaces
  (`MetricBoundsOf(InScope(...))`, `BuildFacetState(InScope(...))`,
  `BuildDensityTabs(...)`) and of the old derivations written out inline in
  the test — equivalence, not re-specification; and a property read twice
  runs its pass once (a counting `IEnumerable` around the snapshot).
- `QueryEnumeratesOnce`: a counting enumerable passed to `Query` is
  enumerated exactly once.
- `BindingManifestTests` unchanged (no binding changes).

## Live verification

`949230-c`, Porterville 3, same session as the Task-1 baseline: the five
menus and All menus give totals identical to phase 5's (Roads 403,
Landscaping 522, Health & Deathcare 31, Zones 74, Electricity 17, All
10,536); the second refresh inside a menu reads `proj=0ms(hit)`; typing
into the search box inside a menu does not project; the stage breakdown
before/after is recorded side by side in `docs/verification.md`, and
`[LENS-REFRESH]` for All menus is under 150 ms on the second refresh.
