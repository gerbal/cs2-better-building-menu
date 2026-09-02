# FindIt remediation phase 8 — one lens state, and handlers that only apply it

**Bead:** cm-jjlv.13 (epic cm-jjlv). **Argues from:** finding 9 of
`2026-09-01-architecture-review.md` ("every `FindItUISystem` handler" is
untested) and finding 7 (state holders with no owner). **Follows:** phase 7,
which put the UI under test and left the C# system's handlers as the last
untested seam the review scheduled nothing for.

## What is wrong

`FindItUISystem` answers twenty triggers. Each handler edits some of five
fields — `_buildingCatalogQuery`, `_buildingMetricRanges`,
`_buildingLensUiMenu`, `_buildingLensUiCategory`, `_buildingLensSchoolTier` —
writes the bindings that mirror them, and calls a refresh, and the
refresh (`RefreshBuildingCatalog`) folds the three scope fields, the
search binding's value and the metric ranges back INTO the query with a
25-line `with { … }` before it runs. The scoping rules the lens lives by
— selecting a menu clears the category, the strip tab and the school
tier; a strip tab clears the category; a category clears the tab and the
tier; Reset clears filters, search, sort and grouping but keeps the menu;
Search everything drops the scope; grouping and sort changes shrink the
window — exist only as that scatter, inside a `GameSystemBase` the test
project cannot instantiate (no Unity reference). A regression in any of
them looks exactly like the bugs this remediation spent phases 2 and 4
on, and nothing would catch it before a live run.

`BuildingCatalogLensState` already exists (`Query` + `MetricRanges`, one
transition: `ClearFilters`). It is the right seam, one field short of
holding the whole state.

## Decision

The lens's whole player-facing state is one immutable record with one
transition per trigger, tested in isolation. The system keeps one field of
that type; each handler applies a transition, publishes the scope
bindings from the record, and refreshes. Nothing the lens shows changes.

`PrefabIndexingSystem` stays as it is: its extraction reads prefab
components through Unity's ECS and cannot run under xunit; the scripted
smoke's per-menu totals and the `[MENU-AUDIT]`/`[MENU-COVERAGE]` log
lines are its check, and a pure-helper extraction there would move code
without adding a test that could fail on the bugs it has had. The
adapter's instance path is `Build` over `CatalogView` (tested) and a
`TryGet` over the static index; unchanged.

## Design

### 1. The state — `Domain/BuildingCatalogLensState.cs`

```csharp
public sealed record BuildingCatalogLensState(
    BuildingCatalogQuery Query,
    BuildingCatalogMetricRangeState MetricRanges,
    string Menu = "",          // the game's menu the lens stands in for; "" = unscoped
    string Category = "",      // the menu's category; "" = all
    int SchoolTier = -1,       // -1 = all
    string SearchText = "")    // what the player typed, CR/LF stripped
```

Transitions, each returning a new record — or `this` when nothing would
change, so a handler can skip the refresh:

| Transition | Effect (beyond the field it names) |
|---|---|
| `SelectMenu(string? name)` | blank → `ClearMenuScope()`; else `Menu` trimmed, `Category` "", `StripTabs` null, `SchoolTier` -1, window reset |
| `ClearMenuScope()` | `Menu`/`Category` "", `StripTabs` null, `SchoolTier` -1, window reset |
| `SelectCategory(string? id)` | `Category` = id ?? "", `StripTabs` null, `SchoolTier` -1, window reset |
| `SelectStripTab(string? tab)` | `Category` "", `StripTabs` = blank ? null : `[tab]`, window reset |
| `SelectSchoolTier(int tier)` | `Category` "", `SchoolTier` = tier < 0 ? -1 : tier, window reset |
| `SetSortColumn(string? column)` | blank → `this`; else `SortColumn`, window reset |
| `SetDescending(bool)` | equal → `this`; else set, window reset |
| `SetGroupBy(string? id)` | trimmed; equal → `this`; else set, window reset |
| `LoadMore()` | `Limit` ≥ `MaxLimit` → `this`; else `Limit` = min(`Limit` + `WindowStep`, `MaxLimit`) |
| `ToggleFacet(string facetId, string optionId)` | `BuildingCatalogFacetSelection.Toggle`; unchanged query → `this` |
| `ClearFacets()` | `BuildingCatalogFacetSelection.Clear` |
| `ClearFilters()` | as today (facets + metric ranges) |
| `ResetMenu()` | `ClearFilters()`, then `Category` "", `StripTabs` null, `SchoolTier` -1, `SearchText` "", `SortColumn` "", `Descending` false, `GroupBy` "", window reset |
| `SetMetricRange(string metricId, string minText, string maxText)` | unparsable → `this`; else `MetricRanges.With(range)` and `BuildingCatalogMetricRange.Apply` on the query |
| `ClearMetricRanges()` | `MetricRanges` Empty, `BuildingCatalogMetricRange.Clear` on the query |
| `Search(string? text)` | CR/LF stripped; equal → `this`; else `SearchText` |
| `Compose()` | the query to run: `Query with { SearchText, UiMenu = Menu, UiCategory = Category, SchoolTier, the twelve Min/Max metric fields from MetricRanges }`, then `ResetWindowIfPredicatesChanged(Query)` and the `DefaultLimit` floor — today's `RefreshBuildingCatalog` block, verbatim; returned as a state whose `Query` is the composed one |

