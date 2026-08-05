# Building Lens Filter Facets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded, typed static building facets for role, provenance, and placement/access to the FindIt successor Building Lens.

**Architecture:** Enrich the existing FindIt prefab index during its current pass, project normalized facet values through the bounded catalog entry, and apply a pure facet-selection contract before paging. A separate `BuildingLensFacets` binding feeds a compact React drawer; legacy FindIt options and placement bindings remain unchanged.

**Tech Stack:** C# 11/net48, Unity ECS prefab components, Colossal `IJsonWritable`, React/TypeScript, Coherent Gameface-compatible flexbox/rem CSS, Node contract tests, xUnit backend tests.

## Global Constraints

- Reuse the existing FindIt index; do not add a second unbounded ECS scan.
- Preserve `net48`, C# `11.0`, and the `IsExternalInit` polyfill.
- Multi-select values OR within a facet and AND across facets.
- Missing component data remains missing and never becomes an implied zero.
- Keep runtime/map-context filters out of this slice.
- Do not touch the older `cs2-building-menu-overhaul` project.
- Run `npm test`, `./build.sh test`, `npm run build`, and isolated deployment before claiming completion.

---

### Task 1: Define facet contracts and prove matching semantics

**Files:**
- Create: `FindIt/Domain/BuildingCatalogFacet.cs`
- Modify: `FindIt/Domain/BuildingCatalogEntry.cs`
- Modify: `FindIt/Domain/BuildingCatalogQuery.cs`
- Modify: `FindIt/Services/BuildingCatalogQueryEngine.cs`
- Test: `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`

**Interfaces:**
- `BuildingCatalogFacetOption(string Id, string Label, bool Selected)` — one serializable UI option.
- `BuildingCatalogFacetGroup(string Id, string Label, BuildingCatalogFacetOption[] Options)` — one bounded facet group.
- `BuildingCatalogFacetState(BuildingCatalogFacetGroup[] Groups, bool HasSelection)` — UI binding payload.
- `BuildingCatalogQuery` gains `IReadOnlyList<string>? BuildingTypes`, `IReadOnlyList<string>? DlcIds`, `IReadOnlyList<string>? Themes`, `IReadOnlyList<string>? AssetPacks`, and `IReadOnlyList<string>? PlacementFlags`.
- `BuildingCatalogEntry` gains nullable/empty-normalized `BuildingType`, `DlcId`, `Theme`, `AssetPacks`, and `PlacementFlags` values.

- [ ] **Step 1: Write failing backend tests**

Add tests with in-memory entries for:

```csharp
[Fact]
public void Query_FacetValuesOrWithinFacetAndAcrossFacets()
{
    var entries = new[]
    {
        Entry(buildingType: "School", theme: "European", placementFlags: new[] { "RequireRoad" }),
        Entry(buildingType: "Hospital", theme: "European", placementFlags: new[] { "RequireRoad" }),
        Entry(buildingType: "School", theme: "Modern", placementFlags: Array.Empty<string>()),
    };

    var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(
        BuildingTypes: new[] { "School", "Hospital" },
        Themes: new[] { "European" },
        PlacementFlags: new[] { "RequireRoad" }));

    Assert.Equal(2, page.TotalCount);
}

[Fact]
public void Query_MissingFacetValuesDoNotMatchSelectedValues()
{
    var page = BuildingCatalogQueryEngine.Query(
        new[] { Entry(buildingType: null, theme: null, placementFlags: Array.Empty<string>()) },
        new BuildingCatalogQuery(BuildingTypes: new[] { "School" }));

    Assert.Empty(page.Items);
}
```

- [ ] **Step 2: Run the focused tests and verify the expected red failure**

Run `./build.sh test --filter BuildingCatalogQueryEngineTests` from
`cs2-findit-building-menu/`. The new tests must fail because the query and
entry contracts do not yet expose facet fields.

- [ ] **Step 3: Implement the minimal contracts and matcher**

Add nullable/empty-safe facet fields to the records. In `Matches`, use a helper
with this behavior:

