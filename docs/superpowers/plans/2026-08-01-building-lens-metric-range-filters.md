# Building Lens Metric Range Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Add a compact Building Lens drawer for bounded Cost, Upkeep, Workers, Capacity, Lot Width, and Lot Depth filters.

**Architecture:** Keep `BuildingCatalogQuery` and the existing bounded query engine as the backend source of truth. Add a pure TypeScript range contract for normalization and trigger payloads, a typed three-string Gameface trigger (`metricId`, `minText`, `maxText`), a normalized C# range-state binding, and a small controlled React drawer that composes with existing facets and resets the page offset. No second ECS scan or client-side unbounded list is introduced.

**Tech Stack:** C# 11/net48, Colossal UI bindings, React/TypeScript, Node test runner, xUnit/net10 contract tests, Coherent Gameface.

## Global Constraints

- Preserve the `FindItBuildingMenu` runtime/UI identity and existing FindIt placement, picker, and legacy category behavior.
- Keep all Gameface layout in rem/flexbox; do not add CSS grid or pixel-based geometry.
- Missing nullable analytical values do not match an active range.
- Use inclusive bounds, invariant-culture backend parsing, empty input as unset, and deterministic reversed-bound swapping.
- Keep the first slice to six metrics; utilities, pollution, runtime predicates, and map-context filters remain out of scope.
- Do not commit or push; the workspace is under the conservative git profile.

---

### Task 1: Define and test the pure UI range contract

**Files:**
- Create: `cs2-findit-building-menu/FindIt/UI/src/domain/buildingCatalogRanges.ts`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/domain/buildingCatalogContracts.ts`
- Test: `cs2-findit-building-menu/FindIt/UI/test/buildingCatalogContracts.test.ts`

**Interfaces:**
- `MetricRangeId = "cost" | "upkeep" | "workers" | "capacity" | "lotWidth" | "lotDepth"`.
- `MetricRangeInput = { minText: string; maxText: string }`.
- `NormalizedMetricRange = { min: number | null; max: number | null }`.
- `normalizeMetricRange(id, input): NormalizedMetricRange`.
- `hasMetricRange(range): boolean`.
- `setBuildingMetricRangeCommand(id, minText, maxText): TriggerCommand`.
- `clearBuildingMetricRangesCommand(): TriggerCommand`.

- [ ] **Step 1: Write the failing tests.** Add cases for blank/invalid input becoming null, decimal values rounded to two places for analytical metrics, integer lot dimensions, clamping to `0..1_000_000_000` (or integer lot bounds `0..10_000`), reversed values swapping, active-range detection, typed set payload, and clear payload.
- [ ] **Step 2: Run the focused UI test and verify RED.**

  ```bash
  cd cs2-findit-building-menu/FindIt/UI
  npm test -- --test-name-pattern='metric range'
  ```

  Expected: failure because the range module/exports do not exist.

- [ ] **Step 3: Implement the minimal range helpers.** Keep parsing pure and side-effect free. Use `Number.isFinite`, `Math.max/min`, metric-specific integer/decimal normalization, and swap only when both bounds are present and min exceeds max. Keep command construction in `buildingCatalogContracts.ts` alongside existing trigger helpers.
- [ ] **Step 4: Run the focused test and verify GREEN.** Then run the full UI suite.

  ```bash
  cd cs2-findit-building-menu/FindIt/UI
  npm test -- --test-name-pattern='metric range'
  npm test
  ```

---

### Task 2: Add the typed backend trigger, normalized state binding, and query transition

**Files:**
- Create: `cs2-findit-building-menu/FindIt/Domain/BuildingCatalogMetricRange.cs`
- Create: `cs2-findit-building-menu/FindIt/Domain/BuildingCatalogMetricRangeState.cs`
- Modify: `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Setup.cs`
- Modify: `cs2-findit-building-menu/FindIt/Systems/FindItUISystem.Bindings.cs`
- Modify: `cs2-findit-building-menu/FindIt/Domain/BuildingCatalogQuery.cs` only if a focused helper is needed
- Test: `cs2-findit-building-menu/FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`
- Test: `cs2-findit-building-menu/FindItBuildingMenu.Tests/BuildingCatalogMetricRangeTests.cs`

**Interfaces:**
- `BuildingCatalogMetricRange` exposes `MetricId`, `MinText`, and `MaxText` strings for the binding boundary and a pure `TryNormalize` helper returning nullable doubles/ints.
- `BuildingCatalogMetricRange` is a normalized record `(string MetricId, double? Min, double? Max)` with `TryParse(string metricId, string minText, string maxText, out BuildingCatalogMetricRange range)`; unsupported IDs return `false` and leave the query unchanged.
- `BuildingCatalogMetricRange.Apply(BuildingCatalogQuery query, string metricId, string minText, string maxText)` returns a query with the selected nullable min/max pair updated and `Offset = 0`; `Clear(BuildingCatalogQuery query)` clears only the six metric pairs and resets the offset.
- `BuildingCatalogMetricRangeState` is an `IJsonWritable` payload with `MinCost`, `MaxCost`, `MinUpkeep`, `MaxUpkeep`, `MinWorkers`, `MaxWorkers`, `MinCapacity`, `MaxCapacity`, `MinLotWidth`, `MaxLotWidth`, `MinLotDepth`, `MaxLotDepth`, and `HasSelection`. It is published as `BuildingCatalogMetricRanges`.
- `SetBuildingCatalogMetricRange(string metricId, string minText, string maxText)` updates only the six supported fields, sets `Offset = 0`, and refreshes the existing adapter query.
- `ClearBuildingCatalogMetricRanges()` clears those twelve min/max fields, preserves search/category/facet/sort state, sets `Offset = 0`, and refreshes.

- [ ] **Step 1: Write backend red tests.** Test inclusive cost/capacity/lot bounds, missing-value exclusion, reversed/invalid text normalization, unsupported metric IDs being ignored, composition with a categorical facet, and offset reset on range changes.
- [ ] **Step 2: Run the focused backend tests and verify RED.**

  ```bash
  dotnet test cs2-findit-building-menu/FindItBuildingMenu.Tests/FindItBuildingMenu.Tests.csproj --filter FullyQualifiedName~BuildingCatalogMetricRange --no-restore
  ```

  Expected: failure because the metric-range helper and binding transition do not exist.

- [ ] **Step 3: Implement the typed trigger and state transition.** Use `CreateTrigger<string, string, string>`; parse numeric text with `CultureInfo.InvariantCulture`; ignore malformed/unsupported payloads without throwing; update only the relevant nullable query properties and preserve all other query state. Keep metric ranges in a separate normalized state record so the Education preset can combine its floor with the metric capacity minimum using `Math.Max` while preserving the metric maximum.
- [ ] **Step 4: Publish the normalized range state from `RefreshBuildingCatalog`.** The binding must update after a set, clear, view recreation, or section transition; it must never expose draft text or stale preset values.
- [ ] **Step 5: Run focused and full backend tests.**

  ```bash
  dotnet test cs2-findit-building-menu/FindItBuildingMenu.Tests/FindItBuildingMenu.Tests.csproj --filter FullyQualifiedName~BuildingCatalogMetricRange --no-restore
  ./cs2-findit-building-menu/build.sh test
  ```

---

### Task 3: Build the compact Metric Filters drawer

**Files:**
- Create: `cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/BuildingCatalogMetricFilters.tsx`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/mods/BuildingCatalog/buildingCatalog.module.scss`
- Modify: `cs2-findit-building-menu/FindIt/Locale.json`
- Modify: `cs2-findit-building-menu/FindIt/UI/src/domain/buildingCatalog.ts`
- Test: `cs2-findit-building-menu/FindIt/UI/test/buildingCatalogContracts.test.ts`