"Window reset" is `Offset = 0, Limit = DefaultLimit`, exactly where the
handlers do it today (`LoadMore`, `ToggleFacet`, `ClearFacets`,
`SetMetricRange`, `ClearMetricRanges`, `Search` do not).

### 2. The system

`FindItUISystem` replaces the five fields with one `_lens`
(`BuildingCatalogLensState`). Two private helpers:

- `PublishScope()` — writes `BuildingLensMenu`, `BuildingLensMenuCategory`,
  `BuildingLensMenuSchoolTier`, `BuildingLensStripTab`,
  `BuildingLensMenuCategories` (from `PrefabIndexingSystem.GetMenuCategories(menu)`)
  and `BuildingLensMenus` from `_lens`; replaces
  `RefreshBuildingLensMenuCategories`, `PublishBuildingLensStripTabs` and the
  per-handler binding writes.
- `Apply(BuildingCatalogLensState next, bool navigation = false)` — if
  `ReferenceEquals(next, _lens)` return; assign; `PublishScope()`;
  `RefreshBuildingLensNavigation()` when asked; `RefreshBuildingCatalog()`.

Handlers become one line each (`SetBuildingLensMenu` →
`Apply(_lens.SelectMenu(menuName), navigation: true)`; `SearchChanged` →
`Apply(_lens.Search(text))` plus the debounce it drives today;
`CloseLens`/`VanillaMenuDeselected`/`SearchEverything` →
`_lens.ClearMenuScope()` with their toolbar side effects unchanged).
`RefreshBuildingCatalog` starts with `_lens = _lens.Compose();` and runs
`_lens.Query`. `_CurrentSearch` is published from `_lens.SearchText`
rather than read back as a source. No binding is added, removed or
renamed: `BindingManifestTests` is unchanged.

`VanillaMenuSelected`'s echo guard, settings checks and toolbar ownership
stay in the system — they are about the game, not the state.

### 3. Tests

- `BuildingCatalogLensStateTests` gains one fact per transition, named by
  the rule it pins ("selecting a menu forgets the category, the tab and
  the tier", "a strip tab and a category exclude each other", "Reset keeps
  the menu and drops everything the player narrowed", "Search everything
  drops the scope and keeps the search", "grouping and sort changes shrink
  the window back to one chunk; Load more grows it to the ceiling and not
  past", "a no-op transition returns the same instance", "Compose folds
  the scope, the search and every metric bound into the query and resets
  the window when a predicate moved").
- The smoke (`tools/e2e/findit-lens-smoke.mjs`) gains a **scope** section
  so the refactor is proved live: inside Roads, select the first strip tab
  (`SetBuildingLensStripTab`) and read `BuildingLensStripTab` + the total;
  select the first category (`SetBuildingLensMenuCategory`) and read
  `BuildingLensMenuCategory` + the total, with the tab now empty; Reset
  (`ResetBuildingLensMenu`) and read the category empty, the tabs empty
  and the total back to the menu's; inside Education & Research select
  tier 1 (`SetBuildingLensMenuSchoolTier`) and read the tier and a total
  no larger than the menu's. `evaluate` pins: each narrowing is ≤ the menu
  total and > 0; a category clears the tab; Reset restores the menu
  total.

### 4. Out of scope

`PrefabIndexingSystem` (above). The adapter's static `ToolbarSelection`
and the other static holders of finding 7. `SetLensMenuOpen`'s
`TryActivatePrefabTool` path.

## Live verification

`949230-c`, Porterville 3: the smoke green with its new scope section
(Roads narrowed by a tab and by a category, Reset restoring 403;
Education tier 1 ≤ 43), six menus one refresh each, totals unchanged
(Roads 403, Landscaping 522, Health 31, Zones 74, Electricity 17,
Education 43, All 10,536), search `tre` 13, zero exceptions. Electricity
now opens on `development` (cm-jjlv.12, same run).
