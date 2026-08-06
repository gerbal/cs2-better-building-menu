# Vanilla Build Menu Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Building Lens use a vanilla-aligned building taxonomy with independent section state, so every visible lens category changes the building table and the legacy FindIt asset browser remains unchanged when the lens is off.

**Architecture:** Keep FindIt's incremental prefab index as the only discovery source. A pure `VanillaBuildMenuTaxonomy` resolver projects indexed building/service records into stable lens section/subcategory IDs. The bounded catalog query matches those IDs (plus favorites) before facets, sorting, and paging. `FindItUISystem` owns separate lens selection bindings and leaves `FindItUtil.CurrentCategory`/`CurrentSubCategory` for the legacy browser. The React top bar chooses either the inherited FindIt bindings or the lens bindings from `BuildingLensEnabled`.

**Tech Stack:** C# 11/net48 game mod, xUnit/net10 pure tests, React/TypeScript, Coherent Gameface bindings, existing FindIt locale/icon assets.

## Global Constraints

- Do not add a second ECS scan or change prefab indexing ownership.
- Do not remove or reinterpret the inherited FindIt category tabs when the lens is disabled.
- A lens selection must never silently fall back to an unfiltered table. Invalid section/subcategory values normalize to `AllBuildings`/`Any`.
- Keep roads, lot tools, terraforming, pathways, vegetation, props, and other tool-first vanilla surfaces out of this first building-record slice; create follow-up work instead of coercing them into building rows.
- Follow test-first sequencing for every production change: add a focused failing test, run it and capture the red result, implement the smallest fix, then rerun the focused test and the full suite.
- Preserve unrelated dirty worktree changes; do not reset, commit, or deploy over an existing target.

---

## 1. Establish the pure vanilla taxonomy and selection contract

**Files:**

- Add `FindIt/Domain/VanillaBuildMenuTaxonomy.cs`.
- Add `FindIt/Domain/VanillaBuildMenuSelection.cs`.
- Add `FindItBuildingMenu.Tests/VanillaBuildMenuTaxonomyTests.cs`.

**Interfaces and behavior:**

- Define stable string IDs in one place: `AllBuildings`, `Zones`, `SignatureBuildings`, `ServiceBuildings`, and `Favorites`; `Any` is the neutral subcategory.
- Define `VanillaBuildMenuTag(string Section, string SubCategory)` for projected records.
- `VanillaBuildMenuTaxonomy.Resolve(PrefabCategory category, PrefabSubCategory subCategory, ZoneTypeFilter zoneType)` returns:
  - `Zones` for regular indexed building subcategories (`Residential`, `Mixed`, `Commercial`, `Industrial`, `Office`, `Specialized`/extractors).
  - `SignatureBuildings` when `ZoneTypeFilter.Signature` is present, retaining the matching residential/mixed/commercial/industrial/office subcategory.
  - `ServiceBuildings` for every existing service subcategory, including FindIt's currently grouped Health/Deathcare, Police/Administration, Fire/Rescue, and Education/Research values.
  - `null` for network/tool/prop/vehicle records and unsupported miscellaneous building records; those remain reachable through `AllBuildings`.
- `VanillaBuildMenuSelection.Normalize(section, subCategory)` accepts only the above section IDs and valid subcategories for that section. It returns `AllBuildings`/`Any` for empty or invalid input and resets a subcategory to `Any` when switching section.
- Expose deterministic section descriptors and subcategory descriptors (ID, icon, tooltip) for the UI. Reuse existing `CategoryIconAttribute` paths and locale keys such as `FindItBuildingMenu.Buildings_Residential`, `ServiceBuildings_Health`, and `Favorite`; use `StarAll.svg` for the neutral All Buildings entry.

**Tests first:**

- Add a red test for regular residential, mixed, extractor, signature, service, and unsupported inputs.
- Add a red test proving `Normalize` rejects an arbitrary inherited category ID and a service subcategory under Zones.
- Add a red test asserting descriptor order is stable: sections (`All`, `Zones`, `Signature`, `Service`, `Favorites`), then vanilla subcategory order.
- Run from `cs2-findit-building-menu/FindItBuildingMenu.Tests`:
  `dotnet test --no-restore --filter FullyQualifiedName~VanillaBuildMenuTaxonomyTests -p:SkipBuildUI=true`.
- Implement the two pure domain files, rerun the focused test to green, then run the existing backend test project before proceeding.

**Acceptance:** taxonomy and normalization tests pass without loading a game world, and no UI/system file is needed to determine classification.

---

## 2. Project taxonomy into the bounded catalog query

**Files:**