**Interfaces:**
- The component reads `BuildingCatalogMetricRanges` as its controlled normalized state, dispatches the typed range trigger on each committed text change, and reads the active count from the binding.
- `MetricFilterField` renders a localized label, min input, max input, and uses the existing Gameface `TextInput` module (`game-ui/common/input/text/text-input.tsx`, export `TextInput`) with `value`, `type="text"`, `multiline={1}`, and `onChange={(event: Event) => ...}`.

- [ ] **Step 1: Add pure render-model assertions for the six metric definitions, active count, controlled binding fallback, and clear command to `buildingCatalogContracts.test.ts`.** Run them red before component implementation.
- [ ] **Step 2: Implement the drawer using the existing `Button`, `useLocalization`, and Gameface text-input resolver pattern.** Keep it collapsed by default, place the toggle beside `BuildingCatalogFacetPanel`, read `bindValue<BuildingCatalogMetricRangeState>(mod.id, "BuildingCatalogMetricRanges", emptyState)`, and dispatch the typed range command plus `SetBuildingCatalogOffset(0)` with each range change.
- [ ] **Step 3: Add rem/flexbox styles.** Bound the drawer height, allow its fields to wrap, keep labels ellipsis-safe, expose a selected-count marker, and ensure it does not cover the row header or footer at the supported viewport.
- [ ] **Step 4: Run the UI tests and webpack build.**

  ```bash
  cd cs2-findit-building-menu/FindIt/UI
  npm test
  npm run build
  ```

---

### Task 4: Integrate, package, and verify the behavior

**Files:**
- Modify: `cs2-findit-building-menu/docs/verification.md`
- Modify: `cs2-findit-building-menu/docs/roadmap.md` to record the completed metric-range slice
- Create: `tools/e2e/artifacts/e2e-20260801-building-lens-metric-ranges-live/manifest.json`
- Create: `tools/e2e/artifacts/e2e-20260801-building-lens-metric-ranges-live/observations.json`

- [ ] **Step 1: Run all local gates.**

  ```bash
  ./cs2-findit-building-menu/build.sh all
  ./cs2-findit-building-menu/build.sh test
  (cd cs2-findit-building-menu/FindIt/UI && npm test)
  ./cs2-findit-building-menu/build.sh package
  git diff --check
  ```

- [ ] **Step 2: Deploy only through `just deploy-isolated findit-building-menu`.** Run `just cs2-status` first and protect the single game instance with the stable agent lock.
- [ ] **Step 3: Perform settled live verification.** Open Building Lens on `Codex Preview Smoke 20260726`, advance to a non-first page, open Metric Filters, set Cost and Capacity bounds, verify the total changes and footer returns to page one, clear ranges, verify the original total/page returns, and confirm the Gameface error buffer remains empty.
- [ ] **Step 4: Archive DOM observations and update `docs/verification.md`.** Record the exact range values, counts, footer summaries, active marker, viewport, and console error count.
- [ ] **Step 5: Comment the bead with red/green test counts, package/deploy result, and live evidence. Close only after every acceptance checkbox is verified; leave the parent release-identity gate open.

## Review checkpoint

The plan deliberately keeps the first implementation to six static metrics and
three-string triggers. Utilities, pollution, runtime predicates, saved
presets, and multi-column sorting remain separate follow-up work.
