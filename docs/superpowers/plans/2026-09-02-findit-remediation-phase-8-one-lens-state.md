# FindIt remediation phase 8 — one lens state — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The lens's player-facing state is one immutable record with one
tested transition per trigger; `FindItUISystem`'s handlers apply a
transition, publish the scope bindings from the record and refresh.

**Architecture:** `BuildingCatalogLensState` (Domain, already exists with
`Query` + `MetricRanges` + `ClearFilters`) gains `Menu`, `Category`,
`SchoolTier`, `SearchText` and sixteen transitions plus `Compose()`, which
is today's `RefreshBuildingCatalog` fold moved verbatim. The system keeps
one `_lens` field and two helpers (`PublishScope`, `Apply`). The smoke
gains a scope section that narrows Roads by tab and by category, resets,
and picks a school tier — the live proof.

**Tech Stack:** C# net48 / LangVersion 11 (records, `with`); xunit on
net10.0 (`just test findit-building-menu`); node for the smoke.

**Spec:** `docs/superpowers/specs/2026-09-02-findit-remediation-phase-8-one-lens-state-design.md`

## Global Constraints

- Branch `findit/phase-8-one-lens-state`, stacked on
  `findit/cm-jjlv-12-default-grouping` (merge .12 first, then this).
- Nothing the lens shows changes. No binding is added, removed or renamed
  (`BindingManifestTests` unchanged).
- A transition that changes nothing returns `this` (reference-equal), and
  `Apply` skips the refresh on it.
- Beads cm-jjlv.13.1–.4; close each on commit; commit trailers as in the
  earlier phases.

---

### Task 1: The transitions (cm-jjlv.13.1)

**Files:**
- Modify: `FindIt/Domain/BuildingCatalogLensState.cs`
- Test: `FindItBuildingMenu.Tests/BuildingCatalogLensStateTests.cs`

**Interfaces (Produces):** the record and the seventeen methods named in
the spec's table, exact names: `SelectMenu`, `ClearMenuScope`,
`SelectCategory`, `SelectStripTab`, `SelectSchoolTier`, `SetSortColumn`,
`SetDescending`, `SetGroupBy`, `LoadMore`, `ToggleFacet`, `ClearFacets`,
`ClearFilters`, `ResetMenu`, `SetMetricRange`, `ClearMetricRanges`,
`Search`, `Compose`; plus `static BuildingCatalogLensState Initial =>
new(new BuildingCatalogQuery(), BuildingCatalogMetricRangeState.Empty)`.