```csharp
private static bool MatchesAny(string? value, IReadOnlyList<string>? selected)
{
    return selected is null || selected.Count == 0
        || (value is not null && selected.Contains(value, StringComparer.OrdinalIgnoreCase));
}
```

Match placement flags by requiring every selected flag (a building must satisfy
all selected access constraints), while categorical role/theme/DLC/pack values
match any selected value.

- [ ] **Step 4: Run the focused tests and verify green**

Run the same focused command. Confirm the new facet tests and existing catalog
tests pass.

- [ ] **Step 5: Refactor only after green**

Extract repeated string-array matching or JSON-writing helpers only if the
focused tests remain green; do not add untested facet behavior in this step.

### Task 2: Populate facets from the existing prefab index

**Files:**
- Modify: `FindIt/Domain/PrefabIndex.cs`
- Modify: `FindIt/Systems/PrefabIndexingSystem.cs`
- Modify: `FindIt/Services/BuildingCatalogAdapter.cs`
- Modify: `FindIt/Domain/BuildingCatalogEntry.cs`
- Test: `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`

**Interfaces:**
- `PrefabIndex.BuildingTypeName: string?` and `PrefabIndex.BuildingFlagsValue: uint?` are populated during `AddPrefab`.
- `BuildingCatalogAdapter.Project` normalizes source values and maps known `BuildingFlags` bits to stable names.
- `BuildingCatalogAdapter.GetFacetState(BuildingCatalogQuery query)` returns bounded groups from the existing indexed building sequence.

- [ ] **Step 1: Write failing projection/flag tests**

Add a pure projection test fixture that verifies the adapter's placement-flag
normalizer maps `BuildingFlags.RequireRoad | BuildingFlags.CanBeOnRoad |
BuildingFlags.RestrictedCar` to `RequireRoad`, `CanBeOnRoad`, and
`RestrictedCar`, while a null bitmask produces no flags. The test should call
the normalizer directly so it does not require a live `EntityManager`.

- [ ] **Step 2: Run the focused test and verify red**

Run `./build.sh test --filter BuildingCatalogQueryEngineTests`; the test must
fail because the projection normalizer and flag map do not exist.

- [ ] **Step 3: Populate role and flags during `AddPrefab`**

In the existing `AddPrefab(PrefabBase prefab, Entity entity, PrefabIndex prefabIndex)`
path, read `BuildingMarkerData` and `BuildingData` through the current
`EntityManager`. Store `BuildingType.ToString()` when present and the raw
`BuildingFlags` value when present. Do not query any other entity set.

- [ ] **Step 4: Project normalized source facets**

Project DLC ID/name, theme name, and asset-pack names from the existing
`PrefabIndex` values. Use empty arrays/strings for missing values and preserve
the existing `IsVanilla` field for provenance. Use a fixed `BuildingFlags`
name map so UI and tests do not depend on enum reflection order.

- [ ] **Step 5: Add bounded facet-state generation**

Build distinct role, DLC, theme, pack, and placement-flag options from the
indexed building sequence. Sort labels ordinally, mark selected values from
the active query, and omit groups with no options. Reuse the adapter's indexed
sequence so state generation does not introduce an ECS scan.

- [ ] **Step 6: Run backend tests and verify green**

Run `./build.sh test`; confirm projection, facet-state, matcher, JSON, and all
existing tests pass.

### Task 3: Add C# bindings and selection lifecycle

**Files:**
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs`
- Modify: `FindIt/Systems/FindItUISystem.Bindings.cs`
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs`
- Modify: `FindIt/Domain/BuildingCatalogQuery.cs`
- Test: `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`

**Interfaces:**
- Binding: `BuildingLensFacets` (`BuildingCatalogFacetState`).
- Trigger: `ToggleBuildingLensFacet(string facetId, string optionId)`.
- Trigger: `ClearBuildingLensFacets()`.

- [ ] **Step 1: Add a failing binding-state contract test**

Add a pure selection test that toggles `role=School` twice, verifies selected
state is added then removed, toggles two roles, and confirms clear returns all
facet selections to empty.

- [ ] **Step 2: Run the focused test and verify red**