- Modify `FindIt/Domain/BuildingCatalogEntry.cs`.
- Modify `FindIt/Domain/BuildingCatalogQuery.cs`.
- Modify `FindIt/Services/BuildingCatalogQueryEngine.cs`.
- Modify `FindIt/Services/BuildingCatalogAdapter.cs`.
- Modify `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`.

**Interfaces and behavior:**

- Append nullable `VanillaSection` and `VanillaSubCategory` fields to `BuildingCatalogEntry` so existing constructor call sites remain source-compatible. Serialize them as `vanillaSection` and `vanillaSubCategory` after the existing category fields, writing empty strings for null values.
- Append `BuildMenuSection` and `BuildMenuSubCategory` to `BuildingCatalogQuery`; keep the existing `Category`/`SubCategory` fields as the legacy FindIt query contract.
- In `BuildingCatalogAdapter.Project`, call the pure resolver with the prefab's category, subcategory, and zone type. Do not rescan ECS data.
- In `BuildingCatalogQueryEngine.Matches`, apply the build-menu predicate before facets/ranges:
  - empty or `AllBuildings` section matches every indexed building record;
  - `Favorites` matches `IsFavorited == true`;
  - other sections match `VanillaSection` case-insensitively;
  - a non-`Any` build-menu subcategory matches `VanillaSubCategory` case-insensitively.
- Keep invalid query IDs safe: normalize them through `VanillaBuildMenuSelection` at the system boundary and treat direct engine calls with unknown section IDs as matching zero records rather than silently matching all.
- Preserve existing ordering, facets, metric ranges, and page totals after the new predicate.

**Tests first:**

- Extend the existing sample entries with explicit taxonomy fields and add tests proving Zones, Signature, Service, Favorites, and subcategory queries return different IDs and correct unpaged totals.
- Add a test proving an invalid non-empty section returns an empty page and `AllBuildings` returns the full sample.
- Update the JSON writer property-name expectation for the two new fields.
- Run the focused backend tests and capture the expected red compile/assertion failure before changing production code; implement the query/adapter changes; rerun focused tests and then `./build.sh test`.

**Acceptance:** selecting a supported lens section changes `BuildingCatalogPage.Items`/`TotalCount`, favorites are a predicate rather than a category alias, and all prior search/facet/range/sort/page tests remain green.

---

## 3. Add independent lens state and bindings in `FindItUISystem`

**Files:**

- Add `FindIt/Domain/UIBinding/BuildingLensSectionUIEntry.cs`.
- Add `FindIt/Domain/UIBinding/BuildingLensSubCategoryUIEntry.cs`.
- Modify `FindIt/Systems/FindItUISystem.Setup.cs`.
- Modify `FindIt/Systems/FindItUISystem.Bindings.cs`.
- Modify `FindIt/Systems/FindItUISystem.Methods.cs`.

**Interfaces and behavior:**

- Add bindings named `BuildingLensSection`, `BuildingLensSubCategory`, `BuildingLensSectionList`, and `BuildingLensSubCategoryList` with string IDs and JSON fields `id`, `icon`, and `toolTip`.
- Add triggers `SetBuildingLensSection(string)` and `SetBuildingLensSubCategory(string)`; both normalize input, reset catalog offset to zero, refresh the lens subcategory list, and refresh the bounded query.
- Initialize lens state to `AllBuildings`/`Any` and publish the complete section list during `OnCreate`.
- `SetBuildingLensEnabled(true)` normalizes the cached lens selection, updates the lens lists, and refreshes the catalog. It must not mutate `FindItUtil.CurrentCategory` or `FindItUtil.CurrentSubCategory`.
- `SetBuildingLensEnabled(false)` leaves the last lens selection cached but refreshes the legacy lists; reopening the lens restores that normalized selection so closing the lens is not a destructive navigation action.
- `UpdateCategoriesAndPrefabList` continues to publish `CategoryList`/`SubCategoryList` from `FindItUtil` for the legacy browser and separately publishes lens lists.
- `RefreshBuildingCatalog` uses `BuildMenuSection`/`BuildMenuSubCategory` from lens state whenever the lens is enabled, and clears those fields when disabled. It retains shared search, parking, capacity, facet, sort, and paging values.
- Capacity-floor visibility becomes lens-section aware: only the grouped Education & Research service subcategory exposes it; switching to another lens section/subcategory clears the floor and query minimum.

**Tests first:**

- Add pure selection normalization coverage to `VanillaBuildMenuTaxonomyTests` before editing the system.
- Use the backend test suite as the contract check for binding-side query state; do not introduce a brittle game-world unit test for `ExtendedUISystemBase`.
- Build the backend after each focused change with `./build.sh backend` and run `./build.sh test` before UI work.