- [ ] **Step 1: Tests first** — add to `BuildingCatalogLensStateTests`
  (helper `S()` = `BuildingCatalogLensState.Initial`):
  - selecting a menu forgets the category, the tab and the tier, and resets the window (`S().SelectCategory("Healthcare").SelectStripTab("Hospital").SelectSchoolTier(2) with { Query = … Offset 100, Limit 300 }` then `.SelectMenu(" Roads ")` → Menu "Roads", Category "", StripTabs null, SchoolTier -1, Offset 0, Limit 100);
  - a blank menu clears the scope (`SelectMenu("  ")` equals `ClearMenuScope()` field-wise);
  - a strip tab and a category exclude each other (`SelectStripTab("Bridges").SelectCategory("Roads")` → StripTabs null; `SelectCategory("Roads").SelectStripTab("Bridges")` → Category "");
  - a school tier clears the category and clamps below zero to -1;
  - a blank strip tab clears the tabs; a blank category clears the category;
  - sort column: blank → same instance; a column resets the window; descending equal → same instance; group equal (after trim) → same instance;
  - Load more grows by `WindowStep` to `MaxLimit` and not past (at `MaxLimit` → same instance);
  - Reset keeps the menu and drops facets, metric ranges, search, sort, direction, grouping, category, tab, tier, and resets the window;
  - Search strips CR/LF and returns the same instance for an equal text;
  - SetMetricRange with an unparsable value → same instance; a parsable one lands in both `MetricRanges` and the query (`MinConstructionCost`); ClearMetricRanges empties both;
  - Compose folds Menu/Category/SchoolTier/SearchText and every Min/Max into the query, floors the limit at `DefaultLimit`, and resets the window when a predicate moved but keeps a grown window when none did (use `ResetWindowIfPredicatesChanged`'s own semantics: grow to 300 with `LoadMore` twice, `Compose()` again with nothing changed → Limit 300; `Search("x").Compose()` → Limit 100).
- [ ] **Step 2: Run** — red on the missing members.
- [ ] **Step 3: Implement** the record per the spec table. `Compose()`:
  ```csharp
  public BuildingCatalogLensState Compose()
  {
      var composed = Query with
      {
          SearchText = SearchText,
          UiMenu = Menu,
          UiCategory = Category,
          SchoolTier = SchoolTier,
          MinConstructionCost = MetricRanges.MinCost, MaxConstructionCost = MetricRanges.MaxCost,
          MinUpkeep = MetricRanges.MinUpkeep, MaxUpkeep = MetricRanges.MaxUpkeep,
          MinWorkers = MetricRanges.MinWorkers, MaxWorkers = MetricRanges.MaxWorkers,
          MinCapacity = MetricRanges.MinCapacity, MaxCapacity = MetricRanges.MaxCapacity,
          MinLotWidth = ToNullableInt(MetricRanges.MinLotWidth), MaxLotWidth = ToNullableInt(MetricRanges.MaxLotWidth),
          MinLotDepth = ToNullableInt(MetricRanges.MinLotDepth), MaxLotDepth = ToNullableInt(MetricRanges.MaxLotDepth),
      }.ResetWindowIfPredicatesChanged(Query);
      if (composed.Limit < BuildingCatalogQuery.DefaultLimit) composed = composed with { Limit = BuildingCatalogQuery.DefaultLimit };
      return this with { Query = composed };
  }
  ```
  (`ToNullableInt` moves here from `FindItUISystem.Methods.cs`.) Window
  reset helper: `private BuildingCatalogQuery Reset(BuildingCatalogQuery q) => q with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };`.
- [ ] **Step 4: Run** — green; commit `refactor(findit): the lens state carries its scope and search, with one tested transition per trigger (cm-jjlv.13.1)`; close 13.1.

---

### Task 2: The system applies the state (cm-jjlv.13.2)

**Files:**
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs` (fields), `FindItUISystem.Bindings.cs` (every handler), `FindItUISystem.Methods.cs` (`RefreshBuildingCatalog`, `TriggerSearch`/`ClearSearch`, the search debounce's callback, `ToNullableInt`).

- [ ] **Step 1: Fields** — delete `_buildingCatalogQuery`, `_buildingMetricRanges`, `_buildingLensUiMenu`, `_buildingLensUiCategory`, `_buildingLensSchoolTier`; add `private BuildingCatalogLensState _lens = BuildingCatalogLensState.Initial;`. `grep -n` each old name across `FindIt/` and replace every read: `_buildingCatalogQuery` → `_lens.Query`, `_buildingMetricRanges` → `_lens.MetricRanges`, `_buildingLensUiMenu` → `_lens.Menu`, `_buildingLensUiCategory` → `_lens.Category`, `_buildingLensSchoolTier` → `_lens.SchoolTier`.
- [ ] **Step 2: Helpers** in `Bindings.cs`:
  ```csharp
  private void PublishScope()
  {
      _BuildingLensMenuCategoriesBinding.Value = PrefabIndexingSystem.GetMenuCategories(string.IsNullOrEmpty(_lens.Menu) ? null : _lens.Menu).ToArray();
      _BuildingLensMenuBinding.Value = _lens.Menu;
      _BuildingLensMenusBinding.Value = PrefabIndexingSystem.GetAssetMenus().ToArray();
      _BuildingLensMenuCategoryBinding.Value = _lens.Category;
      _BuildingLensMenuSchoolTierBinding.Value = _lens.SchoolTier;
      _BuildingLensStripTabBinding.Value = _lens.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
      _CurrentSearch.Value = _lens.SearchText;
  }
  private void Apply(BuildingCatalogLensState next, bool navigation = false)
  {
      if (ReferenceEquals(next, _lens)) return;
      _lens = next;
      PublishScope();
      if (navigation) RefreshBuildingLensNavigation();
      RefreshBuildingCatalog();
  }
  ```
- [ ] **Step 3: Handlers** — `SetBuildingLensMenu(name)` → `Apply(_lens.SelectMenu(name), navigation: true)`; `ClearBuildingLensMenuScope` → `Apply(_lens.ClearMenuScope(), navigation: true)`; `SetBuildingLensMenuCategory` → `Apply(_lens.SelectCategory(category))`; `SetBuildingLensStripTab` → `Apply(_lens.SelectStripTab(tab))`; `SetBuildingLensMenuSchoolTier` → `Apply(_lens.SelectSchoolTier(tier))`; `SetBuildingCatalogSortColumn` → `Apply(_lens.SetSortColumn(column))`; `SetBuildingCatalogGroupBy` → `Apply(_lens.SetGroupBy(groupBy))`; `SetBuildingCatalogSortDescending` → `Apply(_lens.SetDescending(descending))`; `LoadMoreBuildingCatalog` → `Apply(_lens.LoadMore())`; `ToggleBuildingLensFacet` → `Apply(_lens.ToggleFacet(facetId, optionId))`; `ClearBuildingLensFacets` → `Apply(_lens.ClearFacets())`; `ClearBuildingLensFilters` → `Apply(_lens.ClearFilters())`; `ResetBuildingLensMenu` → `Apply(_lens.ResetMenu())`; `SetBuildingCatalogMetricRange` → `Apply(_lens.SetMetricRange(metricId, minText, maxText))`; `ClearBuildingCatalogMetricRanges` → `Apply(_lens.ClearMetricRanges())`; `SearchEverything` → `_lens = _lens.ClearMenuScope(); PublishScope(); RefreshLens();`; `ReleaseMenuScope` → `_lens = _lens.ClearMenuScope(); PublishScope();` (its callers keep their toolbar side effects); `VanillaMenuSelected` → replace its five scope lines with `_lens = _lens.SelectMenu(menuName); PublishScope();`; `SearchChanged(text)` → `var next = _lens.Search(text); if (ReferenceEquals(next, _lens)) return; _lens = next; _CurrentSearch.Value = _lens.SearchText; _CurrentSearch.ForceUpdate(); TriggerSearch();`; `ClearSearch` → `_lens = _lens.Search(string.Empty); _ClearSearchBar.Value = true; _searchDebounce.Cancel(); _IsSearchLoading.Value = false; _CurrentSearch.Value = string.Empty; RefreshBuildingCatalog();`. Delete `RefreshBuildingLensMenuCategories`, `PublishBuildingLensStripTabs`, `ResetBuildingLensStripTab`, `ResetBuildingLensSchoolTier`.
- [ ] **Step 4: Refresh** — `RefreshBuildingCatalog` replaces the fold (`previousQuery` … `Limit` floor) with `_lens = _lens.Compose();` and reads `_lens.Query` after; the `[LENS-REFRESH]` line and everything after are unchanged. `ToNullableInt` goes (moved). Any other reader of `_CurrentSearch.Value` as a source becomes `_lens.SearchText`.
- [ ] **Step 5:** `just test findit-building-menu` green (C# compiles; `BindingManifestTests` unchanged); `just build findit-building-menu` succeeds; commit `refactor(findit): FindItUISystem keeps one lens state and its handlers only apply it (cm-jjlv.13.2)`; close 13.2.

---

### Task 3: The smoke's scope section (cm-jjlv.13.3)

**Files:**
- Modify: `tools/e2e/findit-lens-smoke.mjs`, `findit-lens-smoke-lib.mjs`, `findit-lens-smoke.test.js`

- [ ] **Step 1: Test** — `evaluate` over `readings.scope = { menu: "Roads", menuTotal: 403, tab: { id, total }, category: { id, total, tabAfter: [] }, reset: { category, tabs, total }, tier: { menu: "Education & Research", menuTotal, tier: 1, total } }` fails when a narrowed total is 0 or above the menu total, when `category.tabAfter` is non-empty, when `reset.total !== menuTotal` or `reset.category !== ""`, when `tier.total > tier.menuTotal`; passes on a clean reading; `report` prints a scope table.
- [ ] **Step 2: Lib** — implement; `report` adds `## Scope` with one row per step.
- [ ] **Step 3: Script** — after the search section: open Roads; read `BuildingLensStripTabs` (the strip's tabs) → first id; trigger `SetBuildingLensStripTab [id]` observing `BuildingLensStripTab`; wait; read `BuildingLensStripTab` + page total; read `BuildingLensMenuCategories` → first id; trigger `SetBuildingLensMenuCategory [id]`; read `BuildingLensMenuCategory`, `BuildingLensStripTab`, total; trigger `ResetBuildingLensMenu []`; read category, tabs, total; close; open Education & Research; trigger `SetBuildingLensMenuSchoolTier [1]`; read `BuildingLensMenuSchoolTier` + total; trigger `SetBuildingLensMenuSchoolTier [-1]`; close. (Binding names: confirm each against `FindItUISystem.Setup.cs`'s `CreateBinding`/`CreateTrigger` lists before wiring.)
- [ ] **Step 4:** `just e2e` green; commit `test(e2e): the smoke narrows a menu by tab and by category, resets, and picks a school tier (cm-jjlv.13.3)`; close 13.3.

---

### Task 4: Live, docs, close, merge (cm-jjlv.13.4)

- [ ] Build, deploy to `949230-c` (gated), launch, load Porterville 3; run the smoke → exit 0 with the scope section; stop the game.
- [ ] `docs/verification.md`: header's last-run line updated; section `## 2026-09-02 — one lens state (phase 8)` with the smoke report and the transition list; note cm-jjlv.12's Electricity reading.
- [ ] Close cm-jjlv.13.4, cm-jjlv.13, cm-jjlv.12; merge `.12` then phase 8 into master in the main checkout, test the merged tree (`just test findit-building-menu`, `just e2e`), push; update memory.