Run `./build.sh test --filter BuildingCatalogQueryEngineTests`; the selection
helper must be absent or fail its expected state assertions.

- [ ] **Step 3: Implement selection state and triggers**

Keep a private `BuildingCatalogQuery` facet selection in `FindItUISystem`.
Validate facet IDs against the known groups, toggle values case-insensitively,
reset `Offset` to zero, then refresh the catalog and facet binding. Ignore
unknown values without throwing.

- [ ] **Step 4: Publish state during every catalog refresh**

Initialize the binding with an empty state, then update it beside
`_BuildingCatalogBinding` in `RefreshBuildingCatalog`. `ClearBuildingLensFacets`
resets only Lens facets; the existing FindIt `ClearFilters` remains separate.

- [ ] **Step 5: Run backend tests/build and verify green**

Run `./build.sh test` and `./build.sh backend`; confirm bindings compile and all
tests pass.

### Task 4: Build the bounded facet drawer in React

**Files:**
- Create: `FindIt/UI/src/domain/buildingCatalogFacets.ts`
- Create: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalogFacetPanel.tsx`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss`
- Test: `FindIt/UI/test/buildingLensUx.test.ts`

**Interfaces:**
- `BuildingLensFacetState`, `BuildingLensFacetGroup`, and `BuildingLensFacetOption` mirror the C# JSON shape.
- `toggleBuildingLensFacetCommand(facetId: string, optionId: string)` returns `{ method: "ToggleBuildingLensFacet", args: [facetId, optionId] }`.
- `clearBuildingLensFacetsCommand()` returns `{ method: "ClearBuildingLensFacets", args: [] }`.

- [ ] **Step 1: Write failing UI contract tests**

Add tests for exact toggle/clear trigger payloads and a pure selected-state
helper that renders selected options and reports whether any facet is active.

- [ ] **Step 2: Run the UI test and verify red**

Run `(cd FindIt/UI && npm test -- --test-name-pattern='facet')`; verify it fails
because the facet command/state helpers do not yet exist.

- [ ] **Step 3: Implement typed UI helpers and panel**

Render one compact group per facet with selected buttons, a visible Clear
button when any selection is active, and an explicit open/close button. Use
`bindValue` for `BuildingLensFacets` and `trigger` for the two commands. Keep
the panel inside the bounded catalog content and use flexbox/rem CSS only.

- [ ] **Step 4: Integrate without disturbing existing controls**

Place the facet button beside the Lens sort controls. Preserve the existing
FindIt OptionsPanel and all placement/compare/paging paths. Reset paging to the
first page after a facet toggle through the C# trigger.

- [ ] **Step 5: Run UI tests and build**

Run `(cd FindIt/UI && npm test)` and `(cd FindIt/UI && npm run build)`; confirm
all existing and new tests pass and the bundle compiles.

### Task 5: Verify package and live filter behavior

**Files:**
- Modify: `docs/verification.md`
- Modify: `docs/roadmap.md`
- Modify: `README.md`

- [ ] **Step 1: Run all local quality gates**

Run `./build.sh test`, `(cd FindIt/UI && npm test)`,
`(cd FindIt/UI && npm run build)`, `./scripts/codex-just.sh build`, and
`./scripts/codex-just.sh e2e`.

- [ ] **Step 2: Deploy in isolation**

Run `just deploy-isolated findit-building-menu`; confirm both Mods roots receive
only the diagnostics and successor payloads and the identity guard passes.

- [ ] **Step 3: Verify the live state safely**

Run `just cs2-status` before any game action. If the existing adopted process
is still live, reload the UI without killing it; otherwise use the canonical
`just launch-cs2 codex-building-lens-facets-1 --check-menu` path. Open the
Building Lens, select a role or placement facet, confirm the count changes,
clear the facet, confirm restoration, and inspect the Gameface exception buffer.

- [ ] **Step 4: Record evidence and close the bead**

Record test counts, bundle/deploy results, facet counts, and artifact paths in
`docs/verification.md`. Comment the bead at each milestone, then close it only
after all acceptance criteria are evidenced.