**Acceptance:** legacy category state is unchanged by lens clicks, lens selection always has a valid section/subcategory, switching selection resets offset, and the catalog query receives the new fields only while the lens is active.

---

## 4. Render the two tab systems in the React top bar

**Files:**

- Add `FindIt/UI/src/domain/vanillaBuildMenuContracts.ts`.
- Modify `FindIt/UI/src/domain/buildingCatalog.ts`.
- Modify `FindIt/UI/src/domain/buildingCatalogContracts.ts`.
- Modify `FindIt/UI/src/mods/TopBar/TopBar.tsx`.
- Modify `FindIt/UI/src/mods/TopBar/topBar.module.scss` only if the lens section labels need the existing tab bar's overflow/scroll affordance.
- Add `FindIt/UI/test/vanillaBuildMenuContracts.test.ts`.

**Interfaces and behavior:**

- Define TypeScript `VanillaBuildMenuSection`/`VanillaBuildMenuSubCategory` shapes matching the C# JSON bindings and add typed trigger helpers for `SetBuildingLensSection` and `SetBuildingLensSubCategory`.
- Keep `BuildingCatalogEntry` optional string fields for `vanillaSection` and `vanillaSubCategory` so older bundles/pages deserialize safely.
- In `TopBarComponent`, bind the four new values and choose render/selection handlers from `BuildingLensEnabled`:
  - lens on: render the vanilla section list and its subcategory list, dispatching the new string triggers;
  - lens off: render the existing numeric FindIt category/subcategory lists and dispatch the existing triggers unchanged.
- Ensure the selected lens tab is visibly selected, the first neutral All entry retains the existing spacer behavior, and long service subcategory rows use the existing horizontal overflow rather than painting over the catalog.
- Keep the existing lens toggle, search, filter, sorting, close, and inherited asset-browser controls intact.

**Tests first:**

- Add red contract tests for exact trigger payloads, section/subcategory selection IDs, and mode-specific selection helpers.
- Run `(cd FindIt/UI && npm test -- --test-name-pattern='Vanilla Build Menu')` (or the repository's equivalent Node test filter) and capture red output.
- Implement the contract helpers and TopBar binding/render changes, rerun the focused UI test, then run `(cd FindIt/UI && npm test)` and `./build.sh ui`.

**Acceptance:** in a live lens, clicking Zones/Signature/Service/Favorites changes the backend query and selected visual tab; when the lens is off, the original Networks/Buildings/Trees/Props/Vehicles tabs and numeric triggers behave exactly as before.

---

## 5. Verify the user path, build/package safety, and live behavior

**Files:**

- Modify `docs/verification.md` with a vanilla-taxonomy checklist and observed counts/screenshots if needed.
- Add a follow-up Beads issue discovered from `CS-Modding-b53.20` for deferred tool-first vanilla surfaces (roads/lot tool, terrain, pathways, vegetation, props) rather than adding them to this implementation.

**Checks:**

- Run `./build.sh backend`, `./build.sh test`, `./build.sh ui`, and `./build.sh all` from `cs2-findit-building-menu`.
- Run `./build.sh package` and inspect the package guard output; do not deploy into a live or foreign-owned Mods directory.
- Before any live check, run `just cs2-status`. The current game is externally launched/adopted by another agent; do not kill/restart it or touch its lock. If the already-running successor bundle can be refreshed safely, use the project isolated-deploy procedure and stop if it requests the foreign lock.
- With the lens open, verify the user path from FindIt icon → Building Lens toggle → section → subcategory → table; record that at least one count changes for Zones, Signature, Service, and Favorites, that an empty subcategory shows an explicit empty state, and that page offset resets to the first page.
- Close the lens, select Networks or another inherited tab, reopen the lens, and verify the legacy selection was not interpreted as a lens section.
- Verify the displayed count/page model remains bounded paging (`n / m`) rather than infinite scroll; retain existing scrollbar visibility work and note any follow-up visual issue instead of masking it in this taxonomy change.

**Acceptance:** backend/UI builds and tests are green, package identity remains successor-only, live section clicks demonstrably alter the table, and no legacy FindIt category behavior regresses.

---

## Definition of Done

- [ ] Pure taxonomy, normalization, query filtering, adapter projection, and JSON contracts have focused tests.
- [ ] Backend and UI test suites pass, followed by backend/UI/all builds.
- [ ] Beads comments record claim, red/green milestones, package result, and live verification state; the parent issue is not closed until all three verification layers are satisfied.
- [ ] Deferred tool-first surfaces have a linked follow-up issue and are not represented as misleading building rows.
- [ ] `docs/verification.md` contains the final user-path checklist and any live evidence.
